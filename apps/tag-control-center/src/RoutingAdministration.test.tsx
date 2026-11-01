import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RoutingAdministration } from "./RoutingAdministration";

const correlationId = "00000000-0000-4000-8000-000000000001";
function response(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: vi.fn().mockResolvedValue(body) } as unknown as Response;
}
function catalog() {
  return {
    environment: "staging",
    supportedFeatureTypes: ["redirect", "image", "json"],
    supportedScopes: ["tag", "pool", "range", "group"],
    features: [],
    assignments: [],
    targets: { groups: ["group-default"], ranges: ["range-six"], pools: ["pool-private"], tags: ["tag001"] },
    outbox: [],
    correlation_id: correlationId,
  };
}
function csrf() {
  return response({ csrf_token: "routing-csrf", correlation_id: correlationId });
}

describe("Routing administration TCP contract", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "00000000-0000-4000-8000-000000000099") });
  });
  function renderComponent() {
    return render(<RoutingAdministration tcpBaseUrl="/tcp" csrfToken={async () => "routing-csrf"} reauthenticated />);
  }

  it("saves a v1 feature only through the CSRF- and idempotency-protected TCP command", async () => {
    fetchMock.mockResolvedValueOnce(response({ feature: { id: "redirect-demo" } })).mockResolvedValueOnce(response(catalog()));
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByRole("button", { name: "Feature speichern" }));

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/tcp/api/v1/admin/routing/features/redirect-demo", expect.objectContaining({
      method: "PUT",
      headers: expect.objectContaining({ "X-CSRF-TOKEN": "routing-csrf", "Idempotency-Key": "00000000-0000-4000-8000-000000000099" }),
    }));
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as { definition: { id: string; type: string } };
    expect(body.definition).toMatchObject({ id: "redirect-demo", type: "redirect" });
    expect(await screen.findByText("Feature wurde serverseitig validiert und gespeichert.")).toBeVisible();
  });

  it("uses the pool scope without treating pool metadata as a projection document", async () => {
    fetchMock.mockResolvedValueOnce(response({ assignment: { scope: "pool" } })).mockResolvedValueOnce(response(catalog()));
    const user = userEvent.setup();
    renderComponent();
    await user.selectOptions(screen.getByLabelText("Zuweisungsebene"), "pool");
    await user.type(screen.getByLabelText("Ziel-ID"), "pool-private");
    await user.click(screen.getByRole("button", { name: "Zuweisung speichern" }));

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/tcp/api/v1/admin/routing/assignments/pool/pool-private", expect.objectContaining({
      method: "PUT",
      body: JSON.stringify({ featureIds: ["redirect-demo"] }),
    }));
  });

  it("renders the TCP-confirmed diff and retries the same outbox event", async () => {
    const pending = { ...catalog(), outbox: [{ eventId: "event-1", projectionRevision: 7, environment: "staging", operation: "publish", status: "retryable", attemptCount: 1, errorClass: "rate_limit", diff: [], correlationId, publishedAt: null }] };
    fetchMock
      .mockResolvedValueOnce(response(pending))
      .mockResolvedValueOnce(response({ environment: "staging", baseRevision: 6, documents: { "tag:60466176": { featureIds: ["redirect-demo"] } }, diff: [{ key: "tag:60466176", change: "changed", before: null, after: { featureIds: ["redirect-demo"] } }] }))
      .mockResolvedValueOnce(response({ eventId: "event-1", status: "completed", attemptCount: 2 }))
      .mockResolvedValueOnce(response(catalog()));
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByRole("button", { name: "Routing-Katalog laden" }));
    await user.click(await screen.findByRole("button", { name: "Projektionsdiff laden" }));
    expect(await screen.findByTestId("routing-diff")).toHaveTextContent("tag:60466176");
    await user.click(screen.getByRole("button", { name: "Retry event-1" }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/tcp/api/v1/admin/routing/outbox/event-1/retry", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "X-CSRF-TOKEN": "routing-csrf" }),
    }));
  });

  it("publishes only to the server-selected environment", async () => {
    fetchMock.mockResolvedValueOnce(response(catalog())).mockResolvedValueOnce(response({ eventId: "event-2", status: "completed", attemptCount: 1, environment: "staging" })).mockResolvedValueOnce(response(catalog()));
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByRole("button", { name: "Routing-Katalog laden" }));
    await user.click(await screen.findByRole("button", { name: "Fake-Publish ausführen" }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/tcp/api/v1/admin/routing/projection/publish", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({}),
    }));
    expect(String(fetchMock.mock.calls[1][0])).not.toContain("production");
  });
});
