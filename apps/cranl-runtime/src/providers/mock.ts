import { v4 as uuidv4 } from 'uuid';
import type { AiChatJob, ImageGenerationJob } from '../jobs/types';
import type { CranlProvider, ProviderResult } from './types';

export const mockProvider: CranlProvider = {
  name: 'mock',
  async generateImage(job: ImageGenerationJob): Promise<ProviderResult> {
    return {
      provider: 'mock',
      model: job.model ?? 'mock-image-generator',
      output: {
        images: Array.from({ length: job.count }, () => ({
          id: uuidv4(),
          url: `mock://cranl/images/${uuidv4()}.png`,
          prompt: job.prompt,
          size: job.size,
        })),
      },
    };
  },
  async chat(job: AiChatJob): Promise<ProviderResult> {
    const lastUserMessage = [...job.messages].reverse().find((message) => message.role === 'user');
    return {
      provider: 'mock',
      model: job.model ?? 'mock-llm',
      output: {
        text: `Mock CranL response for: ${lastUserMessage?.content ?? 'empty prompt'}`,
      },
    };
  },
};
