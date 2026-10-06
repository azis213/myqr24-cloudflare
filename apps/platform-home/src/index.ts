const PLATFORM_HOME_HTML = `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="myQR24 verbindet physische QR- und NFC-TAGs mit sicheren digitalen Informationen.">
    <title>myQR24 – intelligente TAGs</title>
    <style>
      :root { color-scheme: light; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #17212b; background: #f5f7fa; }
      * { box-sizing: border-box; }
      body { margin: 0; line-height: 1.6; }
      main { width: min(100% - 2rem, 52rem); margin: 0 auto; padding: 5rem 0 4rem; }
      .brand { color: #087a69; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }
      h1 { max-width: 14ch; margin: .4rem 0 1rem; font-size: clamp(2.25rem, 7vw, 4.5rem); line-height: 1.05; }
      .lead { max-width: 43rem; color: #435160; font-size: clamp(1.1rem, 2vw, 1.3rem); }
      .cards { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); margin: 2.5rem 0; }
      article { padding: 1.35rem; border: 1px solid #dce3ea; border-radius: 1rem; background: #fff; box-shadow: 0 4px 18px rgb(23 33 43 / 6%); }
      h2 { margin-top: 0; font-size: 1.1rem; }
      footer { color: #617080; font-size: .9rem; }
    </style>
  </head>
  <body>
    <main>
      <div class="brand">myQR24</div>
      <h1>Physische TAGs. Digitale Möglichkeiten.</h1>
      <p class="lead">myQR24 verbindet QR- und NFC-TAGs mit aktuellen, sicher verwalteten digitalen Informationen – für Menschen, Gegenstände, Orte und Erlebnisse.</p>
      <section class="cards" aria-label="Basisinformationen">
        <article><h2>Einfach scannen</h2><p>Ein Scan führt zuverlässig zur aktuellen, für den jeweiligen TAG freigegebenen Information.</p></article>
        <article><h2>Sicher verwaltet</h2><p>Persönliche Inhalte und Verwaltungsdaten bleiben in der fachlich autoritativen Control Plane; am Edge werden nur minimale Routingdaten verarbeitet.</p></article>
        <article><h2>Vielseitig einsetzbar</h2><p>TAGs unterstützen unter anderem digitale Profile, TAG Vaults, Lost & Found, Check-ins und ortsbezogene Informationen.</p></article>
      </section>
      <footer>Weitere Informationen zu myQR24 folgen in Kürze.</footer>
    </main>
  </body>
</html>`;

function notFound(): Response {
  return new Response("Not Found", { status: 404 });
}

function homeResponse(method: string): Response {
  return new Response(method === "HEAD" ? null : PLATFORM_HOME_HTML, {
    headers: {
      "cache-control": "public, max-age=300, s-maxage=3600",
      "content-security-policy":
        "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      "content-type": "text/html; charset=utf-8",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
    },
    status: 200,
  });
}

export default {
  fetch(request: Request): Response {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", {
        headers: { allow: "GET, HEAD" },
        status: 405,
      });
    }

    const url = new URL(request.url);

    return url.hostname.toLowerCase() === "www.myqr24.com" && url.pathname === "/"
      ? homeResponse(request.method)
      : notFound();
  },
};
