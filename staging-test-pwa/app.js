const tagIdElement = document.querySelector("#tag-id");
const requestedUrlElement = document.querySelector("#requested-url");
const timestampElement = document.querySelector("#timestamp");
const redirectExpiryElement = document.querySelector("#redirect-expiry");
const redirectSignatureElement = document.querySelector("#redirect-signature");

function getTagId(pathname) {
  const match = pathname.match(/^\/tag\/([0-9a-z]{6}|[0-9a-z]{8})$/i);
  return match?.[1]?.toLowerCase() ?? null;
}

function formatExpiry(expiryValue) {
  if (!expiryValue || !/^\d+$/.test(expiryValue)) {
    return "Nicht vorhanden";
  }

  const expiryDate = new Date(Number(expiryValue) * 1000);
  if (Number.isNaN(expiryDate.getTime())) {
    return "Ungültiger Wert";
  }

  return `${expiryDate.toLocaleString("de-DE")} (${expiryDate.toISOString()})`;
}

function setText(element, value) {
  if (element) {
    element.textContent = value;
  }
}

const tagId = getTagId(window.location.pathname);
const parameters = new URLSearchParams(window.location.search);
const signature = parameters.get("sig");
const expiry = parameters.get("exp");

setText(tagIdElement, tagId ?? "Keine gültige Tag-ID in der Route");
setText(requestedUrlElement, window.location.href);
setText(timestampElement, new Date().toLocaleString("de-DE"));
setText(redirectExpiryElement, formatExpiry(expiry));
setText(
  redirectSignatureElement,
  signature ? `Vorhanden (${signature.length} Zeichen)` : "Nicht vorhanden",
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {
      // The test page remains functional when offline caching cannot be registered.
    });
  });
}
