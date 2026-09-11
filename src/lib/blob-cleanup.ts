import { del, list } from "@vercel/blob";

// Blob은 사진이 GPT에 전달되는 동안만 잠깐 거쳐가는 통로 — 저장 정책상 분석이 끝나면 지운다.
// 응답을 보낸 뒤 실행되므로 반드시 next/server의 after() 안에서 await 해야 함
// (void로 던지면 Vercel이 응답 직후 함수를 얼려 삭제가 실행되지 않은 채 남음).
export async function deleteBlobs(urls: string[], tag: string): Promise<void> {
  if (!urls.length) return;
  try {
    await del(urls);
  } catch (err) {
    console.error(`[${tag}] blob cleanup failed:`, err);
  }
}

// 업로드만 되고 분석 요청이 안 간 사진(탭 닫음, 중간 오류)은 지울 기회가 없으므로
// 분석 요청이 올 때마다 오래된 찌꺼기를 쓸어낸다. 분석은 길어야 5분이라 30분이면 충분.
export async function sweepStaleBlobs(
  tag: string,
  maxAgeMs = 30 * 60 * 1000,
): Promise<void> {
  try {
    const cutoff = Date.now() - maxAgeMs;
    let cursor: string | undefined;
    const stale: string[] = [];
    do {
      const page = await list({ limit: 500, cursor });
      for (const b of page.blobs)
        if (new Date(b.uploadedAt).getTime() < cutoff) stale.push(b.url);
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor && stale.length < 2000);
    if (stale.length) {
      await del(stale);
      console.warn(`[${tag}] swept ${stale.length} stale blobs`);
    }
  } catch (err) {
    console.error(`[${tag}] stale blob sweep failed:`, err);
  }
}
