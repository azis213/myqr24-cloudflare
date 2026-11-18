import { handleAppApiRequest, type AppApiEnv } from "./app-api";
import { seedLocalContent } from "./local-seed";

export interface LocalAppApiEnv extends AppApiEnv {
  APP_LOCAL_SEED_KEY: string;
}

const LOCAL_SEED_PATH = "/api/local/seed";

async function handleLocalRequest(request: Request, env: LocalAppApiEnv): Promise<Response> {
  const url = new URL(request.url);
  if (request.method !== "POST" || url.pathname !== LOCAL_SEED_PATH) {
    return handleAppApiRequest(request, env);
  }
  if (!env.APP_LOCAL_SEED_KEY || request.headers.get("x-myqr24-local-seed") !== env.APP_LOCAL_SEED_KEY) {
    return new Response("Not Found", { status: 404, headers: { "cache-control": "no-store" } });
  }

  await seedLocalContent(env);
  return Response.json({ ok: true, seeded: true }, { headers: { "cache-control": "no-store" } });
}

export default {
  fetch: handleLocalRequest,
} satisfies ExportedHandler<LocalAppApiEnv>;

