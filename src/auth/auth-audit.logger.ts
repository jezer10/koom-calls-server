import { Injectable, Logger } from '@nestjs/common';

export type AuthEventType =
  | 'auth.login_success'
  | 'auth.login_failed'
  | 'auth.dev_login_success'
  | 'auth.dev_login_disabled'
  | 'auth.oauth_start'
  | 'auth.oauth_callback_success'
  | 'auth.oauth_callback_failed'
  | 'auth.anonymous_login_success'
  | 'auth.logout';

export interface AuthAuditEvent {
  event: AuthEventType;
  provider?: string;
  userId?: string;
  reason?: string;
  ip?: string;
}

const REDACTED_KEYS = new Set([
  'email',
  'sub',
  'providerSub',
  'name',
  'picture',
  'idToken',
  'token',
  'authorization',
]);

function redact(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((v) => redact(v, seen));
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (REDACTED_KEYS.has(k)) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = redact(v, seen);
    }
  }
  return out;
}

@Injectable()
export class AuthAuditLogger {
  private readonly logger = new Logger('AuthAudit');

  log(event: AuthAuditEvent): void {
    const safe = redact(event);
    const line = JSON.stringify({
      at: new Date().toISOString(),
      ...(safe as object),
    });
    this.logger.log(line);
  }
}
