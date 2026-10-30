import { ConsoleLogger } from '@nestjs/common';

export class ApplicationLogger extends ConsoleLogger {
  override error(message: unknown, ..._optionalParams: unknown[]) {
    // Nest may pass raw initialization errors, including driver details, here.
    // Only our bounded HTTP status/code fields may be retained.
    const status = typeof message === 'object' && message !== null && 'statusCode' in message
      && typeof message.statusCode === 'number' ? message.statusCode : 500;
    super.error({ event: 'application_error', statusCode: status,
      message: 'Application operation failed; check configuration and readiness.' });
  }
}
