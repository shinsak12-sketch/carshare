import bcrypt from "bcryptjs";

// 사내 도구라 12라운드까진 불필요 — 10라운드도 충분히 안전하면서 로그인/가입 체감 속도가 빠름
const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
