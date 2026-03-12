/**
 * Create a Request that can forward a readable body stream.
 *
 * The Fetch runtime requires `duplex: 'half'` when proxying a streaming body,
 * but `RequestInit` does not expose that field yet. Keeping the narrower
 * intersection type here isolates the workaround outside route logic.
 */
type StreamingRequestInit = RequestInit & {
  duplex: 'half';
};

export function createStreamingRequest(
  url: string,
  init: RequestInit
): Request {
  const requestInit: StreamingRequestInit = {
    ...init,
    duplex: 'half'
  };

  return new Request(url, requestInit);
}
