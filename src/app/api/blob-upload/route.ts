import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";

// 브라우저가 우리 서버(Vercel 함수)를 거치지 않고 Vercel Blob에 사진을
// 직접 업로드할 수 있도록 1회용 업로드 토큰만 발급하는 엔드포인트.
// 사진 바이트 자체는 이 라우트를 통과하지 않음 — 그래서 Vercel 서버리스
// 함수의 요청 바디 제한(약 4.5MB)과 무관해짐.
export async function POST(request: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
        addRandomSuffix: true,
        maximumSizeInBytes: 10 * 1024 * 1024,
      }),
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "업로드 토큰 발급에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
