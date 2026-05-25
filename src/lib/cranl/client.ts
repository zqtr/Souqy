import 'server-only';
import { z } from 'zod';
import { env } from '@/lib/env';

const ProviderSchema = z.enum(['openai', 'ollama', 'huggingface', 'mock']);

export const CranlQueueSchema = z.enum([
  'image-generation',
  'video-generation',
  'audio-processing',
  'upscale-processing',
  'ai-chat',
  'svg-processing',
]);

export const CranlImageGenerationRequestSchema = z.object({
  prompt: z.string().trim().min(1).max(5_000),
  provider: ProviderSchema.default('openai'),
  model: z.string().trim().min(1).max(120).optional(),
  size: z.string().trim().min(3).max(40).default('1024x1024'),
  count: z.coerce.number().int().min(1).max(4).default(1),
  metadata: z.record(z.unknown()).default({}),
});

const CranlChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().trim().min(1).max(12_000),
});

export const CranlAiChatRequestSchema = z.object({
  messages: z.array(CranlChatMessageSchema).min(1).max(32),
  provider: ProviderSchema.default('openai'),
  model: z.string().trim().min(1).max(120).optional(),
  temperature: z.coerce.number().min(0).max(2).default(0.7),
  metadata: z.record(z.unknown()).default({}),
});

const CranlJobSubmissionSchema = z.object({
  status: z.literal('queued'),
  queue: CranlQueueSchema,
  jobId: z.string().min(1),
  attempts: z.number().optional(),
});

const CranlJobStatusSchema = z.object({
  queue: CranlQueueSchema,
  jobId: z.string().min(1),
  name: z.string().optional(),
  state: z.string(),
  metadata: z.record(z.unknown()).optional(),
  progress: z.unknown().optional(),
  attemptsMade: z.number().optional(),
  attempts: z.number().optional(),
  failedReason: z.string().nullable().optional(),
  returnvalue: z.unknown().optional(),
  timestamp: z.number().optional(),
  processedOn: z.number().nullable().optional(),
  finishedOn: z.number().nullable().optional(),
});

export type CranlImageGenerationRequest = z.infer<typeof CranlImageGenerationRequestSchema>;
export type CranlAiChatRequest = z.infer<typeof CranlAiChatRequestSchema>;
export type CranlQueue = z.infer<typeof CranlQueueSchema>;
export type CranlJobSubmission = z.infer<typeof CranlJobSubmissionSchema>;
export type CranlJobStatus = z.infer<typeof CranlJobStatusSchema>;

export class CranlConfigurationError extends Error {
  constructor(message = 'CranL runtime is not configured.') {
    super(message);
    this.name = 'CranlConfigurationError';
  }
}

export class CranlRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'CranlRequestError';
  }
}

export function isCranlConfigured(): boolean {
  return Boolean(env.CRANL_RUNTIME_URL && env.CRANL_API_KEY);
}

export async function createCranlImageGenerationJob(
  input: CranlImageGenerationRequest,
): Promise<CranlJobSubmission> {
  return CranlJobSubmissionSchema.parse(
    await cranlFetch('/jobs/image-generation', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

export async function createCranlAiChatJob(input: CranlAiChatRequest): Promise<CranlJobSubmission> {
  return CranlJobSubmissionSchema.parse(
    await cranlFetch('/jobs/ai-chat', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

export async function getCranlJobStatus(
  queue: CranlQueue,
  jobId: string,
): Promise<CranlJobStatus> {
  return CranlJobStatusSchema.parse(await cranlFetch(`/jobs/${queue}/${encodeURIComponent(jobId)}`));
}

async function cranlFetch(path: string, init: RequestInit = {}): Promise<unknown> {
  if (!env.CRANL_RUNTIME_URL || !env.CRANL_API_KEY) {
    throw new CranlConfigurationError();
  }

  const url = `${env.CRANL_RUNTIME_URL.replace(/\/+$/u, '')}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.CRANL_API_KEY}`,
      ...init.headers,
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new CranlRequestError(response.status, body || `CranL request failed (${response.status}).`);
  }

  return response.json();
}
