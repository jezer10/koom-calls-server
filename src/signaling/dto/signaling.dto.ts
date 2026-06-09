import { z } from 'zod';

export const callIdSchema = z
  .string()
  .min(1, 'callId must be a non-empty string');

export const userIdSchema = z
  .string()
  .min(1, 'userId must be a non-empty string');

export const callEventTypeSchema = z.enum([
  'call:ringing',
  'call:accept',
  'call:reject',
  'call:cancel',
  'call:end',
]);

export const webrtcSignalTypeSchema = z.enum([
  'webrtc:offer',
  'webrtc:answer',
  'webrtc:ice-candidate',
]);

export const sfuEventTypeSchema = z.enum([
  'sfu:join-room',
  'sfu:publish-track',
  'sfu:subscribe-track',
]);

export const callInvitePayloadSchema = z.object({
  callId: callIdSchema,
  from: userIdSchema,
  to: z.array(userIdSchema).min(1, 'call:invite must target at least one user'),
  type: z.literal('audio').or(z.literal('video')),
});

export const callEventPayloadSchema = z.object({
  callId: callIdSchema,
});

export const webrtcSignalPayloadSchema = z.object({
  callId: callIdSchema,
  to: userIdSchema,
  signal: z.unknown(),
});

export const sfuPayloadSchema = z.object({
  callId: callIdSchema,
  room: z.string().min(1).optional(),
  trackId: z.string().min(1).optional(),
});

export const callInviteForUserSchema = z.object({
  callId: callIdSchema,
  from: userIdSchema,
  type: z.literal('audio').or(z.literal('video')),
});

export type CallInvitePayload = z.infer<typeof callInvitePayloadSchema>;
export type CallEventPayload = z.infer<typeof callEventPayloadSchema>;
export type WebrtcSignalPayload = z.infer<typeof webrtcSignalPayloadSchema>;
export type SfuPayload = z.infer<typeof sfuPayloadSchema>;
export type CallInviteForUser = z.infer<typeof callInviteForUserSchema>;

export interface ParsedPayload<T> {
  ok: true;
  value: T;
}

export interface FailedPayload {
  ok: false;
  reason: string;
}

export type ParseResult<T> = ParsedPayload<T> | FailedPayload;

function formatZodError(err: z.ZodError): string {
  const issues = err.issues
    .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
    .join('; ');
  return issues || err.message;
}

export function parseCallInvitePayload(
  value: unknown,
): ParseResult<CallInvitePayload> {
  const result = callInvitePayloadSchema.safeParse(value);
  if (!result.success) {
    return { ok: false, reason: formatZodError(result.error) };
  }
  return { ok: true, value: result.data };
}

export function parseCallRingingPayload(
  value: unknown,
): ParseResult<CallEventPayload> {
  return parseGenericCallEvent(value, 'call:ringing');
}

export function parseCallAcceptPayload(
  value: unknown,
): ParseResult<CallEventPayload> {
  return parseGenericCallEvent(value, 'call:accept');
}

export function parseCallRejectPayload(
  value: unknown,
): ParseResult<CallEventPayload> {
  return parseGenericCallEvent(value, 'call:reject');
}

export function parseCallCancelPayload(
  value: unknown,
): ParseResult<CallEventPayload> {
  return parseGenericCallEvent(value, 'call:cancel');
}

export function parseCallEndPayload(
  value: unknown,
): ParseResult<CallEventPayload> {
  return parseGenericCallEvent(value, 'call:end');
}

function parseGenericCallEvent(
  value: unknown,
  eventType: string,
): ParseResult<CallEventPayload> {
  const result = callEventPayloadSchema.safeParse(value);
  if (!result.success) {
    return { ok: false, reason: formatZodError(result.error) };
  }
  void eventType;
  return { ok: true, value: result.data };
}

export function parseWebrtcOfferPayload(
  value: unknown,
): ParseResult<WebrtcSignalPayload> {
  return parseWebrtcSignal(value, 'webrtc:offer');
}

export function parseWebrtcAnswerPayload(
  value: unknown,
): ParseResult<WebrtcSignalPayload> {
  return parseWebrtcSignal(value, 'webrtc:answer');
}

export function parseWebrtcIceCandidatePayload(
  value: unknown,
): ParseResult<WebrtcSignalPayload> {
  return parseWebrtcSignal(value, 'webrtc:ice-candidate');
}

function parseWebrtcSignal(
  value: unknown,
  eventType: string,
): ParseResult<WebrtcSignalPayload> {
  const result = webrtcSignalPayloadSchema.safeParse(value);
  if (!result.success) {
    return { ok: false, reason: formatZodError(result.error) };
  }
  void eventType;
  return { ok: true, value: result.data };
}

export function parseSfuJoinRoomPayload(
  value: unknown,
): ParseResult<SfuPayload> {
  return parseSfu(value, 'sfu:join-room');
}

export function parseSfuPublishTrackPayload(
  value: unknown,
): ParseResult<SfuPayload> {
  return parseSfu(value, 'sfu:publish-track');
}

export function parseSfuSubscribeTrackPayload(
  value: unknown,
): ParseResult<SfuPayload> {
  return parseSfu(value, 'sfu:subscribe-track');
}

function parseSfu(value: unknown, eventType: string): ParseResult<SfuPayload> {
  const result = sfuPayloadSchema.safeParse(value);
  if (!result.success) {
    return { ok: false, reason: formatZodError(result.error) };
  }
  void eventType;
  return { ok: true, value: result.data };
}
