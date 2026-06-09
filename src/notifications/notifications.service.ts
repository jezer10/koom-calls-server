import { Injectable, Logger } from '@nestjs/common';
import type {
  NotificationEvent,
  NotificationPayload,
  NotificationsService,
} from './notifications.service.interface';

@Injectable()
export class NoopNotificationsService implements NotificationsService {
  private readonly logger = new Logger(NoopNotificationsService.name);

  notify(
    userId: string,
    event: NotificationEvent,
    payload: NotificationPayload,
  ): Promise<void> {
    this.logger.debug(
      `[noop] notify(user=${userId} event=${event} payload=${JSON.stringify(payload)})`,
    );
    return Promise.resolve();
  }
}
