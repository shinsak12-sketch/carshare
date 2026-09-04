import "server-only";
import { randomBytes } from "crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

const COOKIE_NAME = "carshare_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12시간 — 사내 도구라 근무시간 기준으로 짧게 잡음

export async function createSession(
  userId: string,
  meta: { ip: string | null; userAgent: string | null }
) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: { id: token, userId, expiresAt, ip: meta.ip, userAgent: meta.userAgent },
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    await prisma.session.delete({ where: { id: token } }).catch(() => {
      // 이미 만료/삭제된 세션이면 조용히 무시
    });
  }
  cookieStore.delete(COOKIE_NAME);
}

// 같은 렌더 패스 안에서 여러 번 호출돼도 DB 조회는 한 번만 하도록 React cache로 감쌈.
export const getCurrentUser = cache(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { id: token },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) return null;
  if (session.user.status !== "ACTIVE") return null;

  return session.user;
});
