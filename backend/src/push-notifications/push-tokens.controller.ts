import { Body, Controller, Delete, HttpCode, Post, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { PushNotificationService } from './push-notifications.service';

// No @RequirePermission — every authenticated user, regardless of role or
// permissions, registers/unregisters their own device's token.
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('push-tokens')
export class PushTokensController {
  constructor(private readonly pushNotifications: PushNotificationService) {}

  @Post()
  @HttpCode(204)
  register(@Body() dto: RegisterPushTokenDto, @CurrentUser() user: AuthenticatedUser) {
    return this.pushNotifications.registerToken(user.id, dto.token);
  }

  @Delete()
  @HttpCode(204)
  unregister(@Body() dto: RegisterPushTokenDto, @CurrentUser() user: AuthenticatedUser) {
    return this.pushNotifications.unregisterToken(user.id, dto.token);
  }
}
