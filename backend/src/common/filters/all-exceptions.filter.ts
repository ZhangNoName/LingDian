import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  RES_CODE,
  type ResCodeValue,
} from '@lingdian/common';
import { AppException } from '../exceptions/app.exception';

type ErrorResponseBody = {
  code: ResCodeValue;
  msg: string;
  data: unknown;
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<{
      status: (statusCode: number) => {
        json: (body: ErrorResponseBody) => void;
      };
    }>();
    const request = ctx.getRequest<{ method?: string; url?: string }>();

    const { status, body } = this.normalizeException(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : JSON.stringify(exception),
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.url} -> ${body.msg}`,
      );
    }

    response.status(status).json(body);
  }

  private normalizeException(exception: unknown): {
    status: number;
    body: ErrorResponseBody;
  } {
    if (exception instanceof AppException) {
      return {
        status: exception.getStatus(),
        body: {
          code: exception.businessCode,
          msg: exception.message,
          data: exception.payload,
        },
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.handlePrismaKnownError(exception);
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        body: {
          code: RES_CODE.PARAM_INVALID,
          msg: 'Database query validation failed',
          data: null,
        },
      };
    }

    if (exception instanceof Prisma.PrismaClientInitializationError) {
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        body: {
          code: RES_CODE.DATABASE_ERROR,
          msg: 'Database connection initialization failed',
          data: null,
        },
      };
    }

    if (exception instanceof Prisma.PrismaClientRustPanicError) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        body: {
          code: RES_CODE.DATABASE_ERROR,
          msg: 'Database engine error',
          data: null,
        },
      };
    }

    if (exception instanceof HttpException) {
      return this.handleHttpException(exception);
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        code: RES_CODE.INTERNAL_ERROR,
        msg: 'Internal server error',
        data: null,
      },
    };
  }

  private handleHttpException(exception: HttpException) {
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();
    const extracted = this.extractHttpMessage(exceptionResponse);

    const codeMap: Partial<Record<number, ResCodeValue>> = {
      [HttpStatus.BAD_REQUEST]: RES_CODE.BUSINESS_ERROR,
      [HttpStatus.UNAUTHORIZED]: RES_CODE.UNAUTHORIZED,
      [HttpStatus.FORBIDDEN]: RES_CODE.FORBIDDEN,
      [HttpStatus.NOT_FOUND]: RES_CODE.RESOURCE_NOT_FOUND,
      [HttpStatus.CONFLICT]: RES_CODE.STATUS_CONFLICT,
      [HttpStatus.UNPROCESSABLE_ENTITY]: RES_CODE.PARAM_INVALID,
    };

    return {
      status,
      body: {
        code: extracted.isValidationError
          ? RES_CODE.PARAM_INVALID
          : codeMap[status] ?? RES_CODE.BUSINESS_ERROR,
        msg: extracted.message,
        data: extracted.data,
      },
    };
  }

  private handlePrismaKnownError(
    exception: Prisma.PrismaClientKnownRequestError,
  ) {
    const prismaCodeMap: Partial<
      Record<
        string,
        { status: number; code: ResCodeValue; msg: string }
      >
    > = {
      P2002: {
        status: HttpStatus.CONFLICT,
        code: RES_CODE.DATABASE_CONSTRAINT_ERROR,
        msg: 'Database unique constraint violation',
      },
      P2003: {
        status: HttpStatus.BAD_REQUEST,
        code: RES_CODE.DATABASE_CONSTRAINT_ERROR,
        msg: 'Database foreign key constraint violation',
      },
      P2022: {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        code: RES_CODE.DATABASE_ERROR,
        msg: 'Database column does not exist or schema is out of sync',
      },
      P2025: {
        status: HttpStatus.NOT_FOUND,
        code: RES_CODE.DATABASE_RECORD_NOT_FOUND,
        msg: 'Database record not found',
      },
    };

    const matched = prismaCodeMap[exception.code];

    return {
      status: matched?.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        code: matched?.code ?? RES_CODE.DATABASE_ERROR,
        msg: matched?.msg ?? 'Database request failed',
        data: {
          prismaCode: exception.code,
        },
      },
    };
  }

  private extractHttpMessage(response: string | object) {
    if (typeof response === 'string') {
      return {
        message: response,
        data: null,
        isValidationError: false,
      };
    }

    const responseObject = response as {
      message?: string | string[];
      error?: string;
      data?: unknown;
    };

    const message = Array.isArray(responseObject.message)
      ? responseObject.message.join('; ')
      : responseObject.message ?? responseObject.error ?? 'Request failed';

    return {
      message,
      data: responseObject.data ?? null,
      isValidationError: Array.isArray(responseObject.message),
    };
  }
}
