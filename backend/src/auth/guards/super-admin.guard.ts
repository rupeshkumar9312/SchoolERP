import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../auth.types';
import { SUPER_ADMIN_ROLE } from '../roles.constants';

/** Run after JwtAuthGuard. Unlike PermissionGuard, this checks the role directly —
 * for routes that must stay off-limits even to Director/Principal/Admin's broad
 * "Management" permission set (e.g. audit logs). */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    if (request.user?.roleName !== SUPER_ADMIN_ROLE) {
      throw new ForbiddenException('Only a SUPER_ADMIN may access this resource');
    }
    return true;
  }
}
