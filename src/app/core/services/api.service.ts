// ng
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
// npm
import { Observable, defer, throwError } from 'rxjs';
import { catchError, retryWhen, tap } from 'rxjs/operators';
//  values
import { environment } from '@env/environment';
import { retryReqStrategy } from '@app/core/values/retry-req-strategy.value';
// models
import { IFlatObject, IStrObject } from '@models/common.model';
import {
  EMethods,
  EMethodsWithBody,
  IReqOptions,
  IReqParams,
  IReqParamsWithBody,
  TAuthorizedMethods,
} from '@models/http.model';

@Injectable()
export class ApiService {
  private _defaultContentType = 'application/json';
  constructor(private http: HttpClient) {}

  // requests with body
  post<T>(options: IReqParamsWithBody<T>): Observable<T> {
    return this.request<T>('post', options);
  }
  put<T>(options: IReqParamsWithBody<T>): Observable<T> {
    return this.request<T>('put', options);
  }
  patch<T>(options: IReqParamsWithBody<T>): Observable<T> {
    return this.request<T>('patch', options);
  }

  // request without body
  get<T>(options: IReqParams): Observable<T> {
    return this.request<T>('get', options);
  }
  delete<T>(options: IReqParams): Observable<T> {
    return this.request<T>('delete', options);
  }
  head<T>(options: IReqParams): Observable<T> {
    return this.request<T>('head', options);
  }

  request<T>(
    method: TAuthorizedMethods,
    {
      url,
      auth,
      queryParams,
      apiEnv,
      headers,
      retryOptions,
      ...options
    }: IReqParams | IReqParamsWithBody<T>,
  ): Observable<T> {
    // prepare url
    url = (apiEnv || environment.config.mainApiUrl) + url;
    // check method
    const reqMethod = EMethods[method] || EMethodsWithBody[method];
    if (!reqMethod) {
      return this._throwReactiveError(
        new Error(`${method} is not a valid HTTP method`),
      ) as Observable<any>;
    }

    // prepare options
    const httpRequestOptions: IReqOptions = {
      headers: this._createHeaders(headers, auth),
    };
    if (queryParams) {
      httpRequestOptions.params = this._createQueryParams(queryParams);
    }
    if (EMethodsWithBody[method]) {
      httpRequestOptions.body = (options as IReqParamsWithBody<T>).body;
    }

    // some routes could need a retry action
    // for example, a "refresh token" action in case of 403 / 401
    if (retryOptions && retryOptions.requestToWait) {
      retryOptions.requestToWait.pipe(
        tap((newHeaders: IFlatObject) => {
          // here, we clone & update headers with a new headers options
          httpRequestOptions.headers = new HttpHeaders({
            ...httpRequestOptions.headers,
            ...newHeaders,
          });
        }),
      );
    }

    // do request, retry if needed, and catch any error as observable
    // defer is needed to allow params change  during retryWhen rxjs action
    return defer(
      () =>
        this.http.request(reqMethod, url, httpRequestOptions) as Observable<T>,
    ).pipe(
      retryWhen(retryReqStrategy(retryOptions || {})),
      catchError(this._throwReactiveError),
    );
  }

  private _createQueryParams(queryParams: IStrObject): HttpParams {
    return queryParams ? new HttpParams({ fromObject: queryParams }) : null;
  }

  private _createHeaders(
    headers: IStrObject = {},
    auth?: boolean,
  ): HttpHeaders {
    // basic header + custom
    const httpHeaders: IStrObject = {
      'Content-Type': this._defaultContentType,
      ...headers,
    };

    // add auth
    const token: string = window.localStorage.getItem('token');
    if (auth && token) {
      httpHeaders['Authorization'] = 'Bearer ' + token;
    }

    return new HttpHeaders(httpHeaders);
  }

  private _throwReactiveError(error: any): Observable<never> {
    console.error('api.service::throwReactiveError', error);
    return throwError(error);
  }
}
