import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import type { AuthenticatedUser } from '../auth/auth.types';

/** One line per request — method, path, status, duration, and who made the
 * call. Registered globally (see AppModule) so every controller gets this
 * for free instead of each service hand-rolling its own access logging.
 *
 * Runs after guards in the Nest pipeline, so `req.user` is already set for
 * authenticated routes. Uses `catchError` (not just `tap`) so failed
 * requests are logged too — Nest's default exception handling only logs
 * *unexpected* (non-HttpException) errors, so without this, a deliberate
 * 400/403/404/409 throw would leave no trace in the logs at all. */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  // High-frequency uptime probes hit this on a tight interval — logging
  // every ping would drown out everything else without adding any value.
  private static readonly SILENT_PATHS = ['/health/live'];

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const res = context.switchToHttp().getResponse<Response>();
    const { method, originalUrl } = req;

    if (LoggingInterceptor.SILENT_PATHS.some((p) => originalUrl.endsWith(p))) {
      return next.handle();
    }

    const start = Date.now();

    return next.handle().pipe(
      tap(() => this.log(method, originalUrl, res.statusCode, start, req.user)),
      catchError((error: unknown) => {
        const status = this.statusOf(error);
        this.log(method, originalUrl, status, start, req.user);
        return throwError(() => error);
      }),
    );
  }

  private statusOf(error: unknown): number {
    if (error && typeof (error as { getStatus?: unknown }).getStatus === 'function') {
      return (error as { getStatus: () => number }).getStatus();
    }
    return 500;
  }

  private log(
    method: string,
    url: string,
    status: number,
    start: number,
    user: AuthenticatedUser | undefined,
  ): void {
    const durationMs = Date.now() - start;
    const who = user ? `user=${user.id}(${user.roleName})` : 'user=anon';
    const line = `${method} ${url} ${status} ${durationMs}ms ${who}`;
    if (status >= 500) this.logger.error(line);
    else if (status >= 400) this.logger.warn(line);
    else this.logger.log(line);
  }
}
