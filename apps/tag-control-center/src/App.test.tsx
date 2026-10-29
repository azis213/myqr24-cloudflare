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
