import { z } from 'zod';

export const ProviderSchema = z.enum(['openai', 'ollama', 'huggingface', 'mock']).default('mock');

export const ImageGenerationJobSchema = z.object({
  prompt: z.string().min(1),
  provider: ProviderSchema,
  model: z.string().optional(),
  size: z.string().default('1024x1024'),
  count: z.coerce.number().int().min(1).max(4).default(1),
  metadata: z.record(z.unknown()).default({}),
});

export type ImageGenerationJob = z.infer<typeof ImageGenerationJobSchema>;

export const ChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().min(1),
});

export const AiChatJobSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1),
  provider: ProviderSchema,
  model: z.string().optional(),
  temperature: z.coerce.number().min(0).max(2).default(0.7),
  metadata: z.record(z.unknown()).default({}),
});

export type AiChatJob = z.infer<typeof AiChatJobSchema>;

export type JobOutput = {
  id: string;
  provider: string;
  status: 'completed';
  output: unknown;
  metadata?: Record<string, unknown>;
};
