import axios from 'axios';
import { env } from '../../config';
import type { AiChatJob, ImageGenerationJob } from '../../jobs/types';
import type { CranlProvider, ProviderResult } from '../types';

const huggingface = axios.create({
  baseURL: 'https://api-inference.huggingface.co',
  timeout: 120_000,
});

function headers() {
  if (!env.HUGGINGFACE_API_KEY) {
    throw new Error('HUGGINGFACE_API_KEY is not configured.');
  }

  return {
    Authorization: `Bearer ${env.HUGGINGFACE_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

export const huggingfaceProvider: CranlProvider = {
  name: 'huggingface',
  async generateImage(job: ImageGenerationJob): Promise<ProviderResult> {
    const model = job.model ?? 'black-forest-labs/FLUX.1-schnell';
    const response = await huggingface.post(
      `/models/${model}`,
      {
        inputs: job.prompt,
        parameters: {
          size: job.size,
          num_images_per_prompt: job.count,
        },
      },
      { headers: headers(), responseType: 'arraybuffer' },
    );

    return {
      provider: 'huggingface',
      model,
      output: {
        contentType: response.headers['content-type'],
        bytes: Buffer.from(response.data).toString('base64'),
      },
    };
  },
  async chat(job: AiChatJob): Promise<ProviderResult> {
    const model = job.model ?? 'meta-llama/Llama-3.1-8B-Instruct';
    const prompt = job.messages.map((message) => `${message.role}: ${message.content}`).join('\n');
    const response = await huggingface.post(
      `/models/${model}`,
      { inputs: prompt },
      { headers: headers() },
    );

    return {
      provider: 'huggingface',
      model,
      output: response.data,
    };
  },
};
