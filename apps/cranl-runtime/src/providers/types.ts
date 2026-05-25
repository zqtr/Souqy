import type { AiChatJob, ImageGenerationJob } from '../jobs/types';

export type ProviderResult = {
  provider: string;
  model?: string;
  output: unknown;
};

export interface CranlProvider {
  name: 'openai' | 'ollama' | 'huggingface' | 'mock';
  generateImage?(job: ImageGenerationJob): Promise<ProviderResult>;
  chat?(job: AiChatJob): Promise<ProviderResult>;
}
