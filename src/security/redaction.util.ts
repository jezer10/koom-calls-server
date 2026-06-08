const REDACTED_KEYS: ReadonlySet<string> = new Set([
  'sdp',
  'iceCandidates',
  'candidate',
  'password',
  'token',
  'authorization',
  'auth',
  'jwt',
  'bearer',
  'secret',
  'apiKey',
  'api_key',
  'ice',
  'fingerprint',
]);

const DEFAULT_MAX_STRING_LENGTH = 256;

export interface RedactionOptions {
  maxStringLength?: number;
  extraRedactedKeys?: ReadonlySet<string>;
  redactionPlaceholder?: string;
}

export function redactPayload(
  payload: unknown,
  options: RedactionOptions = {},
): unknown {
  const maxLength = options.maxStringLength ?? DEFAULT_MAX_STRING_LENGTH;
  const placeholder = options.redactionPlaceholder ?? '[REDACTED]';
  const keys = options.extraRedactedKeys
    ? new Set([...REDACTED_KEYS, ...options.extraRedactedKeys])
    : REDACTED_KEYS;

  return walk(payload, keys, maxLength, placeholder, new WeakSet());
}

function walk(
  value: unknown,
  redactedKeys: ReadonlySet<string>,
  maxLength: number,
  placeholder: string,
  seen: WeakSet<object>,
): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return truncate(value, maxLength);
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return value;
  }
  if (typeof value === 'function' || typeof value === 'symbol') {
    return undefined;
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) return '[CIRCULAR]';
    seen.add(value);
    const result = value.map((entry) =>
      walk(entry, redactedKeys, maxLength, placeholder, seen),
    );
    seen.delete(value);
    return result;
  }
  if (typeof value === 'object') {
    if (seen.has(value)) return '[CIRCULAR]';
    seen.add(value);
    const out: Record<string, unknown> = {};
    const obj = value as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      if (redactedKeys.has(key)) {
        out[key] = placeholder;
      } else {
        out[key] = walk(obj[key], redactedKeys, maxLength, placeholder, seen);
      }
    }
    seen.delete(value);
    return out;
  }
  return undefined;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const suffix = '…';
  const headroom = Math.max(0, maxLength - suffix.length);
  return value.slice(0, headroom) + suffix;
}

export function isRedactedKey(key: string): boolean {
  return REDACTED_KEYS.has(key);
}

export const __test__ = { truncate, REDACTED_KEYS, DEFAULT_MAX_STRING_LENGTH };
