/**
 * Discord request signature verification (Ed25519 over `timestamp + rawBody`), Web Crypto only.
 * https://discord.com/developers/docs/interactions/overview#setting-up-an-endpoint-validating-security-request-headers
 */

const keyCache = new Map<string, Promise<CryptoKey>>();

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) throw new Error("invalid hex");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function importPublicKey(publicKeyHex: string): Promise<CryptoKey> {
  let p = keyCache.get(publicKeyHex);
  if (!p) {
    p = crypto.subtle.importKey("raw", hexToBytes(publicKeyHex), { name: "Ed25519" }, false, ["verify"]);
    keyCache.set(publicKeyHex, p);
    p.catch(() => keyCache.delete(publicKeyHex));
  }
  return p;
}

/** Max age of X-Signature-Timestamp we accept (replay protection). Discord delivers in well under 3 s. */
export const MAX_SIGNATURE_AGE_SECONDS = 300;

export async function verifyDiscordRequest(
  publicKeyHex: string,
  signatureHex: string | null,
  timestamp: string | null,
  rawBody: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!signatureHex || !timestamp) return false;
  if (!/^[0-9a-fA-F]{128}$/.test(signatureHex)) return false;
  if (!/^[0-9]{1,12}$/.test(timestamp)) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > MAX_SIGNATURE_AGE_SECONDS) return false;
  try {
    const key = await importPublicKey(publicKeyHex);
    const data = new TextEncoder().encode(timestamp + rawBody);
    return await crypto.subtle.verify({ name: "Ed25519" }, key, hexToBytes(signatureHex), data);
  } catch {
    return false;
  }
}
