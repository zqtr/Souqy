export const QueueName = {
  ImageGeneration: 'image-generation',
  VideoGeneration: 'video-generation',
  AudioProcessing: 'audio-processing',
  UpscaleProcessing: 'upscale-processing',
  AiChat: 'ai-chat',
  SvgProcessing: 'svg-processing',
} as const;

export type QueueName = (typeof QueueName)[keyof typeof QueueName];

export const queueNames = Object.values(QueueName);
