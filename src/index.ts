/**
 * Bindings supplied by Cloudflare are declared here as the infrastructure grows.
 *
 * Example:
 * interface Env {
 *   TAGS: KVNamespace;
 * }
 */
export interface Env {}

export const handleRequest: ExportedHandlerFetchHandler<Env> = (
  request,
  _env,
  _ctx,
): Response => {
  const url = new URL(request.url);

  return Response.json({
    status: "ok",
    service: "myqr24-edge-router",
    path: url.pathname,
  });
};

const worker: ExportedHandler<Env> = {
  fetch: handleRequest,
};

export default worker;
