import type { ApiResponse } from './generated/api';

export type ApiHeaders = Headers | Record<string, string> | string[][];

export interface ApiClientResponse<T = unknown> {
  data: ApiResponse<T>;
  error: null | {
    status: number;
    value: unknown;
  };
  response: Response;
  status: number;
  headers?: ApiHeaders;
}
