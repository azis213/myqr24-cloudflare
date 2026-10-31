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

type Pool = {
  poolId: string;
  length: number;
  active: boolean;
  rangeIds: string[];
};

type TagRange = {
  rangeId: string;
  groupId: string;
  length: number;
  startValue: string;
  endValue: string;
  active: boolean;
};

type RangeState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "loaded"; ranges: TagRange[] }
  | { kind: "error"; message: string };

type PoolState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "loaded"; pools: Pool[] }
  | { kind: "error"; message: string };

type ReauthenticationState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "ready" }
  | { kind: "error"; message: string };

type ReservationState =
  | { kind: "idle" }
  | { kind: "submitting"; poolId: string }
  | { kind: "completed"; poolId: string; jobId: string; tagCount: number }
  | { kind: "error"; poolId: string; message: string };

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
  const [pools, setPools] = useState<PoolState>({ kind: "idle" });
  const [ranges, setRanges] = useState<RangeState>({ kind: "idle" });
  const [rangeForm, setRangeForm] = useState({
    rangeId: "",
    groupId: "",
    length: "6",
    startValue: "",
    endValue: "",
  });
  const [rangeMessage, setRangeMessage] = useState<string | null>(null);
  const [rangeIdempotencyKey, setRangeIdempotencyKey] = useState<string | null>(null);
  const [poolForm, setPoolForm] = useState({
    poolId: "",
    displayName: "",
    channel: "test",
    length: "6",
    policyRef: "synthetic-policy",
    capacityWarningThreshold: "10",
    rangeIds: [] as string[],
  });
  const [poolMessage, setPoolMessage] = useState<string | null>(null);
  const [poolIdempotencyKey, setPoolIdempotencyKey] = useState<string | null>(null);
  const [reauthentication, setReauthentication] = useState<ReauthenticationState>({ kind: "idle" });
  const [reauthenticationPassword, setReauthenticationPassword] = useState("");
  const [reservationQuantity, setReservationQuantity] = useState("1");
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const [reservationIdempotencyKey, setReservationIdempotencyKey] = useState<string | null>(null);
  const [reservation, setReservation] = useState<ReservationState>({ kind: "idle" });

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

  async function loadPools() {
    setPools({ kind: "loading" });

    try {
      const response = await fetch(`${tcpBaseUrl}/api/v1/admin/tag-management/pools`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const payload = await readJson(response);

      if (!response.ok || !isRecord(payload) || !Array.isArray(payload.pools)) {
        setPools({
          kind: "error",
          message: errorMessage(payload, "Die sichtbaren Allocation Pools konnten nicht geladen werden."),
        });
        return;
      }

      const loadedPools = payload.pools.flatMap((value): Pool[] => {
        if (
          !isRecord(value) ||
          typeof value.poolId !== "string" ||
          typeof value.length !== "number" ||
          typeof value.active !== "boolean" ||
          !Array.isArray(value.rangeIds) ||
          !value.rangeIds.every((rangeId) => typeof rangeId === "string")
        ) {
          return [];
        }

        return [{
          poolId: value.poolId,
          length: value.length,
          active: value.active,
          rangeIds: value.rangeIds,
        }];
      });

      setPools({ kind: "loaded", pools: loadedPools });
    } catch {
      setPools({ kind: "error", message: `Keine Verbindung zu ${tcpBaseUrl}.` });
    }
  }

  async function loadRanges() {
    setRanges({ kind: "loading" });

    try {
      const response = await fetch(`${tcpBaseUrl}/api/v1/admin/tag-management/ranges`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const payload = await readJson(response);

      if (!response.ok || !isRecord(payload) || !Array.isArray(payload.ranges)) {
        setRanges({
          kind: "error",
          message: errorMessage(payload, "Die Range-Konfiguration konnte nicht geladen werden."),
        });
        return;
      }

      const loadedRanges = payload.ranges.flatMap((value): TagRange[] => {
        if (
          !isRecord(value) ||
          typeof value.rangeId !== "string" ||
          typeof value.groupId !== "string" ||
          typeof value.length !== "number" ||
          typeof value.startValue !== "string" ||
          typeof value.endValue !== "string" ||
          typeof value.active !== "boolean"
        ) {
          return [];
        }

        return [{
          rangeId: value.rangeId,
          groupId: value.groupId,
          length: value.length,
          startValue: value.startValue,
          endValue: value.endValue,
          active: value.active,
        }];
      });

      setRanges({ kind: "loaded", ranges: loadedRanges });
    } catch {
      setRanges({ kind: "error", message: `Keine Verbindung zu ${tcpBaseUrl}.` });
    }
  }

  async function createRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRangeMessage(null);

    if (reauthentication.kind !== "ready") {
      setRangeMessage("Vor der Range-Anlage ist eine frische serverseitige Re-Authentisierung erforderlich.");
      return;
    }

    try {
      const token = await csrfToken();
      const idempotencyKey = rangeIdempotencyKey ?? crypto.randomUUID();
      setRangeIdempotencyKey(idempotencyKey);
      const response = await fetch(`${tcpBaseUrl}/api/v1/admin/tag-management/ranges`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": token,
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          rangeId: rangeForm.rangeId,
          groupId: rangeForm.groupId,
          length: Number(rangeForm.length),
          startValue: rangeForm.startValue,
          endValue: rangeForm.endValue,
          active: true,
        }),
      });
      const payload = await readJson(response);

      if (!response.ok) {
        setRangeMessage(errorMessage(payload, "Die Range konnte nicht angelegt werden."));
        return;
      }

      setRangeMessage("Range wurde serverseitig angelegt.");
      setRangeIdempotencyKey(null);
      setRangeForm({
        rangeId: "",
        groupId: "",
        length: "6",
        startValue: "",
        endValue: "",
      });
      await loadRanges();
    } catch (error) {
      setRangeMessage(error instanceof Error ? error.message : "Die Range konnte nicht angelegt werden.");
    }
  }

  async function createPool(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPoolMessage(null);

    if (reauthentication.kind !== "ready") {
      setPoolMessage("Vor der Pool-Anlage ist eine frische serverseitige Re-Authentisierung erforderlich.");
      return;
    }

    try {
      const token = await csrfToken();
      const idempotencyKey = poolIdempotencyKey ?? crypto.randomUUID();
      setPoolIdempotencyKey(idempotencyKey);
      const response = await fetch(`${tcpBaseUrl}/api/v1/admin/tag-management/pools`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": token,
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          poolId: poolForm.poolId,
          organizationId: null,
          displayName: poolForm.displayName,
          channel: poolForm.channel,
          length: Number(poolForm.length),
          rangeIds: poolForm.rangeIds,
          policyRef: poolForm.policyRef,
          capacityWarningThreshold: Number(poolForm.capacityWarningThreshold),
          active: true,
        }),
      });
      const payload = await readJson(response);

      if (!response.ok) {
        setPoolMessage(errorMessage(payload, "Der Pool konnte nicht angelegt werden."));
        return;
      }

      setPoolMessage("Pool wurde serverseitig angelegt.");
      setPoolIdempotencyKey(null);
      setPoolForm({
        poolId: "",
        displayName: "",
        channel: "test",
        length: "6",
        policyRef: "synthetic-policy",
        capacityWarningThreshold: "10",
        rangeIds: [],
      });
      await loadPools();
    } catch (error) {
      setPoolMessage(error instanceof Error ? error.message : "Der Pool konnte nicht angelegt werden.");
    }
  }

  async function submitReauthentication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReauthentication({ kind: "submitting" });

    try {
      const token = await csrfToken();
      const response = await fetch(`${tcpBaseUrl}/api/v1/auth/tag-management/reauthenticate`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": token,
        },
        body: JSON.stringify({ password: reauthenticationPassword }),
      });
      const payload = await readJson(response);
      setReauthenticationPassword("");

      if (!response.ok || !isRecord(payload) || payload.status !== "reauthenticated") {
        setReauthentication({
          kind: "error",
          message: errorMessage(payload, "Die erneute Authentisierung wurde abgelehnt."),
        });
        return;
      }

      setReauthentication({ kind: "ready" });
    } catch (error) {
      setReauthentication({
        kind: "error",
        message: error instanceof Error ? error.message : "Die erneute Authentisierung ist fehlgeschlagen.",
      });
    }
  }

  async function reserve(poolId: string) {
    const quantity = Number(reservationQuantity);

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) {
      setReservation({
        kind: "error",
        poolId,
        message: "Die Reservierungsmenge muss zwischen 1 und 1.000 liegen.",
      });
      return;
    }

    setReservation({ kind: "submitting", poolId });

    try {
      const token = await csrfToken();
      const idempotencyKey = reservationIdempotencyKey;

      if (idempotencyKey === null) {
        throw new Error("Der Reservierungsvorgang wurde nicht vorbereitet.");
      }

      const response = await fetch(
        `${tcpBaseUrl}/api/v1/admin/tag-management/pools/${encodeURIComponent(poolId)}/reservations`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-CSRF-TOKEN": token,
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify({ quantity }),
        },
      );
      const payload = await readJson(response);

      if (
        !response.ok ||
        !isRecord(payload) ||
        typeof payload.job_id !== "string" ||
        !Array.isArray(payload.tags)
      ) {
        setReservation({
          kind: "error",
          poolId,
          message: errorMessage(payload, "Die Reservierung konnte nicht verarbeitet werden."),
        });
        return;
      }

      const completedReservation: ReservationState = {
        kind: "completed",
        poolId,
        jobId: payload.job_id,
        tagCount: payload.tags.length,
      };

      setReauthentication({ kind: "idle" });
      await loadPools();
      setReservation(completedReservation);
    } catch (error) {
      setReservation({
        kind: "error",
        poolId,
        message: error instanceof Error ? error.message : "Die Reservierung ist fehlgeschlagen.",
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
      setPools({ kind: "idle" });
      setRanges({ kind: "idle" });
      setRangeMessage(null);
      setRangeIdempotencyKey(null);
      setPoolMessage(null);
      setPoolIdempotencyKey(null);
      setReauthentication({ kind: "idle" });
      setReauthenticationPassword("");
      setSelectedPoolId(null);
      setReservationIdempotencyKey(null);
      setReservation({ kind: "idle" });
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
        <>
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

          {auth.role === "platform-admin" ? (
            <section className="content-section" aria-labelledby="range-heading">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">CP-I02 · plattformweite Konfiguration</p>
                  <h2 id="range-heading">Kanonische TAG-Ranges</h2>
                </div>
                <p>
                  Grenzen bleiben vollständige lineare Dezimalwerte. TCP prüft Kanonizität,
                  Base36-Domäne und globale Nichtüberlappung.
                </p>
              </div>

              <button
                type="button"
                className="secondary-action"
                disabled={ranges.kind === "loading"}
                onClick={() => void loadRanges()}
              >
                {ranges.kind === "loading" ? "Ranges werden geladen …" : "Ranges laden"}
              </button>

              {ranges.kind === "loaded" ? (
                <ul>
                  {ranges.ranges.map((range) => (
                    <li key={range.rangeId}>
                      <code>{range.rangeId}</code>: {range.startValue} – {range.endValue} (Länge {range.length})
                    </li>
                  ))}
                </ul>
              ) : null}
              {ranges.kind === "error" ? <p className="error-message" role="alert">{ranges.message}</p> : null}

              <form className="auth-form" onSubmit={createRange}>
                <h3>Range anlegen</h3>
                <label>
                  Range-ID
                  <input required value={rangeForm.rangeId} onChange={(event) => setRangeForm({ ...rangeForm, rangeId: event.target.value })} />
                </label>
                <label>
                  Gruppen-ID
                  <input required value={rangeForm.groupId} onChange={(event) => setRangeForm({ ...rangeForm, groupId: event.target.value })} />
                </label>
                <label>
                  Länge
                  <select value={rangeForm.length} onChange={(event) => setRangeForm({ ...rangeForm, length: event.target.value })}>
                    <option value="6">6</option>
                    <option value="8">8</option>
                    <option value="10">10</option>
                  </select>
                </label>
                <label>
                  Startwert
                  <input inputMode="numeric" required value={rangeForm.startValue} onChange={(event) => setRangeForm({ ...rangeForm, startValue: event.target.value })} />
                </label>
                <label>
                  Endwert
                  <input inputMode="numeric" required value={rangeForm.endValue} onChange={(event) => setRangeForm({ ...rangeForm, endValue: event.target.value })} />
                </label>
                {reauthentication.kind === "ready" ? (
                  <button type="submit" className="primary-action">Range serverseitig anlegen</button>
                ) : (
                  <p>Für diese Mutation ist die Re-Authentisierung im Bereich „Kritische Aktion freigeben“ erforderlich.</p>
                )}
                {rangeMessage !== null ? (
                  <p className={reauthentication.kind === "ready" ? "success-message" : "error-message"}>{rangeMessage}</p>
                ) : null}
              </form>

              <form className="auth-form" onSubmit={createPool}>
                <h3>Allocation Pool anlegen</h3>
                <p>Der Pool referenziert ausschließlich aktive, bereits serverbestätigte Ranges gleicher Länge.</p>
                <label>
                  Pool-ID
                  <input required value={poolForm.poolId} onChange={(event) => setPoolForm({ ...poolForm, poolId: event.target.value })} />
                </label>
                <label>
                  Anzeigename
                  <input required value={poolForm.displayName} onChange={(event) => setPoolForm({ ...poolForm, displayName: event.target.value })} />
                </label>
                <label>
                  Kanal
                  <input required value={poolForm.channel} onChange={(event) => setPoolForm({ ...poolForm, channel: event.target.value })} />
                </label>
                <label>
                  Länge
                  <select value={poolForm.length} onChange={(event) => setPoolForm({ ...poolForm, length: event.target.value, rangeIds: [] })}>
                    <option value="6">6</option>
                    <option value="8">8</option>
                    <option value="10">10</option>
                  </select>
                </label>
                <label>
                  Policy-Referenz
                  <input required value={poolForm.policyRef} onChange={(event) => setPoolForm({ ...poolForm, policyRef: event.target.value })} />
                </label>
                <label>
                  Kapazitätswarnung
                  <input type="number" min="0" required value={poolForm.capacityWarningThreshold} onChange={(event) => setPoolForm({ ...poolForm, capacityWarningThreshold: event.target.value })} />
                </label>
                <fieldset>
                  <legend>Aktive Ranges derselben Länge</legend>
                  {ranges.kind === "loaded" ? ranges.ranges
                    .filter((range) => range.active && range.length === Number(poolForm.length))
                    .map((range) => (
                      <label key={range.rangeId}>
                        <input
                          type="checkbox"
                          checked={poolForm.rangeIds.includes(range.rangeId)}
                          onChange={(event) => setPoolForm({
                            ...poolForm,
                            rangeIds: event.target.checked
                              ? [...poolForm.rangeIds, range.rangeId]
                              : poolForm.rangeIds.filter((rangeId) => rangeId !== range.rangeId),
                          })}
                        />
                        {range.rangeId}
                      </label>
                    )) : <p>Laden Sie zuerst die Range-Konfiguration.</p>}
                </fieldset>
                {reauthentication.kind === "ready" ? (
                  <button type="submit" className="primary-action">Pool serverseitig anlegen</button>
                ) : (
                  <p>Für diese Mutation ist eine frische serverseitige Re-Authentisierung erforderlich.</p>
                )}
                {poolMessage !== null ? (
                  <p className={reauthentication.kind === "ready" ? "success-message" : "error-message"}>{poolMessage}</p>
                ) : null}
              </form>
            </section>
          ) : null}

          <section className="content-section" aria-labelledby="allocation-heading">
            <div className="section-heading">
              <div>
                <p className="eyebrow">CP-I02 · lokale Verwaltungsfunktion</p>
                <h2 id="allocation-heading">Allocation Pools und TAG-Reservierung</h2>
              </div>
              <p>
                Pools und Ergebnisse werden ausschließlich vom TCP bestätigt. Die Oberfläche kennt keine
                Feistel-, Codec- oder Cloudflare-Secrets.
              </p>
            </div>

            <button
              type="button"
              className="primary-action"
              disabled={pools.kind === "loading"}
              onClick={() => void loadPools()}
            >
              {pools.kind === "loading" ? "Pools werden geladen …" : "Sichtbare Pools laden"}
            </button>

            {pools.kind === "error" ? <p className="error-message" role="alert">{pools.message}</p> : null}

            {pools.kind === "loaded" ? (
              <div className="module-grid allocation-grid">
                {pools.pools.length === 0 ? (
                  <p>Für diese Sitzung sind keine Allocation Pools sichtbar.</p>
                ) : pools.pools.map((pool) => (
                  <article className="module-card" key={pool.poolId}>
                    <p className="module-status">{pool.active ? "Aktiv" : "Inaktiv"}</p>
                    <h3>{pool.poolId}</h3>
                    <p>Länge: <code>{pool.length}</code> · Ranges: {pool.rangeIds.join(", ")}</p>
                    <button
                      type="button"
                      className="secondary-action"
                      disabled={!pool.active}
                      onClick={() => {
                        setSelectedPoolId(pool.poolId);
                        setReservationIdempotencyKey(crypto.randomUUID());
                        setReservation({ kind: "idle" });
                        setReauthentication({ kind: "idle" });
                      }}
                    >
                      Reservierung vorbereiten
                    </button>
                    {reservation.kind !== "idle" && reservation.poolId === pool.poolId ? (
                      <p className={reservation.kind === "error" ? "error-message" : "success-message"}>
                        {reservation.kind === "submitting"
                          ? "Reservierung wird serverseitig verarbeitet …"
                          : reservation.kind === "completed"
                            ? `${reservation.tagCount} TAG(s) reserviert. Job: ${reservation.jobId}`
                            : reservation.message}
                      </p>
                    ) : null}
                    {reauthentication.kind === "ready" && selectedPoolId === pool.poolId ? (
                      <button
                        type="button"
                        className="primary-action"
                        disabled={reservation.kind === "submitting"}
                        onClick={() => void reserve(pool.poolId)}
                      >
                        {reservation.kind === "submitting" && reservation.poolId === pool.poolId
                          ? "Reservierung läuft …"
                          : "Jetzt reservieren"}
                      </button>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : null}

            {reservation.kind === "completed" ? (
              <p className="success-message">
                {reservation.tagCount} TAG(s) reserviert. Job: {reservation.jobId}
              </p>
            ) : null}

            {(selectedPoolId !== null || auth.role === "platform-admin") ? (
              <form className="auth-form" onSubmit={submitReauthentication}>
                <h3>Kritische Aktion freigeben</h3>
                <p>
                  {selectedPoolId !== null ? (
                    <>
                      Vor der Reservierung aus <code>{selectedPoolId}</code> bestätigt TCP Ihr Passwort erneut
                      für diese Sitzung.
                    </>
                  ) : (
                    <>
                      Vor einer plattformweiten Range- oder Pool-Mutation bestätigt TCP Ihr Passwort erneut
                      für diese Sitzung.
                    </>
                  )}
                </p>
                <label>
                  Anzahl TAGs
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    required
                    value={reservationQuantity}
                    onChange={(event) => setReservationQuantity(event.target.value)}
                  />
                </label>
                <label>
                  Passwort zur erneuten Authentisierung
                  <input
                    autoComplete="current-password"
                    type="password"
                    required
                    value={reauthenticationPassword}
                    onChange={(event) => setReauthenticationPassword(event.target.value)}
                  />
                </label>
                <button type="submit" className="primary-action" disabled={reauthentication.kind === "submitting"}>
                  {reauthentication.kind === "submitting"
                    ? "Berechtigung wird geprüft …"
                    : reauthentication.kind === "ready"
                      ? "Berechtigung erneuern"
                      : "Reservierung freigeben"}
                </button>
                {reauthentication.kind === "ready" ? (
                  <p className="success-message">Reservierung ist für diese Sitzung kurzzeitig freigegeben.</p>
                ) : null}
                {reauthentication.kind === "error" ? (
                  <p className="error-message" role="alert">{reauthentication.message}</p>
                ) : null}
              </form>
            ) : null}
          </section>
        </>
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
