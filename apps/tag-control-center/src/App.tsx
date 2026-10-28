import { useEffect, useState } from "react";
import type { FormEvent } from "react";

type ReadinessState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; correlationId: string }
  | { kind: "unavailable"; message: string };

type AuthState =
  | { kind: "checking" }
  | { kind: "signed_out" }
  | { kind: "submitting_password" }
  | { kind: "mfa_required"; email: string }
  | { kind: "submitting_mfa"; email: string }
  | { kind: "authenticated"; email: string; role: string }
  | { kind: "error"; message: string };

type JsonRecord = Record<string, unknown>;

const tcpBaseUrl = (import.meta.env.VITE_TCP_BASE_URL ?? "/tcp").replace(/\/$/, "");

const futureModules = [
  {
    title: "Identitäten & Rollen",
    description:
      "Einladungen, Rollen, MFA-Reset und Session-Widerruf werden erst mit serverseitiger Autorisierung und Audit freigeschaltet.",
    status: "Gesperrt bis CC-I01",
  },
  {
    title: "TAGs & Ranges",
    description:
      "Entwürfe, Allocation Pools, Reservierungen und Lebenszyklen benötigen die CP-I02-Domäne und serverseitige Autorisierung.",
    status: "Geplant ab CP-I02",
  },
  {
    title: "Routing & Publishing",
    description:
      "Prüfung, Outbox, Publish und Unpublish verbleiben serverseitig. Browser erhalten keine Cloudflare- oder KV-Schreibrechte.",
    status: "Geplant ab CP-I04",
  },
  {
    title: "Öffentliche Inhalte",
    description:
      "Basis-Vault-Entwürfe und Public Read API folgen nach Rollenmodell, Veröffentlichungsworkflow und CORS-Vertrag.",
    status: "Geplant ab CP-I05",
  },
];

const roles = [
  ["platform-admin", "Identitäten, delegierbare Rollen und Sicherheitsrahmen; keine Secrets oder Deployments."],
  ["security-auditor", "Liest redigierte Sicherheits- und Änderungsereignisse; keine Mutationen."],
  ["tag-manager", "Spätere Pools, Ranges und TAG-Lebenszyklen; keine Identitätsverwaltung."],
  ["content-editor", "Spätere Inhaltsentwürfe; keine eigenständige Veröffentlichung."],
  ["support-agent", "Späterer minimaler Supportprozess; keine Rollen-, MFA- oder Owner-Übernahme."],
] as const;

function statusText(readiness: ReadinessState): string {
  switch (readiness.kind) {
    case "idle":
      return "Noch nicht geprüft";
    case "loading":
      return "Prüfung läuft …";
    case "ready":
      return "TCP ist bereit";
    case "unavailable":
      return "TCP nicht erreichbar";
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function errorMessage(payload: unknown, fallback: string): string {
  if (!isRecord(payload) || !isRecord(payload.errors)) {
    return fallback;
  }

  const firstError = Object.values(payload.errors).flat().find((value) => typeof value === "string");

  return typeof firstError === "string" ? firstError : fallback;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function csrfToken(): Promise<string> {
  const response = await fetch(`${tcpBaseUrl}/api/v1/auth/csrf`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const payload = await readJson(response);

  if (!response.ok || !isRecord(payload) || typeof payload.csrf_token !== "string") {
    throw new Error("Die Sicherheitsverbindung zum TCP konnte nicht aufgebaut werden.");
  }

  return payload.csrf_token;
}

export function App() {
  const [readiness, setReadiness] = useState<ReadinessState>({ kind: "idle" });
  const [auth, setAuth] = useState<AuthState>({ kind: "checking" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");

  useEffect(() => {
    void loadSession();
  }, []);

  async function loadSession() {
    try {
      const response = await fetch(`${tcpBaseUrl}/api/v1/auth/session`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const payload = await readJson(response);

      if (
        response.ok &&
        isRecord(payload) &&
        payload.authenticated === true &&
        isRecord(payload.user) &&
        typeof payload.user.email === "string" &&
        typeof payload.user.role === "string"
      ) {
        setAuth({ kind: "authenticated", email: payload.user.email, role: payload.user.role });
        return;
      }

      setAuth({ kind: "signed_out" });
    } catch {
      setAuth({ kind: "error", message: `Keine Verbindung zu ${tcpBaseUrl}.` });
    }
  }

  async function checkTcpReadiness() {
    setReadiness({ kind: "loading" });

    try {
      const response = await fetch(`${tcpBaseUrl}/api/v1/ready`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const data = await readJson(response);

      if (
        response.ok &&
        isRecord(data) &&
        data.status === "ready" &&
        typeof data.correlation_id === "string"
      ) {
        setReadiness({ kind: "ready", correlationId: data.correlation_id });
        return;
      }

      setReadiness({
        kind: "unavailable",
        message: "Die TCP-Readiness-Antwort entspricht nicht dem erwarteten öffentlichen Betriebsvertrag.",
      });
    } catch {
      setReadiness({
        kind: "unavailable",
        message: `Keine Verbindung zu ${tcpBaseUrl}. Starte die lokale TCP-Umgebung mit „npm run local:up“.`,
      });
    }
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuth({ kind: "submitting_password" });

    try {
      const token = await csrfToken();
      const response = await fetch(`${tcpBaseUrl}/api/v1/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": token,
        },
        body: JSON.stringify({ email, password }),
      });
      const payload = await readJson(response);

      if (!response.ok || !isRecord(payload) || typeof payload.status !== "string") {
        setAuth({
          kind: "error",
          message: errorMessage(payload, "Die Anmeldung konnte nicht verarbeitet werden."),
        });
        return;
      }

      setPassword("");

      if (payload.status === "mfa_required") {
        setAuth({ kind: "mfa_required", email });
        return;
      }

      if (
        payload.status === "authenticated" &&
        isRecord(payload.user) &&
        typeof payload.user.email === "string" &&
        typeof payload.user.role === "string"
      ) {
        setAuth({ kind: "authenticated", email: payload.user.email, role: payload.user.role });
        return;
      }

      await loadSession();
    } catch (error) {
      setAuth({
        kind: "error",
        message: error instanceof Error ? error.message : "Die Anmeldung ist fehlgeschlagen.",
      });
    }
  }

  async function submitMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const pendingEmail =
      auth.kind === "mfa_required" || auth.kind === "submitting_mfa" ? auth.email : email;

    setAuth({ kind: "submitting_mfa", email: pendingEmail });

    try {
      const token = await csrfToken();
      const response = await fetch(`${tcpBaseUrl}/api/v1/auth/mfa/verify`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": token,
        },
        body: JSON.stringify({ code: mfaCode }),
      });
      const payload = await readJson(response);

      if (
        response.ok &&
        isRecord(payload) &&
        payload.status === "authenticated" &&
        isRecord(payload.user) &&
        typeof payload.user.email === "string" &&
        typeof payload.user.role === "string"
      ) {
        setMfaCode("");
        setAuth({ kind: "authenticated", email: payload.user.email, role: payload.user.role });
        return;
      }

      setAuth({
        kind: "mfa_required",
        email: pendingEmail,
      });
      setMfaCode("");
      window.alert(errorMessage(payload, "Der Sicherheitscode konnte nicht bestätigt werden."));
    } catch (error) {
      setAuth({
        kind: "error",
        message: error instanceof Error ? error.message : "Die MFA-Prüfung ist fehlgeschlagen.",
      });
    }
  }

  async function logout() {
    try {
      const token = await csrfToken();
      await fetch(`${tcpBaseUrl}/api/v1/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json", "X-CSRF-TOKEN": token },
      });
    } finally {
      setEmail("");
      setPassword("");
      setMfaCode("");
      setAuth({ kind: "signed_out" });
    }
  }

  const isSubmitting = auth.kind === "submitting_password" || auth.kind === "submitting_mfa";
  const mfaPending = auth.kind === "mfa_required" || auth.kind === "submitting_mfa";
  const isAuthenticated = auth.kind === "authenticated";

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">myQR24 · interne Startoberfläche</p>
          <h1>TAG Control Center</h1>
        </div>
        <span className="phase-label">CC-I01 · Sicherheitsfundament</span>
      </header>

      <section className="notice" aria-labelledby="security-boundary-heading">
        <div>
          <p className="eyebrow">Verbindliche Sicherheitsgrenze</p>
          <h2 id="security-boundary-heading">
            Keine Verwaltungsbefehle vor TCP-Authentisierung und MFA
          </h2>
        </div>
        <p>
          Verwaltungssitzungen werden ausschließlich durch den TAG Control Plane Server ausgestellt.
          Diese Oberfläche überträgt weder Cloudflare-, Datenbank- noch Mail-Secrets.
        </p>
      </section>

      {!isAuthenticated ? (
        <section className="content-section authentication-section" aria-labelledby="authentication-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Zugangsschutz</p>
              <h2 id="authentication-heading">Administrationsanmeldung</h2>
            </div>
            <p>Passwort und serverseitig erzwungene E-Mail-MFA schützen jede Verwaltungssitzung.</p>
          </div>

          {auth.kind === "checking" ? <p>Vorhandene Sitzung wird geprüft …</p> : null}
          {auth.kind === "error" ? <p className="error-message" role="alert">{auth.message}</p> : null}

          {mfaPending ? (
            <form className="auth-form" onSubmit={submitMfa}>
              <p className="success-message">
                Ein einmaliger Sicherheitscode wurde an <strong>{auth.email}</strong> versendet.
              </p>
              <label>
                E-Mail-Sicherheitscode
                <input
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={6}
                  minLength={6}
                  pattern="[0-9]{6}"
                  required
                  value={mfaCode}
                  onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, ""))}
                />
              </label>
              <button type="submit" className="primary-action" disabled={isSubmitting}>
                {auth.kind === "submitting_mfa" ? "Code wird geprüft …" : "Sicherheitscode bestätigen"}
              </button>
            </form>
          ) : auth.kind !== "checking" ? (
            <form className="auth-form" onSubmit={submitLogin}>
              <label>
                E-Mail-Adresse
                <input
                  autoComplete="username"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <label>
                Passwort
                <input
                  autoComplete="current-password"
                  type="password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <button type="submit" className="primary-action" disabled={isSubmitting}>
                {auth.kind === "submitting_password" ? "Anmeldung wird geprüft …" : "Anmelden"}
              </button>
            </form>
          ) : null}
        </section>
      ) : (
        <section className="content-section authenticated-session" aria-label="Aktive Verwaltungssitzung">
          <div>
            <p className="eyebrow">Aktive Verwaltungssitzung</p>
            <h2>{auth.email}</h2>
            <p>Rolle: <code>{auth.role}</code></p>
          </div>
          <button type="button" className="secondary-action" onClick={logout}>
            Abmelden
          </button>
        </section>
      )}

      <section className="overview-grid" aria-label="TCC-Startstatus">
        <article className="readiness-card">
          <p className="eyebrow">Lokaler TCP-Betrieb</p>
          <h2>{statusText(readiness)}</h2>
          <p>
            Die Prüfung ruft ausschließlich <code>GET /api/v1/ready</code> auf. Es werden keine
            Sitzungen, Credentials oder Konfigurationswerte übertragen.
          </p>
          <button
            type="button"
            className="primary-action"
            disabled={readiness.kind === "loading"}
            onClick={checkTcpReadiness}
          >
            {readiness.kind === "loading" ? "Readiness wird geprüft …" : "TCP-Readiness prüfen"}
          </button>
          {readiness.kind === "ready" ? (
            <p className="success-message">
              Verbindung bestätigt. Korrelations-ID: <code>{readiness.correlationId}</code>
            </p>
          ) : null}
          {readiness.kind === "unavailable" ? (
            <p className="error-message" role="alert">
              {readiness.message}
            </p>
          ) : null}
        </article>

        <article className="boundary-card">
          <p className="eyebrow">Betrieb & Secrets</p>
          <h2>Deployment außerhalb der Anwendung</h2>
          <ul>
            <li>Mail-Transport, Cloudflare-Token und Datenbankzugänge: nur Deployment/Secret Store</li>
            <li>Erster Platform-Admin: kontrollierter CLI-Bootstrap, keine offene Registrierung</li>
            <li>Break-glass: zeitlich begrenzt, außerhalb der Web-UI und auditierbar</li>
          </ul>
        </article>
      </section>

      <section className="content-section" aria-labelledby="modules-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Implementierungsfahrplan</p>
            <h2 id="modules-heading">Verwaltungsbereiche</h2>
          </div>
          <p>Die Oberfläche zeigt bewusst keinen aktiven Command an, solange die zugehörigen TCP-Guards fehlen.</p>
        </div>
        <div className="module-grid">
          {futureModules.map((module) => (
            <article className="module-card" key={module.title}>
              <p className="module-status">{module.status}</p>
              <h3>{module.title}</h3>
              <p>{module.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="content-section" aria-labelledby="roles-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Zielmodell</p>
            <h2 id="roles-heading">Minimale Anwendungsrollen</h2>
          </div>
          <p>Rollen sind serverseitig durchzusetzen; das Ausblenden von UI-Elementen ist keine Berechtigung.</p>
        </div>
        <div className="roles-table-wrapper">
          <table>
            <thead>
              <tr>
                <th scope="col">Rolle</th>
                <th scope="col">Minimaler Umfang</th>
              </tr>
            </thead>
            <tbody>
              {roles.map(([name, scope]) => (
                <tr key={name}>
                  <th scope="row"><code>{name}</code></th>
                  <td>{scope}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer>
        <span>myQR24 TAG Control Center · Startoberfläche ohne privilegierte Funktionen</span>
        <span>TCP-Ziel: <code>{tcpBaseUrl}</code></span>
      </footer>
    </main>
  );
}
