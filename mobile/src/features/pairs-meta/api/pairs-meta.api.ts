import type { PairsMetaResponse } from '@pulse/contracts';
import { env } from '@/core/config/env';

export class PairsMetaError extends Error {}

export async function fetchPairsMeta(timeoutMs = 8_000): Promise<PairsMetaResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${env.apiUrl}/pairs/meta`, { signal: controller.signal });
    if (!res.ok) throw new PairsMetaError(`Server responded ${res.status}`);
    const body = (await res.json()) as PairsMetaResponse;
    if (!Array.isArray(body?.pairs)) throw new PairsMetaError('Malformed response');
    return body;
  } catch (err) {
    if (err instanceof PairsMetaError) throw err;
    throw new PairsMetaError(controller.signal.aborted ? 'Request timed out' : 'Gateway unreachable');
  } finally {
    clearTimeout(timer);
  }
}
