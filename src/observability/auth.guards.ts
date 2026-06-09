import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/authenticated-user';

export type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return Boolean(resolveUserId(req));
  }
}

@Injectable()
export class AdminAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = req.user;
    if (!user) return false;
    if (user.isAdmin === true) return true;
    if (user.role === 'admin') return true;
    if (Array.isArray(user.roles) && user.roles.includes('admin')) return true;
    return false;
  }
}

export function resolveUserId(req: AuthenticatedRequest): string | undefined {
  if (!req.user) return undefined;
  return req.user.userId ?? req.user.sub;
}
