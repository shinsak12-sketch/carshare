// 브라우저 쪽: 시작 응답({ jobId } 또는 { result })을 받아 결과가 나올 때까지 몇 초마다 상태를 묻는다.
// 작업은 OpenAI 쪽에서 완성되므로 중간에 새로고침해도 jobId만 있으면 이어받을 수 있다.

export type JobStartResponse<T> = { jobId: string } | { result: T };

function fmtElapsed(ms: number): string {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}초` : `${Math.floor(s / 60)}분 ${s % 60}초`;
}

export async function runAiJob<T>(
  start: JobStartResponse<T>,
  imageUrls: string[],
  onProgress: (text: string) => void,
  onJobId?: (jobId: string) => void,
  label = "AI 판단 중",
): Promise<T> {
  if ("result" in start) return start.result;
  const jobId = start.jobId;
  onJobId?.(jobId);
  const started = Date.now();
  let interval = 2500;
  for (;;) {
    onProgress(
      `${label}… (${fmtElapsed(Date.now() - started)} 경과, 사진이 많으면 수 분 소요)`,
    );
    await new Promise((r) => setTimeout(r, interval));
    interval = Math.min(interval + 500, 6000);
    let data: { status?: string; result?: T; error?: string };
    try {
      const res = await fetch("/api/ai-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: jobId, imageUrls }),
      });
      data = await res.json();
      if (!res.ok)
        throw new Error(data.error ?? `상태 조회 실패 (${res.status})`);
    } catch (err) {
      // 네트워크 일시 오류는 다음 폴링에서 다시 시도
      if (Date.now() - started > 20 * 60 * 1000) throw err;
      continue;
    }
    if (data.status === "completed" && data.result !== undefined)
      return data.result;
    if (data.status === "failed")
      throw new Error(data.error ?? "AI 판단에 실패했습니다.");
    if (Date.now() - started > 25 * 60 * 1000)
      throw new Error("AI 판단이 너무 오래 걸립니다. 다시 시도해주세요.");
  }
}
