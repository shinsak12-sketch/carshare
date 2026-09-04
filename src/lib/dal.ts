import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser } from "./session";

// 페이지·레이아웃(서버 컴포넌트) 전용 가드. API 라우트에서는 redirect()가
// JSON 응답에 맞지 않으므로 getCurrentUser()를 직접 써서 401/403을 반환할 것.
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");
  return user;
}
