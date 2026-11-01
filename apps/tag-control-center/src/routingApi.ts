export type RoutingFeature = {
  id: string;
  type: "redirect" | "image" | "json";
  enabled: true;
  references: Record<"tag" | "pool" | "range" | "group", number>;
  [key: string]: unknown;
};

export type RoutingAssignment = { scope: string; targetId: string; featureIds: string[] };
export type RoutingOutboxEvent = {
  eventId: string;
  projectionRevision: number;
  environment: string;
  operation: "publish" | "unpublish";
  status: "pending" | "processing" | "retryable" | "completed";
  attemptCount: number;
  errorClass: string | null;
  diff: unknown[];
  correlationId: string;
  publishedAt: string | null;
};

export type RoutingCatalog = {
  environment: string;
  supportedFeatureTypes: Array<"redirect" | "image" | "json">;
  supportedScopes: string[];
  features: RoutingFeature[];
  assignments: RoutingAssignment[];
  targets: Record<"groups" | "ranges" | "pools" | "tags", string[]>;
  outbox: RoutingOutboxEvent[];
};

export type RoutingPreview = {
  environment: string;
  baseRevision: number | null;
  documents: Record<string, unknown>;
  diff: unknown[];
};

type JsonRecord = Record<string, unknown>;
function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
async function payload(response: Response): Promise<unknown> {
  const body: unknown = await response.json();
  if (!response.ok) {
    const message = isRecord(body) && isRecord(body.errors) && Array.isArray(body.errors.request)
      ? body.errors.request[0]
      : undefined;
    throw new Error(typeof message === "string" ? message : "Die TCP-Verwaltungsaktion wurde abgelehnt.");
  }
  return body;
}
function record(value: unknown, message: string): JsonRecord {
  if (!isRecord(value)) throw new Error(message);
  return value;
}

export function createRoutingApi(tcpBaseUrl: string, csrfToken: () => Promise<string>) {
  const base = `${tcpBaseUrl}/api/v1/admin/routing`;
  async function get(path: string): Promise<unknown> {
    const response = await fetch(`${base}${path}`, { credentials: "include", headers: { Accept: "application/json" } });
    return payload(response);
  }
  async function mutation(path: string, method: "POST" | "PUT", body: unknown, idempotencyKey: string): Promise<unknown> {
    const token = await csrfToken();
    const response = await fetch(`${base}${path}`, {
      method,
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": token,
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(body),
    });
    return payload(response);
  }

  return {
    async catalog(): Promise<RoutingCatalog> {
      const value = record(await get("/catalog"), "Ungültiger TCP-Routingkatalog.");
      if (!Array.isArray(value.features) || !Array.isArray(value.assignments) || !Array.isArray(value.outbox) || !isRecord(value.targets)) {
        throw new Error("Unvollständiger TCP-Routingkatalog.");
      }
      return value as unknown as RoutingCatalog;
    },
    async preview(): Promise<RoutingPreview> {
      const value = record(await get("/projection/preview"), "Ungültige TCP-Projektionsvorschau.");
      if (!Array.isArray(value.diff) || !isRecord(value.documents)) throw new Error("Unvollständige TCP-Projektionsvorschau.");
      return value as unknown as RoutingPreview;
    },
    async saveFeature(featureId: string, definition: JsonRecord, key: string): Promise<unknown> {
      return mutation(`/features/${encodeURIComponent(featureId)}`, "PUT", { definition }, key);
    },
    async saveAssignment(scope: string, targetId: string, featureIds: string[], key: string): Promise<unknown> {
      return mutation(`/assignments/${encodeURIComponent(scope)}/${encodeURIComponent(targetId)}`, "PUT", { featureIds }, key);
    },
    async publish(key: string): Promise<RoutingOutboxEvent> {
      return record(await mutation("/projection/publish", "POST", {}, key), "Ungültiger Publish-Status.") as unknown as RoutingOutboxEvent;
    },
    async unpublish(key: string): Promise<RoutingOutboxEvent> {
      return record(await mutation("/projection/unpublish", "POST", {}, key), "Ungültiger Unpublish-Status.") as unknown as RoutingOutboxEvent;
    },
    async retry(eventId: string, key: string): Promise<RoutingOutboxEvent> {
      return record(await mutation(`/outbox/${encodeURIComponent(eventId)}/retry`, "POST", {}, key), "Ungültiger Retry-Status.") as unknown as RoutingOutboxEvent;
    },
  };
}
