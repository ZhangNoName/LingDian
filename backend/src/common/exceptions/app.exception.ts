import { HttpException, HttpStatus } from '@nestjs/common';
import { ResponseCode, type ResponseCodeValue } from '../constants/response-code';

export class AppException extends HttpException {
  constructor(
    public readonly businessCode: ResponseCodeValue,
    message: string,
    status = HttpStatus.BAD_REQUEST,
    public readonly payload: unknown = null,
  ) {
    super(message, status);
  }
}

export class ParamException extends AppException {
  constructor(message: string, payload: unknown = null) {
    super(ResponseCode.PARAM_INVALID, message, HttpStatus.BAD_REQUEST, payload);
  }
}

export class BusinessException extends AppException {
  constructor(message: string, payload: unknown = null) {
    super(ResponseCode.BUSINESS_ERROR, message, HttpStatus.BAD_REQUEST, payload);
  }
}

export class ResourceNotFoundException extends AppException {
  constructor(message = 'Resource not found', payload: unknown = null) {
    super(
      ResponseCode.RESOURCE_NOT_FOUND,
      message,
      HttpStatus.NOT_FOUND,
      payload,
    );
  }
}

export class StatusConflictException extends AppException {
  constructor(message: string, payload: unknown = null) {
    super(ResponseCode.STATUS_CONFLICT, message, HttpStatus.CONFLICT, payload);
  }
}
