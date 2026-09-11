import { upload } from "@vercel/blob/client";
import { compressImage } from "./image-compress";

// 세 도구 공통: 브라우저에서 사진을 압축해 Vercel Blob에 직접 올리고 URL 목록을 돌려줌.
// 서버 요청 바디 제한(4.5MB)을 우회하는 통로이며, 서버는 분석 후 Blob을 즉시 지움.
// 진행률은 "압축 → 업로드" 두 단계를 각각 세서 장수가 적어도 차근차근 올라가게 함.
export async function uploadPhotos(
  photos: File[],
  onProgress: (text: string) => void,
  concurrency = 4,
): Promise<{ urls: string[]; compressed: File[] }> {
  const total = photos.length;
  const urls: (string | undefined)[] = new Array(total);
  const compressed: File[] = new Array(total);
  let done = 0; // 완료 단계 수 (압축 + 업로드 = 2단계/장)
  const report = () => {
    const photosDone = Math.floor(done / 2);
    onProgress(`사진 업로드 중… (${photosDone}/${total})`);
  };
  report();

  let cursor = 0;
  async function worker() {
    while (cursor < total) {
      const i = cursor++;
      const c = await compressImage(photos[i]);
      compressed[i] = c;
      done++;
      report();
      const blob = await upload(c.name, c, {
        access: "public",
        handleUploadUrl: "/api/blob-upload",
      });
      urls[i] = blob.url;
      done++;
      report();
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, total) }, worker),
  );

  // 업로드가 덜 된 채로 분석에 넘어가지 않도록 검증
  const missing = urls.map((u, i) => (u ? -1 : i + 1)).filter((i) => i > 0);
  if (missing.length) {
    throw new Error(
      `사진 ${missing.join(", ")}번 업로드가 완료되지 않았습니다. 다시 시도해주세요.`,
    );
  }
  onProgress(`사진 업로드 완료 (${total}/${total})`);
  return { urls: urls as string[], compressed };
}
