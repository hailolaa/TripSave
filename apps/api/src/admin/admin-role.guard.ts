import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UsersService } from '../users/users.service';

/**
 * Guard that restricts access to admin-only endpoints.
 * Checks the user's role field from the database.
 * Must be used AFTER JwtAuthGuard (requires req.user to be set).
 */
@Injectable()
export class AdminRoleGuard implements CanActivate {
  constructor(private readonly usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userPayload = request.user;

    if (!userPayload?.email) {
      throw new ForbiddenException('Authentication required');
    }

    const user = await this.usersService.findOneByEmail(userPayload.email);
    if (!user || user.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
