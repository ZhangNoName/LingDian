import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  RES_CODE,
  isResponseEnvelope,
  type ResponseEnvelope,
} from '@lingdian/common';

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
          code: RES_CODE.SUCCESS,
          msg: 'success',
          data,
        };
      }),
    );
  }
}
