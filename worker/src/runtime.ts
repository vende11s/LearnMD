import { MAX_SHARE_BYTES } from '../../shared/share-contract';
export function isShareExpired(now: number, expiresAt: number) {
  return now >= expiresAt;
}
export function utcMonthWindow(now: number) {
  const date = new Date(now);
  return {
    startAt: Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1),
    resetAt: Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1),
  };
}
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public retryAfter?: number,
    public resetAt?: number,
  ) {
    super(message);
  }
}

export async function readBoundedBody(
  request: Request,
  maximum = MAX_SHARE_BYTES,
  timeoutMs = 30_000,
): Promise<Uint8Array> {
  if (!request.body)
    throw new ApiError(400, 'invalid_bundle', 'The share is empty.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new ApiError(
          408,
          'upload_timeout',
          'The upload took too long. Please try again.',
        ),
      );
      void reader.cancel().catch(() => {});
    }, timeoutMs);
  });
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), timeout]);
      if (done) break;
      size += value.byteLength;
      if (size > maximum) {
        void reader.cancel().catch(() => {});
        throw new ApiError(413, 'too_large', 'A share can be at most 20 MiB.');
      }
      chunks.push(value);
    }
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}
