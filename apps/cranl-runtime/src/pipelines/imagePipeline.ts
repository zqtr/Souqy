import { v4 as uuidv4 } from 'uuid';
import type { ImageGenerationJob, JobOutput } from '../jobs/types';
import { getProvider } from '../providers';

export async function runImagePipeline(job: ImageGenerationJob): Promise<JobOutput> {
  const provider = getProvider(job.provider);
  if (!provider.generateImage) {
    throw new Error(`${provider.name} does not support image generation.`);
  }

  const result = await provider.generateImage(job);
  return {
    id: uuidv4(),
    provider: result.provider,
    status: 'completed',
    output: result.output,
    metadata: {
      model: result.model,
      ...job.metadata,
    },
  };
}
