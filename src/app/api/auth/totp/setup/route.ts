import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { generateTotpSecret, otpauthUrl } from "@/lib/totp";

// 2단계 인증 설정 시작: 임시 비밀키 생성 → QR·수동 입력용 키 반환. enable에서 코드 확인 전까진 미적용
export async function POST() {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 },
    );

  const secret = generateTotpSecret();
  await prisma.user.update({
    where: { id: user.id },
    data: { totpPendingSecret: secret },
  });
  const url = otpauthUrl("차량손상AI진단", user.employeeId, secret);
  const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 220 });
  return NextResponse.json({
    ok: true,
    secret: secret.match(/.{1,4}/g)?.join(" ") ?? secret,
    qrDataUrl,
  });
}
