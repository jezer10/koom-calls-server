export const NOTIFICATIONS_SERVICE = Symbol('NOTIFICATIONS_SERVICE');

export type NotificationEvent = string;

export type NotificationPayload = unknown;

export interface NotificationsService {
  notify(
    userId: string,
    event: NotificationEvent,
    payload: NotificationPayload,
  ): Promise<void>;
}
