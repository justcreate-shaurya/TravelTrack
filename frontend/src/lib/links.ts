/** Same rule as WA_GROUP_RE in backend/app/links.py. */
const WA_GROUP_RE = /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{10,40}$/;

export const WA_GROUP_HINT = "Paste a WhatsApp group invite link, like https://chat.whatsapp.com/AbCd…";

/**
 * Cleans a pasted WhatsApp group invite so it matches what the server accepts: trims it and
 * drops the tracking query (?mode=...), any fragment and trailing slashes that WhatsApp's
 * share sheet adds. Returns "" for blank input.
 */
export function normalizeWaGroupLink(raw: string): string {
  return raw
    .trim()
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
}

/** True for a (normalised) invite link the server will accept. */
export function isWaGroupLink(link: string): boolean {
  return WA_GROUP_RE.test(link);
}
