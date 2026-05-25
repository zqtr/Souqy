import axios from 'axios';
import { env } from '../../config';
import type { AiChatJob, ImageGenerationJob } from '../../jobs/types';
import type { CranlProvider, ProviderResult } from '../types';

const openai = axios.create({
  baseURL: 'https://api.openai.com/v1',
  timeout: 120_000,
});

function authHeaders() {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured.');
  }

  return {
    Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

export const openaiProvider: CranlProvider = {
  name: 'openai',
  async generateImage(job: ImageGenerationJob): Promise<ProviderResult> {
    const response = await openai.post(
      '/images/generations',
      {
        model: job.model ?? 'gpt-image-1',
        prompt: job.prompt,
        size: job.size,
        n: job.count,
      },
      { headers: authHeaders() },
    );

    return {
      provider: 'openai',
      model: job.model ?? 'gpt-image-1',
      output: response.data,
    };
  },
  async chat(job: AiChatJob): Promise<ProviderResult> {
    const response = await openai.post(
      '/chat/completions',
      {
        model: job.model ?? 'gpt-4o-mini',
        messages: job.messages,
        temperature: job.temperature,
      },
      { headers: authHeaders() },
    );

    return {
      provider: 'openai',
      model: job.model ?? 'gpt-4o-mini',
      output: response.data,
    };
  },
};
