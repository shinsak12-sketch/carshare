import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { AuditAction, getRequestMeta, logAudit } from "@/lib/audit-log";

export async function POST(req: NextRequest) {
  const { ip, userAgent } = getRequestMeta(req);
  const form = await req.formData();
  const employeeId = String(form.get("employeeId") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const passwordConfirm = String(form.get("passwordConfirm") ?? "");

  if (!employeeId || !name || !password) {
    return NextResponse.json({ error: "사번, 이름, 비밀번호를 모두 입력해주세요." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "비밀번호는 8자 이상이어야 합니다." }, { status: 400 });
  }
  if (password !== passwordConfirm) {
    return NextResponse.json({ error: "비밀번호가 서로 일치하지 않습니다." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { employeeId } });
  if (existing) {
    return NextResponse.json(
      { error: "이미 등록되었거나 신청 중인 사번입니다. 관리자에게 문의해주세요." },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { employeeId, name, passwordHash, status: "PENDING" },
  });

  await logAudit({
    action: AuditAction.ACCOUNT_REQUESTED,
    actorUserId: user.id,
    actorEmployeeId: user.employeeId,
    targetType: "User",
    targetId: user.id,
    ip,
    userAgent,
  });

  return NextResponse.json({ ok: true });
}
