import 'dotenv/config';
import { z } from 'zod';

const OptionalSecretSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().min(16).optional(),
);

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.string().default('info'),
  CRANL_API_KEY: OptionalSecretSchema,
  REDIS_URL: z.string().url().default('redis://127.0.0.1:6379'),
  OPENAI_API_KEY: z.string().optional(),
  OLLAMA_URL: z.string().url().default('http://127.0.0.1:11434'),
  HUGGINGFACE_API_KEY: z.string().optional(),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(2),
});

export const env = EnvSchema.parse(process.env);
