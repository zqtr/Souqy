import { huggingfaceProvider } from './huggingface';
import { mockProvider } from './mock';
import { ollamaProvider } from './ollama';
import { openaiProvider } from './openai';
import type { CranlProvider } from './types';

const providers = new Map<CranlProvider['name'], CranlProvider>([
  [mockProvider.name, mockProvider],
  [openaiProvider.name, openaiProvider],
  [ollamaProvider.name, ollamaProvider],
  [huggingfaceProvider.name, huggingfaceProvider],
]);

export function getProvider(name: CranlProvider['name']): CranlProvider {
  const provider = providers.get(name);
  if (!provider) throw new Error(`Unknown provider: ${name}`);
  return provider;
}

export function listProviders() {
  return [...providers.keys()];
}
