import 'server-only';
import {
  generateText,
  hasToolCall,
  stepCountIs,
  tool,
  APICallError,
} from 'ai';
import { z } from 'zod';
import { env } from '@/lib/env';
import { blockSchema } from '@/lib/blocks/schemas';
import type { Block } from '@/lib/blocks/types';

/**
 * Souqy block editor — the cheap, tool-only AI surface that powers
 * the in-builder action-bar prompt.
 *
 * Hard scope: edits the SELECTED block only. The model is given exactly
 * one block as context and exposed exactly four tools (`patchProps`,
 * `patchStyle`, `refuse`, `done`). It cannot touch any other block,
 * cannot return prose, cannot fetch, cannot read files. Validation per
 * tool execution against `blockSchema` rejects any patch that would
 * produce an out-of-shape row before it lands in local state, so a
 * model hallucination never reaches the database.
 *
 * Routed through the Vercel AI Gateway via the `ai` package — passing a
 * plain `'google/gemini-2.5-flash-lite'` string is enough when
 * `AI_GATEWAY_API_KEY` (or `VERCEL_OIDC_TOKEN`) is present in the
 * environment. Same plumbing as `src/lib/souqy/generate.ts`; only the
 * model id and prompt shape differ.
 */

export type EditBlockInput = {
  block: Block;
  request: string;
  /** Per-user routing key for AI Gateway rate limiting + cost attribution. */
  clerkUserId: string;
};

export type EditBlockOk = {
  status: 'ok';
  block: Block;
  /** Summary of the patches the agent applied — surfaced in audit meta. */
  patches: { props: boolean; style: boolean };
  steps: number;
  usage: { inputTokens: number; outputTokens: number };
};

export type EditBlockErr = {
  status: 'refused' | 'budget_exceeded' | 'rate_limited' | 'error';
  message: string;
};

export type EditBlockResult = EditBlockOk | EditBlockErr;

const EDIT_TAGS = ['feature:souqy', 'op:edit-block'];

/**
 * Hard ceiling on the agent loop. The model usually patches in 1–2
 * tool calls (one of patchProps/patchStyle plus `done`); 4 leaves
 * headroom for a single self-correction after a `blockSchema` reject.
 */
const MAX_STEPS = 4;
const EDIT_TIMEOUT_MS = 12_000;

/**
 * Truncate large prop strings before serialising into the prompt so a
 * verbose Hero/Banner block doesn't blow our context budget on a
 * sub-cent model. We never send the original strings outside the
 * prompt; the model patches by emitting *new* values.
 */
const MAX_PROP_STRING_CHARS = 280;

const REFUSAL_COPY =
  "Souqy can only edit your storefront. Try: \"make the headline larger\" or \"use a darker background\".";

export async function editBlockWithSouqy(input: EditBlockInput): Promise<EditBlockResult> {
  const original = input.block;

  // Mutable accumulator — every successful tool execution writes here.
  // Returned at the end as the patched block, or as the partial state
  // if the agent hits the step cap before calling `done`.
  let nextProps: Record<string, unknown> = original.props;
  let nextStyle: Block['style'] = original.style;
  let appliedProps = false;
  let appliedStyle = false;
  let refused = false;
  let refusedReason: string | null = null;

  const tools = {
    patchProps: tool({
      description:
        'Replace the block props with a new object. Validated against the block schema for this block type — invalid patches are rejected with an error you can correct on the next step.',
      inputSchema: z.object({
        props: z
          .record(z.string(), z.unknown())
          .describe('Full replacement props object — include every field you want to keep.'),
      }),
      execute: async ({ props }) => {
        const candidate = { ...original, props };
        const parsed = blockSchema.safeParse(candidate);
        if (!parsed.success) {
          return {
            ok: false as const,
            error: parsed.error.issues
              .slice(0, 3)
              .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
              .join('; '),
          };
        }
        nextProps = parsed.data.props as Record<string, unknown>;
        appliedProps = true;
        return { ok: true as const };
      },
    }),
    patchStyle: tool({
      description:
        'Replace the block style overrides (padding, alignment, colors, layout). Pass a full replacement object; pass {} to clear all style overrides.',
      inputSchema: z.object({
        style: z
          .record(z.string(), z.unknown())
          .describe('Full replacement style object — include every field you want to keep.'),
      }),
      execute: async ({ style }) => {
        const candidate = { ...original, style: style as Block['style'] };
        const parsed = blockSchema.safeParse(candidate);
        if (!parsed.success) {
          return {
            ok: false as const,
            error: parsed.error.issues
              .slice(0, 3)
              .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
              .join('; '),
          };
        }
        nextStyle = parsed.data.style;
        appliedStyle = true;
        return { ok: true as const };
      },
    }),
    refuse: tool({
      description:
        'Call when the request is off-topic, conversational, or not about editing this block.',
      inputSchema: z.object({
        reason: z.string().min(1).max(280),
      }),
      execute: async ({ reason }) => {
        refused = true;
        refusedReason = reason;
        return { ok: true as const };
      },
    }),
    done: tool({
      description: 'Signal that the edit is complete. Always call this after applying patches.',
      inputSchema: z.object({}),
      execute: async () => ({ ok: true as const }),
    }),
  };

  const system = buildSystemPrompt(original);
  const userMessage = buildUserMessage(original, input.request);

  let steps = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let gatewayError: EditBlockErr | null = null;

  try {
    const result = await generateText({
      model: env.SOUQY_BLOCK_EDIT_MODEL,
      system,
      messages: [{ role: 'user', content: userMessage }],
      tools,
      // Force a tool call on every step — model can never reply with
      // free-form text. Combined with the closed tool surface, the
      // only "answers" the model can produce are mutations or refusals.
      toolChoice: 'required',
      // Stop as soon as the agent calls `done` or `refuse`; otherwise
      // the step ceiling acts as a hard backstop so a misbehaving model
      // can never burn budget in a loop.
      stopWhen: [hasToolCall('done'), hasToolCall('refuse'), stepCountIs(MAX_STEPS)],
      // Editorial edits should be deterministic — temp anchored low so
      // identical prompts converge on identical patches.
      temperature: 0.2,
      maxOutputTokens: 1024,
      timeout: EDIT_TIMEOUT_MS,
      providerOptions: {
        gateway: {
          user: input.clerkUserId,
          tags: EDIT_TAGS,
        },
      },
    });
    steps = result.steps?.length ?? 0;
    inputTokens = result.usage?.inputTokens ?? 0;
    outputTokens = result.usage?.outputTokens ?? 0;
  } catch (err) {
    gatewayError = mapGatewayError(err);
  }

  if (refused) {
    return {
      status: 'refused',
      message: refusedReason ?? REFUSAL_COPY,
    };
  }

  if (!appliedProps && !appliedStyle) {
    const local = applyLocalBuilderEdit(original, input.request);
    if (local) {
      return {
        status: 'ok',
        block: local.block,
        patches: local.patches,
        steps,
        usage: { inputTokens, outputTokens },
      };
    }
    if (gatewayError) return gatewayError;

    // Model finished without patching anything — treat as a soft
    // refusal so the UI surfaces a useful message instead of a silent
    // no-op that looks like a bug.
    return {
      status: 'refused',
      message: REFUSAL_COPY,
    };
  }

  const patched: Block = {
    ...original,
    props: nextProps,
    style: nextStyle,
  };

  if (blocksAreEquivalent(original, patched)) {
    const local = applyLocalBuilderEdit(original, input.request);
    if (local) {
      return {
        status: 'ok',
        block: local.block,
        patches: local.patches,
        steps,
        usage: { inputTokens, outputTokens },
      };
    }
    return {
      status: 'refused',
      message: 'Souqy understood the request but did not change this block. Try a more specific edit.',
    };
  }

  // Final belt-and-braces validation — every tool execution already
  // ran the candidate through `blockSchema`, but we re-parse the
  // assembled block so the action that calls us can trust the return
  // value without re-validating.
  const finalParse = blockSchema.safeParse(patched);
  if (!finalParse.success) {
    console.error('[souqy/editBlock] final block failed schema', finalParse.error.issues);
    return {
      status: 'error',
      message: 'Souqy produced an invalid block. Please try a different prompt.',
    };
  }

  return {
    status: 'ok',
    block: finalParse.data as Block,
    patches: { props: appliedProps, style: appliedStyle },
    steps,
    usage: { inputTokens, outputTokens },
  };
}

/**
 * Cheap pre-LLM topic gate. The keyword set is intentionally permissive
 * — false negatives just mean the model gets called and (worst case)
 * itself calls `refuse`. False positives are harmless because the
 * model still validates against the block schema.
 *
 * Used by the server action to short-circuit obvious off-topic prompts
 * (questions, account/billing, "write me an email") before paying for
 * a single model token.
 *
 * Bilingual posture: Arabic input flows straight through to the model
 * (any character in the Arabic block opts in). Maintaining a parallel
 * Arabic keyword list would be brittle across dialects, and Souqna's
 * core audience writes Arabic — the model itself can still refuse via
 * the `refuse` tool when the request truly is off-topic.
 */
const BUILDER_INTENT_RE = new RegExp(
  [
    'hero|banner|gallery|product|menu|service|calendar|contact|inquire|cta|spacer|divider',
    'text|heading|headline|title|tagline|eyebrow|caption|body|copy|paragraph|word',
    'image|photo|picture|background|logo|icon|gif',
    'color|colour|palette|theme|gold|maroon|sand|bone|ink|dark|light|warm|cool',
    'font|serif|sans|mono|italic|bold|weight|size|larger|smaller|bigger|tiny|huge',
    'padding|margin|gap|spacing|space|tight|wide|narrow|comfortable|spacious|breathing',
    'align|center|left|right|start|end|justify|stretch',
    'layout|grid|column|row|stack|inline|centered|banner|split|stacked',
    'show|hide|add|remove|move|swap|change|update|edit|tweak|make|set|use|switch',
    'href|link|url|button|label',
    'arabic|english|bilingual|rtl|ltr|locale',
  ].join('|'),
  'i',
);

const ARABIC_CHAR_RE = /[\u0600-\u06FF\u0750-\u077F]/;

export function isBuilderRequest(request: string): boolean {
  if (!request || request.trim().length < 3) return false;
  if (ARABIC_CHAR_RE.test(request)) return true;
  return BUILDER_INTENT_RE.test(request);
}

export function souqyRefusalCopy(): string {
  return REFUSAL_COPY;
}

function buildSystemPrompt(block: Block): string {
  return [
    'You are a block editor for the Souqna storefront builder.',
    'You modify ONE block by calling tools. You never produce assistant text.',
    '',
    'Allowed tools:',
    '  - patchProps({ props })  : replace the block props.',
    '  - patchStyle({ style })  : replace the block style overrides.',
    '  - refuse({ reason })     : call for off-topic or unrelated requests.',
    '  - done()                 : call when the edit is complete.',
    '',
    'Hard rules:',
    `  - The block type is "${block.type}". Do not change it.`,
    '  - Apply the SMALLEST possible patch that satisfies the request.',
    '  - When calling patchProps, include ALL existing fields you want to keep — the patch is a full replacement.',
    '  - Same for patchStyle.',
    '  - Never invent fields that are not already in the current props/style or in the storefront block taxonomy.',
    '  - Bilingual storefronts: when adding/changing text, match the locale of the existing copy.',
    '  - Off-topic prompts (questions, chat, account, billing, requests about other blocks/pages): call refuse and stop.',
    '  - Always finish by calling done().',
  ].join('\n');
}

function buildUserMessage(block: Block, request: string): string {
  return [
    `Block id: ${block.id}`,
    `Block type: ${block.type}`,
    'Current props (JSON):',
    JSON.stringify(truncateForPrompt(block.props), null, 2),
    '',
    'Current style (JSON):',
    JSON.stringify(truncateForPrompt(block.style ?? {}), null, 2),
    '',
    'Founder request:',
    request,
  ].join('\n');
}

/**
 * Walk the value tree and clip any string longer than the per-string
 * cap so a Hero with a 4KB body doesn't dominate the prompt. Arrays
 * are bounded at 8 entries to keep galleries readable. The patched
 * values the model emits are not affected — only the prompt context.
 */
function truncateForPrompt(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.length > MAX_PROP_STRING_CHARS
      ? value.slice(0, MAX_PROP_STRING_CHARS) + '…'
      : value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 8).map(truncateForPrompt);
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = truncateForPrompt(v);
    }
    return out;
  }
  return value;
}

function blocksAreEquivalent(a: Block, b: Block): boolean {
  return stableStringify(a.props) === stableStringify(b.props)
    && stableStringify(a.style ?? {}) === stableStringify(b.style ?? {});
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function applyLocalBuilderEdit(
  block: Block,
  request: string,
): { block: Block; patches: { props: boolean; style: boolean } } | null {
  const normalized = request.toLowerCase();
  let nextProps = { ...block.props };
  let nextStyle: Block['style'] = { ...(block.style ?? {}) };
  let propsChanged = false;
  let styleChanged = false;

  const setStyle = (patch: NonNullable<Block['style']>) => {
    nextStyle = { ...nextStyle, ...patch };
    styleChanged = true;
  };

  if (matches(normalized, ['dark', 'black', 'ink', 'night', 'داكن', 'غامق', 'اسود', 'أسود'])) {
    setStyle({ colorScheme: 'dark', bg: 'ink', textColor: 'sand' });
  }
  if (matches(normalized, ['light', 'bright', 'white', 'clean', 'فاتح', 'ابيض', 'أبيض'])) {
    setStyle({ colorScheme: 'light', bg: 'sand', textColor: 'ink' });
  }
  if (matches(normalized, ['gold', 'ذهبي', 'ذهب'])) {
    setStyle({ bg: 'gold', textColor: 'ink' });
  }
  if (matches(normalized, ['center', 'centred', 'centered', 'middle', 'وسط', 'منتصف'])) {
    setStyle({ align: 'center' });
    if (hasAlignProp(nextProps)) {
      nextProps = { ...nextProps, align: 'center' };
      propsChanged = true;
    }
  }
  if (matches(normalized, ['left', 'start', 'يسار', 'البداية'])) {
    setStyle({ align: 'start' });
    if (hasAlignProp(nextProps)) {
      nextProps = { ...nextProps, align: 'start' };
      propsChanged = true;
    }
  }
  if (matches(normalized, ['right', 'end', 'يمين', 'النهاية'])) {
    setStyle({ align: 'end' });
    if (hasAlignProp(nextProps)) {
      nextProps = { ...nextProps, align: 'end' };
      propsChanged = true;
    }
  }
  if (matches(normalized, ['bigger', 'larger', 'huge', 'heroic', 'spacious', 'wide', 'اكبر', 'أكبر', 'واسع'])) {
    setStyle({ paddingY: 'xl', paddingX: 'lg' });
    if (typeof nextProps.size === 'string') {
      nextProps = { ...nextProps, size: 'xl' };
      propsChanged = true;
    }
  }
  if (matches(normalized, ['smaller', 'compact', 'tight', 'shorter', 'اصغر', 'أصغر', 'ضيق', 'مختصر'])) {
    setStyle({ paddingY: 'sm', paddingX: 'sm' });
    if (typeof nextProps.size === 'string') {
      nextProps = { ...nextProps, size: 'sm' };
      propsChanged = true;
    }
  }
  if (matches(normalized, ['hide', 'remove', 'اخف', 'إخف', 'احذف', 'حذف'])) {
    setStyle({ display: 'hidden' });
  }
  if (matches(normalized, ['show', 'unhide', 'اظهر', 'أظهر'])) {
    setStyle({ display: 'block' });
  }
  if (matches(normalized, ['aurora', 'glow', 'premium', 'pro', 'upgrade', 'هالة', 'متقدم'])) {
    setStyle({ variant: 'pro-aurora' });
  }
  if (matches(normalized, ['neon', 'نيون'])) {
    setStyle({ variant: 'pro-neon' });
  }
  if (matches(normalized, ['magnetic', 'مغناطيسي'])) {
    setStyle({ variant: 'pro-magnetic' });
  }

  const quoted = extractQuotedText(request);
  if (quoted) {
    const preferredField = preferredTextField(normalized, nextProps);
    if (preferredField) {
      nextProps = { ...nextProps, [preferredField]: quoted };
      propsChanged = true;
    } else if (mentionsCta(normalized) && isRecord(nextProps.cta)) {
      nextProps = { ...nextProps, cta: { ...nextProps.cta, label: quoted } };
      propsChanged = true;
    }
  }

  if (!propsChanged && !styleChanged) return null;

  const candidate: Block = {
    ...block,
    props: nextProps,
    style: Object.keys(nextStyle ?? {}).length > 0 ? nextStyle : undefined,
  };
  const parsed = blockSchema.safeParse(candidate);
  if (!parsed.success) {
    console.error('[souqy/editBlock] local fallback failed schema', parsed.error.issues);
    return null;
  }

  return {
    block: parsed.data as Block,
    patches: { props: propsChanged, style: styleChanged },
  };
}

function matches(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

function hasAlignProp(props: Record<string, unknown>): boolean {
  return props.align === 'start' || props.align === 'center' || props.align === 'end';
}

function extractQuotedText(request: string): string | null {
  const match = request.match(/["'“”‘’](.{1,220}?)["'“”‘’]/u);
  return match?.[1]?.trim() || null;
}

function preferredTextField(
  request: string,
  props: Record<string, unknown>,
): string | null {
  const candidates = mentionsTitle(request)
    ? ['title', 'heading', 'overlayTitle', 'text', 'label']
    : mentionsBody(request)
      ? ['body', 'tagline', 'overlaySubtitle', 'description', 'caption']
      : ['title', 'heading', 'body', 'text', 'label', 'overlayTitle', 'tagline'];
  return candidates.find((key) => typeof props[key] === 'string') ?? null;
}

function mentionsTitle(request: string): boolean {
  return matches(request, ['title', 'heading', 'headline', 'eyebrow', 'العنوان', 'عنوان']);
}

function mentionsBody(request: string): boolean {
  return matches(request, ['body', 'copy', 'paragraph', 'subtitle', 'tagline', 'الوصف', 'النص']);
}

function mentionsCta(request: string): boolean {
  return matches(request, ['button', 'cta', 'call to action', 'زر']);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function mapGatewayError(err: unknown): EditBlockErr {
  if (APICallError.isInstance(err)) {
    if (err.statusCode === 402) {
      return {
        status: 'budget_exceeded',
        message: 'Souqy is out of credits for this billing cycle.',
      };
    }
    if (err.statusCode === 429) {
      return {
        status: 'rate_limited',
        message: 'Too many Souqy edits — try again in a moment.',
      };
    }
  }
  console.error('[souqy/editBlock] gateway error', err);
  return {
    status: 'error',
    message: err instanceof Error ? err.message : 'Souqy edit failed.',
  };
}
