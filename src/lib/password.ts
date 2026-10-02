import bcrypt from "bcryptjs";

// 사내 도구라 12라운드까진 불필요 — 10라운드도 충분히 안전하면서 로그인/가입 체감 속도가 빠름
const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export const PASSWORD_RULE_TEXT =
  "10자 이상, 영문과 숫자를 모두 포함, 공백 없이. 사번을 포함하면 안 됨.";

// 가입·관리자 초기화·본인 변경 모두 같은 규칙. 통과하면 null, 아니면 사유.
export function validatePassword(
  password: string,
  employeeId?: string | null,
): string | null {
  if (password.length < 10) return "비밀번호는 10자 이상이어야 합니다.";
  if (password.length > 128) return "비밀번호가 너무 깁니다(128자 이하).";
  if (/\s/.test(password)) return "비밀번호에 공백을 넣을 수 없습니다.";
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password))
    return "비밀번호는 영문과 숫자를 모두 포함해야 합니다.";
  const id = (employeeId ?? "").trim().toLowerCase();
  if (id.length >= 3 && password.toLowerCase().includes(id))
    return "비밀번호에 사번을 포함할 수 없습니다.";
  if (/^(.)\1+$/.test(password))
    return "같은 문자만 반복된 비밀번호는 쓸 수 없습니다.";
  if (/^(0123456789|1234567890|password\d*|qwerty\d*)$/i.test(password))
    return "너무 흔한 비밀번호입니다.";
  return null;
}
