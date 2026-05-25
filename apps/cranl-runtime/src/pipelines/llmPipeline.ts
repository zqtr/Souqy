import { v4 as uuidv4 } from 'uuid';
import type { AiChatJob, JobOutput } from '../jobs/types';
import { getProvider } from '../providers';

export async function runLlmPipeline(job: AiChatJob): Promise<JobOutput> {
  const provider = getProvider(job.provider);
  if (!provider.chat) {
    throw new Error(`${provider.name} does not support chat workloads.`);
  }

  const result = await provider.chat(job);
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
