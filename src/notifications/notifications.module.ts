import { Module } from '@nestjs/common';
import { NoopNotificationsService } from './notifications.service';
import { NOTIFICATIONS_SERVICE } from './notifications.service.interface';

@Module({
  providers: [
    NoopNotificationsService,
    { provide: NOTIFICATIONS_SERVICE, useExisting: NoopNotificationsService },
  ],
  exports: [NOTIFICATIONS_SERVICE, NoopNotificationsService],
})
export class NotificationsModule {}
