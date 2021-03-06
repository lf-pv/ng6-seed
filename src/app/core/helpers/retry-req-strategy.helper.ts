import { Observable, throwError, empty, timer } from 'rxjs';
import { mergeMap, finalize, tap, switchMap } from 'rxjs/operators';
import { IRetryReqOptions } from '@models/http.model';
export const retryReqStrategyHelper = ({
  maxRetryAttempts = 0,
  scalingDuration = 0,
  statusCodes = [],
  requestToWait = empty(),
}: IRetryReqOptions = {}) => (attempts: Observable<any>) => {
  return attempts.pipe(
    mergeMap((error, i) => {
      const retryAttempt = i + 1;
      // if maximum number of retries have been met
      // or response is a status code we don't wish to retry, throw error
      if (
        retryAttempt > maxRetryAttempts ||
        statusCodes.find(e => e === error.status)
      ) {
        return throwError(error);
      }
      console.log(
        `Attempt ${retryAttempt}: retrying in ${retryAttempt *
          scalingDuration}ms`,
      );
      // retry after 1s, 2s, etc...
      return timer(scalingDuration).pipe(
        switchMap(() =>
          requestToWait.pipe(tap(data => console.log('data', data))),
        ),
      );
    }),
    finalize(() => console.log('Every retry attemps finished...')),
  );
};
