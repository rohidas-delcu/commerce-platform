import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from "@nestjs/common";
import { DomainError } from "../domain/commerce.js";

const statusByCode = { INVALID: 400, CONFLICT: 409, NOT_FOUND: 404, FORBIDDEN: 403 };
const codeByStatus: Record<number, string> = {
  400: 'INVALID', 401: 'UNAUTHORIZED', 403: 'FORBIDDEN', 404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED', 409: 'CONFLICT', 413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE', 429: 'RATE_LIMITED', 503: 'UNAVAILABLE'
};

@Catch()
export class DomainErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const status = error instanceof DomainError ? statusByCode[error.code]
      : error instanceof HttpException ? error.getStatus() : 500;
    const code = error instanceof DomainError ? error.code : codeByStatus[status] ?? 'INTERNAL';
    let message: string | string[] = 'Internal server error.';
    if (status < 500 && error instanceof DomainError) message = error.message;
    else if (error instanceof HttpException && status < 500) {
      const response = error.getResponse();
      message = typeof response === 'string' ? response
        : (response as { message?: string | string[] }).message ?? error.message;
    } else if (status === 503) message = 'Service unavailable.';
    if (status >= 500) {
      // Never log database URLs, SQL parameters, headers, bodies or raw exception messages.
      Logger.error({ event: 'request_failed', statusCode: status, code }, undefined, 'Http');
    }
    host.switchToHttp().getResponse().status(status).json({ statusCode: status, code, message });
  }
}
