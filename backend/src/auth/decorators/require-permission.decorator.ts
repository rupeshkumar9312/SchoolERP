import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'requiredPermission';

/** Use with `@UseGuards(JwtAuthGuard, PermissionGuard)` on a route or controller. */
export const RequirePermission = (permission: string) => SetMetadata(PERMISSION_KEY, permission);
