import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from "@nestjs/common";
import { DomainError } from "../domain/commerce.js";

@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter {
  catch(error: DomainError, host: ArgumentsHost) {
    const code = {
      INVALID: HttpStatus.BAD_REQUEST,
      CONFLICT: HttpStatus.CONFLICT,
      NOT_FOUND: HttpStatus.NOT_FOUND,
      FORBIDDEN: HttpStatus.FORBIDDEN
    }[error.code];
    host.switchToHttp().getResponse().status(code).json({ statusCode: code, code: error.code, message: error.message });
  }
}
