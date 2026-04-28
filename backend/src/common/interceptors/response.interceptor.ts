import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  ResponseCode,
  type ResponseEnvelope,
} from '../constants/response-code';

function isResponseEnvelope<T>(
  value: unknown,
): value is ResponseEnvelope<T> {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'code' in value &&
      'msg' in value &&
      'data' in value,
  );
}

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ResponseEnvelope<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ResponseEnvelope<T>> {
    return next.handle().pipe(
      map((data) => {
        if (isResponseEnvelope<T>(data)) {
          return data;
        }

        return {
          code: ResponseCode.SUCCESS,
          msg: 'success',
          data,
        };
      }),
    );
  }
}
