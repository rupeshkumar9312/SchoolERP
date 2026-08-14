import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PushNotificationService } from './push-notifications.service';
import { PushTokensController } from './push-tokens.controller';

@Module({
  imports: [AuthModule],
  controllers: [PushTokensController],
  providers: [PushNotificationService],
  exports: [PushNotificationService],
})
export class PushNotificationsModule {}
