import { QueueName } from '../queues/names';

export const workerDefinitions = [
  {
    id: 'image-worker',
    queue: QueueName.ImageGeneration,
    description: 'Processes image generation jobs for Souqy Studio.',
  },
  {
    id: 'llm-worker',
    queue: QueueName.AiChat,
    description: 'Processes AI chat and LLM generation jobs for Souqy Studio.',
  },
] as const;

export function listWorkerDefinitions() {
  return workerDefinitions;
}
