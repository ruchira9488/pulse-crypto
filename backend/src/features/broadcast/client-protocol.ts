import type { ClientMessage } from '@pulse/contracts';

export type ParseResult = { ok: true; message: ClientMessage } | { ok: false; error: string };

/** Validates an inbound client frame. Never throws; untrusted input. */
export function parseClientMessage(raw: string): ParseResult {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'invalid JSON' };
  }
  if (typeof value !== 'object' || value === null) return { ok: false, error: 'expected an object' };
  const msg = value as Record<string, unknown>;

  switch (msg.type) {
    case 'ping': {
      if (typeof msg.id !== 'number' || typeof msg.clientTime !== 'number') {
        return { ok: false, error: 'ping requires numeric id and clientTime' };
      }
      return { ok: true, message: { type: 'ping', id: msg.id, clientTime: msg.clientTime } };
    }
    case 'configure': {
      const out: ClientMessage = { type: 'configure' };
      if (msg.intervalMs !== undefined) {
        if (typeof msg.intervalMs !== 'number' || !Number.isFinite(msg.intervalMs)) {
          return { ok: false, error: 'intervalMs must be a number' };
        }
        out.intervalMs = msg.intervalMs;
      }
      for (const key of ['adaptive', 'compress'] as const) {
        if (msg[key] !== undefined) {
          if (typeof msg[key] !== 'boolean') return { ok: false, error: `${key} must be a boolean` };
          out[key] = msg[key];
        }
      }
      return { ok: true, message: out };
    }
    default:
      return { ok: false, error: `unknown message type "${String(msg.type)}"` };
  }
}
