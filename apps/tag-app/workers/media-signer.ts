export interface MediaSignerEnv {
  APP_MEDIA_SIGNER_KEY_S01: string;
}

/**
 * Service-binding only. The Application API authorizes TAG, element and item
 * first and sends an already derived object key. This worker must never accept
 * a client-supplied bucket, key or path.
 */
export async function handleMediaSignerRequest(request: Request, env: MediaSignerEnv): Promise<Response> {
  if (request.method !== "POST" || request.headers.get("x-myqr24-service-key") !== env.APP_MEDIA_SIGNER_KEY_S01) {
    return new Response("Not Found", { status: 404, headers: { "cache-control": "no-store" } });
  }
  // The real S3-compatible R2 presigning implementation requires separately
  // provisioned server credentials. It is intentionally not activated in this
  // local slice; callers still exercise the service-binding boundary.
  return new Response("Not Found", { status: 404, headers: { "cache-control": "no-store" } });
}

export default { fetch: handleMediaSignerRequest } satisfies ExportedHandler<MediaSignerEnv>;