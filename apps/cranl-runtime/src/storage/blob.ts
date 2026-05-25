import { env } from '../config';

export function hasBlobStorage(): boolean {
  return Boolean(env.BLOB_READ_WRITE_TOKEN);
}

export async function persistArtifactPlaceholder(input: {
  key: string;
  contentType: string;
  body: string | Buffer;
}): Promise<{ key: string; persisted: false; reason: string }> {
  void input;
  return {
    key: input.key,
    persisted: false,
    reason: 'Blob persistence is not wired in this standalone runtime yet.',
  };
}
