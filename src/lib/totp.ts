import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "crypto";

// TOTP(RFC 6238) 직접 구현 — SHA1·30초·6자리, Google Authenticator/MS Authenticator 호환.
// 외부 라이브러리 없이 Node crypto만 사용.

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0,
    value = 0,
    out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(str: string): Buffer {
  const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0,
    value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20)); // 160비트
}

function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const msg = Buffer.alloc(8);
  msg.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  msg.writeUInt32BE(counter >>> 0, 4);
  const h = createHmac("sha1", key).update(msg).digest();
  const off = h[h.length - 1] & 0xf;
  const code =
    ((h[off] & 0x7f) << 24) |
    ((h[off + 1] & 0xff) << 16) |
    ((h[off + 2] & 0xff) << 8) |
    (h[off + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

export function totpCode(secret: string, at = Date.now()): string {
  return hotp(secret, Math.floor(at / 1000 / 30));
}

// 앞뒤 30초 창 허용(시계 오차)
export function verifyTotp(
  secret: string,
  code: string,
  at = Date.now(),
): boolean {
  const c = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(c)) return false;
  const step = Math.floor(at / 1000 / 30);
  for (const d of [-1, 0, 1]) {
    const expected = hotp(secret, step + d);
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(c))) return true;
  }
  return false;
}

export function otpauthUrl(
  issuer: string,
  account: string,
  secret: string,
): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

// 복구 코드 8개(xxxx-xxxx). 화면에 한 번만 보여주고 서버엔 해시만 저장
export function generateRecoveryCodes(n = 8): string[] {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789"; // 헷갈리는 글자(i,l,o,0,1) 제외
  return Array.from({ length: n }, () => {
    const b = randomBytes(8);
    let s = "";
    for (let i = 0; i < 8; i++) s += alphabet[b[i] % alphabet.length];
    return `${s.slice(0, 4)}-${s.slice(4)}`;
  });
}

export function normalizeRecoveryCode(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, "");
}
