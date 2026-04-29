import { HttpException, HttpStatus } from '@nestjs/common';
import { RES_CODE, type ResCodeValue } from '@lingdian/common';

export class AppException extends HttpException {
  constructor(
    public readonly businessCode: ResCodeValue,
    message: string,
    status = HttpStatus.BAD_REQUEST,
    public readonly payload: unknown = null,
  ) {
    super(message, status);
  }
}

export class ParamException extends AppException {
  constructor(message: string, payload: unknown = null) {
    super(RES_CODE.PARAM_INVALID, message, HttpStatus.BAD_REQUEST, payload);
  }
}

export class BusinessException extends AppException {
  constructor(message: string, payload: unknown = null) {
    super(RES_CODE.BUSINESS_ERROR, message, HttpStatus.BAD_REQUEST, payload);
  }
}

export class ResourceNotFoundException extends AppException {
  constructor(message = 'Resource not found', payload: unknown = null) {
    super(
      RES_CODE.RESOURCE_NOT_FOUND,
      message,
      HttpStatus.NOT_FOUND,
      payload,
    );
  }
}

export class StatusConflictException extends AppException {
  constructor(message: string, payload: unknown = null) {
    super(RES_CODE.STATUS_CONFLICT, message, HttpStatus.CONFLICT, payload);
  }
}
