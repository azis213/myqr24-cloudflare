import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

type MockResponse = {
  ok: boolean;
  status: number;
  body: unknown;
};

const correlationId = "00000000-0000-4000-8000-000000000001";

function jsonResponse({ ok, status, body }: MockResponse): Response {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function sessionResponse(authenticated = false): Response {
  return jsonResponse({
    ok: true,
    status: 200,
    body: {
      authenticated,
      user: authenticated
        ? { email: "admin@example.test", role: "platform-admin" }
        : null,
      correlation_id: correlationId,
    },
  });
}

describe("TAG Control Center admin auth contract", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("alert", vi.fn());
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => "00000000-0000-4000-8000-000000000099"),
    });
  });

  it("starts signed out and reads only the authoritative TCP session", async () => {
    fetchMock.mockResolvedValueOnce(sessionResponse());

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Administrationsanmeldung" })).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith(
      "/tcp/api/v1/auth/session",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("sends credentials only in the CSRF-protected login request and clears the password after MFA is requested", async () => {
    fetchMock
      .mockResolvedValueOnce(sessionResponse())
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          status: 200,
          body: { csrf_token: "csrf-token", correlation_id: correlationId },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          status: 200,
          body: { status: "mfa_required", correlation_id: correlationId },
        }),
      );

    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText("E-Mail-Adresse"), "admin@example.test");
    await user.type(screen.getByLabelText("Passwort"), "browser-only-password");
    await user.click(screen.getByRole("button", { name: "Anmelden" }));

    expect(await screen.findByLabelText("E-Mail-Sicherheitscode")).toBeVisible();
    expect(screen.queryByLabelText("Passwort")).not.toBeInTheDocument();

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/tcp/api/v1/auth/csrf",
      expect.objectContaining({ credentials: "include" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/tcp/api/v1/auth/login",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": "csrf-token",
        }),
        body: JSON.stringify({
          email: "admin@example.test",
          password: "browser-only-password",
        }),
      }),
    );

    expect(screen.queryByDisplayValue("browser-only-password")).not.toBeInTheDocument();
  });

  it("shows the normalized login failure without treating the user as authenticated", async () => {
    fetchMock
      .mockResolvedValueOnce(sessionResponse())
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          status: 200,
          body: { csrf_token: "csrf-token", correlation_id: correlationId },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: false,
          status: 422,
          body: {
            errors: {
              email: ["Die Anmeldedaten sind ungültig oder das Konto ist nicht aktiv."],
            },
          },
        }),
      );

    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText("E-Mail-Adresse"), "unknown@example.test");
    await user.type(screen.getByLabelText("Passwort"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Anmelden" }));

    expect(
      await screen.findByText("Die Anmeldedaten sind ungültig oder das Konto ist nicht aktiv."),
    ).toBeVisible();
    expect(screen.queryByText("Aktive Verwaltungssitzung")).not.toBeInTheDocument();
  });

  it("keeps MFA failures neutral, clears the code and only accepts the server-confirmed session", async () => {
    fetchMock
      .mockResolvedValueOnce(sessionResponse())
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          status: 200,
          body: { csrf_token: "csrf-token", correlation_id: correlationId },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          status: 200,
          body: { status: "mfa_required", correlation_id: correlationId },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          status: 200,
          body: { csrf_token: "csrf-token-2", correlation_id: correlationId },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: false,
          status: 422,
          body: {
            errors: {
              code: ["Der Sicherheitscode ist ungültig, abgelaufen oder wurde zu oft eingegeben."],
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          status: 200,
          body: { csrf_token: "csrf-token-3", correlation_id: correlationId },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          status: 200,
          body: {
            status: "authenticated",
            user: { email: "admin@example.test", role: "platform-admin" },
            correlation_id: correlationId,
          },
        }),
      );

    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText("E-Mail-Adresse"), "admin@example.test");
    await user.type(screen.getByLabelText("Passwort"), "browser-only-password");
    await user.click(screen.getByRole("button", { name: "Anmelden" }));

    const codeInput = await screen.findByLabelText("E-Mail-Sicherheitscode");
    await user.type(codeInput, "000000");
    await user.click(screen.getByRole("button", { name: "Sicherheitscode bestätigen" }));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        "Der Sicherheitscode ist ungültig, abgelaufen oder wurde zu oft eingegeben.",
      );
    });
    expect(screen.getByLabelText("E-Mail-Sicherheitscode")).toHaveValue("");
    expect(screen.queryByText("Aktive Verwaltungssitzung")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("E-Mail-Sicherheitscode"), "123456");
    await user.click(screen.getByRole("button", { name: "Sicherheitscode bestätigen" }));

    expect(await screen.findByText("admin@example.test")).toBeVisible();
    expect(screen.getByRole("button", { name: "Abmelden" })).toBeVisible();
  });

  it("clears local auth state only after issuing the CSRF-protected logout request", async () => {
    fetchMock
      .mockResolvedValueOnce(sessionResponse(true))
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          status: 200,
          body: { csrf_token: "csrf-token", correlation_id: correlationId },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          status: 200,
          body: { status: "logged_out", correlation_id: correlationId },
        }),
      );

    const user = userEvent.setup();
    render(<App />);

    await screen.findByText("admin@example.test");
    await user.click(screen.getByRole("button", { name: "Abmelden" }));

    expect(await screen.findByRole("heading", { name: "Administrationsanmeldung" })).toBeVisible();
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/tcp/api/v1/auth/logout",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: expect.objectContaining({ "X-CSRF-TOKEN": "csrf-token" }),
      }),
    );
  });

  it("loads only TCP-confirmed pools for an authenticated session and requires a selected pool", async () => {
    fetchMock
      .mockResolvedValueOnce(sessionResponse(true))
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          status: 200,
          body: {
            pools: [
              {
                poolId: "demo-pool",
                length: 6,
                active: true,
                rangeIds: ["demo-range"],
              },
            ],
            correlation_id: correlationId,
          },
        }),
      );

    const user = userEvent.setup();
    render(<App />);

    await screen.findByText("admin@example.test");
    expect(screen.getByText("Kritische Aktion freigeben")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Sichtbare Pools laden" }));

    expect(await screen.findByText("demo-pool")).toBeVisible();
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/tcp/api/v1/admin/tag-management/pools",
      expect.objectContaining({ credentials: "include" }),
    );

    await user.click(screen.getByRole("button", { name: "Reservierung vorbereiten" }));
    expect(await screen.findByText("Kritische Aktion freigeben")).toBeVisible();
  });

  it("renders only the pool records delivered by the TCP visibility boundary", async () => {
    fetchMock
      .mockResolvedValueOnce(sessionResponse(true))
      .mockResolvedValueOnce(jsonResponse({
        ok: true,
        status: 200,
        body: {
          pools: [{ poolId: "assigned-pool", length: 6, active: true, rangeIds: ["assigned-range"] }],
          correlation_id: correlationId,
        },
      }));

    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("admin@example.test");
    await user.click(screen.getByRole("button", { name: "Sichtbare Pools laden" }));

    expect(await screen.findByText("assigned-pool")).toBeVisible();
    expect(screen.queryByText("foreign-organization-pool")).not.toBeInTheDocument();
    expect(screen.queryByText("platform-pool")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/tcp/api/v1/admin/tag-management/pools",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("loads persisted tags only for the selected TCP-confirmed pool and offers the server-confirmed lifecycle command", async () => {
    fetchMock
      .mockResolvedValueOnce(sessionResponse(true))
      .mockResolvedValueOnce(jsonResponse({ ok: true, status: 200, body: { pools: [{ poolId: "demo-pool", length: 6, active: true, rangeIds: ["range-001"] }], correlation_id: correlationId } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, status: 200, body: { tags: [{ tagId: "abcdef", status: "draft", length: 6, codecVersion: "TEST-S01", createdAt: "2026-10-31T00:00:00.000000Z" }], correlation_id: correlationId } }));

    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("admin@example.test");
    await user.click(screen.getByRole("button", { name: "Sichtbare Pools laden" }));
    await user.click(await screen.findByRole("button", { name: "Persistierte TAGs laden" }));

    expect(await screen.findByText("abcdef")).toBeVisible();
    expect(screen.getByRole("button", { name: "Zur Prüfung einreichen" })).toBeVisible();
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/tcp/api/v1/admin/tag-management/pools/demo-pool/tags",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("submits range configuration only through the CSRF-protected TCP command", async () => {
    fetchMock
      .mockResolvedValueOnce(sessionResponse(true))
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          status: 200,
          body: { csrf_token: "reauth-csrf", correlation_id: correlationId },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          status: 200,
          body: { status: "reauthenticated", correlation_id: correlationId },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          status: 200,
          body: { csrf_token: "range-csrf", correlation_id: correlationId },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          status: 201,
          body: {
            range: {
              rangeId: "range-6-001",
              groupId: "group-001",
              length: 6,
              startValue: "60466176",
              endValue: "60466275",
              active: true,
            },
            correlation_id: correlationId,
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          status: 200,
          body: { ranges: [], correlation_id: correlationId },
        }),
      );

    const user = userEvent.setup();
    render(<App />);

    await screen.findByText("admin@example.test");
    await user.type(screen.getByLabelText("Passwort zur erneuten Authentisierung"), "browser-only-password");
    await user.click(screen.getByRole("button", { name: "Reservierung freigeben" }));
    await screen.findByText("Reservierung ist für diese Sitzung kurzzeitig freigegeben.");

    await user.type(screen.getByLabelText("Range-ID"), "range-6-001");
    await user.type(screen.getByLabelText("Gruppen-ID"), "group-001");
    await user.type(screen.getByLabelText("Startwert"), "60466176");
    await user.type(screen.getByLabelText("Endwert"), "60466275");
    await user.click(screen.getByRole("button", { name: "Range serverseitig anlegen" }));

    expect(await screen.findByText("Range wurde serverseitig angelegt.")).toBeVisible();
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "/tcp/api/v1/admin/tag-management/ranges",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: expect.objectContaining({
          "X-CSRF-TOKEN": "range-csrf",
          "Idempotency-Key": "00000000-0000-4000-8000-000000000099",
        }),
        body: JSON.stringify({
          rangeId: "range-6-001",
          groupId: "group-001",
          length: 6,
          startValue: "60466176",
          endValue: "60466275",
          active: true,
        }),
      }),
    );
  });

  it("updates a TCP-confirmed range only through the CSRF- and idempotency-protected PATCH command", async () => {
    fetchMock
      .mockResolvedValueOnce(sessionResponse(true))
      .mockResolvedValueOnce(jsonResponse({ ok: true, status: 200, body: { ranges: [{ rangeId: "range-6-001", groupId: "group-001", length: 6, startValue: "60466176", endValue: "60466275", active: true }], correlation_id: correlationId } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, status: 200, body: { csrf_token: "reauth-csrf", correlation_id: correlationId } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, status: 200, body: { status: "reauthenticated", correlation_id: correlationId } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, status: 200, body: { csrf_token: "range-patch-csrf", correlation_id: correlationId } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, status: 200, body: { range: { rangeId: "range-6-001" }, correlation_id: correlationId } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, status: 200, body: { ranges: [], correlation_id: correlationId } }));

    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("admin@example.test");
    await user.click(screen.getByRole("button", { name: "Ranges laden" }));
    await user.click(await screen.findByRole("button", { name: "Range bearbeiten" }));
    await user.type(screen.getByLabelText("Passwort zur erneuten Authentisierung"), "browser-only-password");
    await user.click(screen.getByRole("button", { name: "Reservierung freigeben" }));
    await user.click(screen.getByRole("button", { name: "Range serverseitig aktualisieren" }));

    expect(fetchMock).toHaveBeenNthCalledWith(6, "/tcp/api/v1/admin/tag-management/ranges/range-6-001", expect.objectContaining({ method: "PATCH", headers: expect.objectContaining({ "X-CSRF-TOKEN": "range-patch-csrf", "Idempotency-Key": "00000000-0000-4000-8000-000000000099" }) }));
  });

  it("creates a pool from TCP-confirmed ranges only after reauthentication", async () => {
    fetchMock
      .mockResolvedValueOnce(sessionResponse(true))
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          status: 200,
          body: { csrf_token: "reauth-csrf", correlation_id: correlationId },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          status: 200,
          body: { status: "reauthenticated", correlation_id: correlationId },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          status: 200,
          body: {
            ranges: [{
              rangeId: "range-6-001",
              groupId: "group-001",
              length: 6,
              startValue: "60466176",
              endValue: "60466275",
              active: true,
            }],
            correlation_id: correlationId,
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          status: 200,
          body: { csrf_token: "pool-csrf", correlation_id: correlationId },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          status: 201,
          body: {
            pool: {
              poolId: "pool-6-001",
              length: 6,
              active: true,
              rangeIds: ["range-6-001"],
            },
            correlation_id: correlationId,
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          status: 200,
          body: { pools: [], correlation_id: correlationId },
        }),
      );

    const user = userEvent.setup();
    render(<App />);

    await screen.findByText("admin@example.test");
    await user.type(screen.getByLabelText("Passwort zur erneuten Authentisierung"), "browser-only-password");
    await user.click(screen.getByRole("button", { name: "Reservierung freigeben" }));
    await screen.findByText("Reservierung ist für diese Sitzung kurzzeitig freigegeben.");

    await user.click(screen.getByRole("button", { name: "Ranges laden" }));
    await user.click(await screen.findByRole("checkbox", { name: "range-6-001" }));
    await user.type(screen.getByLabelText("Pool-ID"), "pool-6-001");
    await user.type(screen.getByLabelText("Anzeigename"), "Synthetic Pool");
    await user.click(screen.getByRole("button", { name: "Pool serverseitig anlegen" }));

    expect(await screen.findByText("Pool wurde serverseitig angelegt.")).toBeVisible();
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      "/tcp/api/v1/admin/tag-management/pools",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-CSRF-TOKEN": "pool-csrf",
          "Idempotency-Key": "00000000-0000-4000-8000-000000000099",
        }),
        body: JSON.stringify({
          poolId: "pool-6-001",
          organizationId: null,
          displayName: "Synthetic Pool",
          channel: "test",
          length: 6,
          rangeIds: ["range-6-001"],
          policyRef: "synthetic-policy",
          capacityWarningThreshold: 10,
          active: true,
        }),
      }),
    );
  });

  it("reauthenticates and reserves only through CSRF- and idempotency-protected TCP commands", async () => {
    fetchMock
      .mockResolvedValueOnce(sessionResponse(true))
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          status: 200,
          body: {
            pools: [
              {
                poolId: "demo-pool",
                length: 6,
                active: true,
                rangeIds: ["demo-range"],
              },
            ],
            correlation_id: correlationId,
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          status: 200,
          body: { csrf_token: "reauth-csrf", correlation_id: correlationId },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          status: 200,
          body: { status: "reauthenticated", correlation_id: correlationId },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          status: 200,
          body: { csrf_token: "reservation-csrf", correlation_id: correlationId },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          status: 201,
          body: {
            job_id: "00000000-0000-4000-8000-000000000010",
            tags: [{ id: "abcdef", length: 6, value: "100000", codecVersion: "TEST-S01" }],
            correlation_id: correlationId,
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          status: 200,
          body: { pools: [], correlation_id: correlationId },
        }),
      );

    const user = userEvent.setup();
    render(<App />);

    await screen.findByText("admin@example.test");
    await user.click(screen.getByRole("button", { name: "Sichtbare Pools laden" }));
    await user.click(await screen.findByRole("button", { name: "Reservierung vorbereiten" }));
    await user.type(screen.getByLabelText("Passwort zur erneuten Authentisierung"), "browser-only-password");
    await user.click(screen.getByRole("button", { name: "Reservierung freigeben" }));

    expect(await screen.findByRole("button", { name: "Jetzt reservieren" })).toBeVisible();
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "/tcp/api/v1/auth/tag-management/reauthenticate",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "X-CSRF-TOKEN": "reauth-csrf" }),
        body: JSON.stringify({ password: "browser-only-password" }),
      }),
    );

    await user.click(screen.getByRole("button", { name: "Jetzt reservieren" }));

    expect(await screen.findByText(/1 TAG\(s\) reserviert/)).toBeVisible();
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      "/tcp/api/v1/admin/tag-management/pools/demo-pool/reservations",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-CSRF-TOKEN": "reservation-csrf",
          "Idempotency-Key": "00000000-0000-4000-8000-000000000099",
        }),
        body: JSON.stringify({ quantity: 1 }),
      }),
    );
  });

  it("submits a TCP-confirmed reserved tag for review only through the CSRF- and idempotency-protected lifecycle command", async () => {
    fetchMock
      .mockResolvedValueOnce(sessionResponse(true))
      .mockResolvedValueOnce(jsonResponse({ ok: true, status: 200, body: { pools: [{ poolId: "demo-pool", length: 6, active: true, rangeIds: ["range-001"] }], correlation_id: correlationId } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, status: 200, body: { csrf_token: "reauth-csrf", correlation_id: correlationId } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, status: 200, body: { status: "reauthenticated", correlation_id: correlationId } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, status: 200, body: { csrf_token: "reservation-csrf", correlation_id: correlationId } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, status: 201, body: { job_id: "00000000-0000-4000-8000-000000000010", tags: [{ id: "abcdef", length: 6, value: "100000", codecVersion: "TEST-S01" }], correlation_id: correlationId } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, status: 200, body: { pools: [], correlation_id: correlationId } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, status: 200, body: { csrf_token: "transition-csrf", correlation_id: correlationId } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, status: 200, body: { tag: { tagId: "abcdef", status: "pending-review" }, correlation_id: correlationId } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, status: 200, body: { csrf_token: "ready-reauth-csrf", correlation_id: correlationId } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, status: 200, body: { status: "reauthenticated", correlation_id: correlationId } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, status: 200, body: { csrf_token: "ready-transition-csrf", correlation_id: correlationId } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, status: 200, body: { tag: { tagId: "abcdef", status: "ready-to-publish" }, correlation_id: correlationId } }));

    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("admin@example.test");
    await user.click(screen.getByRole("button", { name: "Sichtbare Pools laden" }));
    await user.click(await screen.findByRole("button", { name: "Reservierung vorbereiten" }));
    await user.type(screen.getByLabelText("Passwort zur erneuten Authentisierung"), "browser-only-password");
    await user.click(screen.getByRole("button", { name: "Reservierung freigeben" }));
    await user.click(await screen.findByRole("button", { name: "Jetzt reservieren" }));
    await user.click(await screen.findByRole("button", { name: "Zur Prüfung einreichen" }));

    expect(fetchMock).toHaveBeenNthCalledWith(9, "/tcp/api/v1/admin/tag-management/tags/abcdef/transitions", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "X-CSRF-TOKEN": "transition-csrf", "Idempotency-Key": "00000000-0000-4000-8000-000000000099" }),
      body: JSON.stringify({ targetStatus: "pending-review", reason: "initial-review" }),
    }));
    await user.type(screen.getByLabelText("Passwort zur erneuten Authentisierung"), "browser-only-password");
    await user.click(screen.getByRole("button", { name: "Reservierung freigeben" }));
    await user.click(await screen.findByRole("button", { name: "Für Veröffentlichung freigeben" }));
    expect(fetchMock).toHaveBeenNthCalledWith(13, "/tcp/api/v1/admin/tag-management/tags/abcdef/transitions", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "X-CSRF-TOKEN": "ready-transition-csrf", "Idempotency-Key": "00000000-0000-4000-8000-000000000099" }),
      body: JSON.stringify({ targetStatus: "ready-to-publish", reason: "review-approved" }),
    }));
  });

  it("renders the TCP readiness correlation without creating a session or credential request", async () => {
    fetchMock
      .mockResolvedValueOnce(sessionResponse())
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          status: 200,
          body: { status: "ready", correlation_id: correlationId },
        }),
      );

    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("heading", { name: "Administrationsanmeldung" });
    await user.click(screen.getByRole("button", { name: "TCP-Readiness prüfen" }));

    expect(await screen.findByText(new RegExp(correlationId))).toBeVisible();
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/tcp/api/v1/ready",
      expect.objectContaining({ method: "GET" }),
    );
  });
});
