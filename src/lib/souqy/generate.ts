import 'server-only';
import { generateText, APICallError } from 'ai';
import {
  buildSystemPrompt,
  buildUserPrompt,
  buildRepairPrompt,
  buildRepromptUserPrompt,
  parseSouqyOutput,
  SouqyOutputParseError,
  SOUQY_FEW_SHOTS,
  type SouqyBrief,
  type SouqyOutput,
} from './prompt';
import { validateSouqyOutput, formatIssues, type ValidationIssue } from './validate';
import { getMarketSignals } from '@/lib/xapi/marketSignals';
import type { Storefront } from '@/lib/brief';

/**
 * Souqy generation pipeline (model call + parse + validate + auto-repair).
 *
 * Flows through the Vercel AI Gateway via the `ai` package — passing a
 * plain `'anthropic/claude-sonnet-4.6'` provider/model string is enough
 * to route via the gateway when `VERCEL_OIDC_TOKEN` (or
 * `AI_GATEWAY_API_KEY`) is present in the environment.
 *
 * Auto-repair: on validation failure we re-prompt Claude with the
 * specific issues + previous source. Capped at `MAX_REPAIRS` attempts to
 * bound spend per generation.
 */

const SOUQY_MODEL = 'anthropic/claude-sonnet-4.6';
const SOUQY_TAGS = ['feature:souqy', 'tier:pro+', 'env:production'];
const MAX_REPAIRS = 2;

/**
 * Hard cap on the prompt size we'll send to the gateway. Founder-supplied
 * `vibe` plus our system prompt and few-shot is ~3-4k tokens; we cap the
 * raw character count well below that to dodge a confused estimate.
 */
const MAX_VIBE_CHARS = 1200;

export type GenerateInput = {
  brief: SouqyBrief;
  /** Per-user routing key for AI Gateway rate limiting + cost attribution. */
  clerkUserId: string;
  storefront?: Storefront;
};

export type GenerateOk = {
  status: 'ok';
  output: SouqyOutput;
  attempts: number;
  /** Total tokens consumed across all attempts. */
  usage: { inputTokens: number; outputTokens: number };
};

export type GenerateErr = {
  status: 'parse_failed' | 'validation_failed' | 'budget_exceeded' | 'rate_limited' | 'error';
  message: string;
  /** Last set of validation issues, when applicable. */
  issues?: ValidationIssue[];
  /** Last raw assistant message we couldn't make use of. */
  lastSource?: SouqyOutput;
};

export type GenerateResult = GenerateOk | GenerateErr;

export async function generateSouqyStorefront(input: GenerateInput): Promise<GenerateResult> {
  const brief = clampBrief(input.brief);
  const marketSignals = await getMarketSignals({
    businessName: brief.businessName,
    businessType: brief.businessType,
    vibe: brief.vibe,
    locale: brief.locale,
  });
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...SOUQY_FEW_SHOTS,
    { role: 'user', content: buildUserPrompt(brief, input.storefront, marketSignals) },
  ];

  let attempts = 0;
  let totalIn = 0;
  let totalOut = 0;
  let lastOutput: SouqyOutput | undefined;
  let lastIssues: ValidationIssue[] = [];

  while (attempts <= MAX_REPAIRS) {
    attempts += 1;
    let raw: string;
    let inputTokens = 0;
    let outputTokens = 0;
    try {
      const result = await generateText({
        model: SOUQY_MODEL,
        system: buildSystemPrompt(),
        messages,
        // Anchored low: we want consistent, conservative editorial code,
        // not surprising leaps. Founders can re-prompt for variety.
        temperature: 0.4,
        maxOutputTokens: 4096,
        providerOptions: {
          gateway: {
            user: input.clerkUserId,
            tags: SOUQY_TAGS,
          },
        },
      });
      raw = result.text;
      inputTokens = result.usage?.inputTokens ?? 0;
      outputTokens = result.usage?.outputTokens ?? 0;
    } catch (err) {
      return mapGatewayError(err);
    }
    totalIn += inputTokens;
    totalOut += outputTokens;

    let parsed: SouqyOutput;
    try {
      parsed = parseSouqyOutput(raw);
    } catch (err) {
      if (err instanceof SouqyOutputParseError && attempts <= MAX_REPAIRS) {
        // Replay loop: feed the prior assistant message + the parse
        // error back as a user turn so Claude can correct in-context.
        messages.push({ role: 'assistant', content: raw });
        messages.push({
          role: 'user',
          content: `Your previous output failed to parse: ${err.message}\nReturn the corrected JSON envelope only.`,
        });
        continue;
      }
      return {
        status: 'parse_failed',
        message: err instanceof Error ? err.message : 'Unparseable Souqy output.',
      };
    }
    lastOutput = parsed;

    const validation = validateSouqyOutput(parsed.files);
    if (validation.ok) {
      return {
        status: 'ok',
        output: parsed,
        attempts,
        usage: { inputTokens: totalIn, outputTokens: totalOut },
      };
    }
    lastIssues = validation.issues;

    if (attempts > MAX_REPAIRS) break;

    messages.push({ role: 'assistant', content: raw });
    messages.push({
      role: 'user',
      content: buildRepairPrompt({
        previousFiles: parsed.files,
        errorSummary: formatIssues(validation.issues),
      }),
    });
  }

  return {
    status: 'validation_failed',
    message: `Souqy output failed validation after ${attempts} attempt(s).`,
    issues: lastIssues,
    lastSource: lastOutput,
  };
}

/**
 * Re-prompt path for the dashboard Souqy editor. Same pipeline, but the
 * user prompt carries the previous source + the diff request so Claude
 * doesn't lose continuity across iterations.
 */
export async function repromptSouqyStorefront(args: {
  request: string;
  previousSource: string;
  storefront: Storefront;
  clerkUserId: string;
}): Promise<GenerateResult> {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...SOUQY_FEW_SHOTS,
    {
      role: 'user',
      content: buildRepromptUserPrompt({
        previousSource: args.previousSource,
        request: args.request,
        storefront: args.storefront,
      }),
    },
  ];

  let attempts = 0;
  let totalIn = 0;
  let totalOut = 0;
  let lastOutput: SouqyOutput | undefined;
  let lastIssues: ValidationIssue[] = [];

  while (attempts <= MAX_REPAIRS) {
    attempts += 1;
    let raw: string;
    try {
      const result = await generateText({
        model: SOUQY_MODEL,
        system: buildSystemPrompt(),
        messages,
        temperature: 0.4,
        maxOutputTokens: 4096,
        providerOptions: {
          gateway: {
            user: args.clerkUserId,
            tags: [...SOUQY_TAGS, 'op:reprompt'],
          },
        },
      });
      raw = result.text;
      totalIn += result.usage?.inputTokens ?? 0;
      totalOut += result.usage?.outputTokens ?? 0;
    } catch (err) {
      return mapGatewayError(err);
    }

    let parsed: SouqyOutput;
    try {
      parsed = parseSouqyOutput(raw);
    } catch (err) {
      if (err instanceof SouqyOutputParseError && attempts <= MAX_REPAIRS) {
        messages.push({ role: 'assistant', content: raw });
        messages.push({
          role: 'user',
          content: `Your previous output failed to parse: ${err.message}\nReturn the corrected JSON envelope only.`,
        });
        continue;
      }
      return {
        status: 'parse_failed',
        message: err instanceof Error ? err.message : 'Unparseable Souqy output.',
      };
    }
    lastOutput = parsed;

    const validation = validateSouqyOutput(parsed.files);
    if (validation.ok) {
      return {
        status: 'ok',
        output: parsed,
        attempts,
        usage: { inputTokens: totalIn, outputTokens: totalOut },
      };
    }
    lastIssues = validation.issues;

    if (attempts > MAX_REPAIRS) break;
    messages.push({ role: 'assistant', content: raw });
    messages.push({
      role: 'user',
      content: buildRepairPrompt({
        previousFiles: parsed.files,
        errorSummary: formatIssues(validation.issues),
      }),
    });
  }

  return {
    status: 'validation_failed',
    message: `Souqy reprompt failed validation after ${attempts} attempt(s).`,
    issues: lastIssues,
    lastSource: lastOutput,
  };
}

function clampBrief(brief: SouqyBrief): SouqyBrief {
  return {
    ...brief,
    vibe:
      brief.vibe.length > MAX_VIBE_CHARS ? brief.vibe.slice(0, MAX_VIBE_CHARS) + '…' : brief.vibe,
  };
}

/**
 * Translate AI Gateway errors into Souqy's typed error union. We care
 * specifically about 402 (budget exceeded) and 429 (rate limited) so
 * the dashboard can surface a tailored message ("you've used your
 * monthly Souqy quota") instead of a generic failure.
 */
function mapGatewayError(err: unknown): GenerateErr {
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
        message: 'Too many Souqy generations in the last few minutes — try again shortly.',
      };
    }
  }
  console.error('[souqy/generate] gateway error', err);
  return {
    status: 'error',
    message: err instanceof Error ? err.message : 'Souqy generation failed.',
  };
}
