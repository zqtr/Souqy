import axios from 'axios';
import { env } from '../../config';
import type { AiChatJob } from '../../jobs/types';
import type { CranlProvider, ProviderResult } from '../types';

const ollama = axios.create({
  baseURL: env.OLLAMA_URL,
  timeout: 120_000,
});

export const ollamaProvider: CranlProvider = {
  name: 'ollama',
  async chat(job: AiChatJob): Promise<ProviderResult> {
    const response = await ollama.post('/api/chat', {
      model: job.model ?? 'llama3.1',
      messages: job.messages,
      stream: false,
      options: {
        temperature: job.temperature,
      },
    });

    return {
      provider: 'ollama',
      model: job.model ?? 'llama3.1',
      output: response.data,
    };
  },
};
