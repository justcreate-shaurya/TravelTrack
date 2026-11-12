"use client";

/**
 * Microsoft Entra ID sign-in: OAuth 2.0 authorization code + PKCE, done by hand (no MSAL).
 * A full-page redirect, not a popup, because popups are unreliable in installed PWAs.
 *
 * The app registration needs a "Single-page application" platform with redirect URI
 *   <origin>/auth/callback
 * so the browser is allowed to redeem the code at the token endpoint (CORS) without a secret.
 */

const STORE_KEY = "traveltrack.mslogin";
const SCOPES = "openid profile email";

interface Pending {
  verifier: string;
  state: string;
  nonce: string;
  next: string;
  tenant: string;
  clientId: string;
}

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function random(len = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(len)));
}

export function redirectUri(): string {
  return `${window.location.origin}/auth/callback`;
}

export async function startMicrosoftLogin(opts: {
  clientId: string;
  tenant: string;
  domainHint: string;
  next: string;
}): Promise<void> {
  const verifier = random(48);
  const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  const pending: Pending = {
    verifier,
    state: random(16),
    nonce: random(16),
    next: opts.next,
    tenant: opts.tenant,
    clientId: opts.clientId,
  };
  sessionStorage.setItem(STORE_KEY, JSON.stringify(pending));

  const params = new URLSearchParams({
    client_id: opts.clientId,
    response_type: "code",
    redirect_uri: redirectUri(),
    response_mode: "query",
    scope: SCOPES,
    state: pending.state,
    nonce: pending.nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
    domain_hint: opts.domainHint,
  });
  window.location.assign(
    `https://login.microsoftonline.com/${encodeURIComponent(opts.tenant)}/oauth2/v2.0/authorize?${params}`,
  );
}

export class MsLoginError extends Error {}

/** Runs on /auth/callback: validates state, redeems the code, returns the ID token + nonce. */
export async function completeMicrosoftLogin(): Promise<{ idToken: string; nonce: string; next: string }> {
  const q = new URLSearchParams(window.location.search);
  const raw = sessionStorage.getItem(STORE_KEY);
  sessionStorage.removeItem(STORE_KEY);

  if (q.get("error")) {
    const desc = q.get("error_description") ?? q.get("error") ?? "";
    // AADSTS65001-style consent / cancellation messages are long; keep the first line.
    throw new MsLoginError(desc.split(/\r?\n/)[0] || "Microsoft sign-in was cancelled");
  }
  if (!raw) throw new MsLoginError("Sign-in session expired. Please try again.");
  const pending = JSON.parse(raw) as Pending;
  const code = q.get("code");
  if (!code || q.get("state") !== pending.state) throw new MsLoginError("Sign-in check failed. Please try again.");

  const res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(pending.tenant)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: pending.clientId,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      code_verifier: pending.verifier,
      scope: SCOPES,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.id_token) {
    throw new MsLoginError(
      String(body.error_description ?? "Microsoft didn't return a token").split(/\r?\n/)[0],
    );
  }
  return { idToken: body.id_token as string, nonce: pending.nonce, next: pending.next };
}
