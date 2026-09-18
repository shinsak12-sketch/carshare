// 브라우저 쪽: 시작 응답({ jobId } 또는 { result })을 받아 결과가 나올 때까지 몇 초마다 상태를 묻는다.
// 작업은 OpenAI 쪽에서 완성되므로 중간에 새로고침해도 jobId만 있으면 이어받을 수 있다.

export type JobStartResponse<T> = { jobId: string } | { result: T };

// 서버가 "이 작업은 끝났고 실패"라고 확정한 경우. 이어받기 정보를 지워도 되는 유일한 실패.
// 그 외(네트워크·일시 오류)는 jobId를 남겨 두면 새로고침으로 이어받을 수 있다.
export class JobFailedError extends Error {
  code?: string; // "already_collected" = 다른 탭이 이미 결과를 받아 저장함
  constructor(message: string, code?: string) {
    super(message);
    this.name = "JobFailedError";
    this.code = code;
  }
}

// 결과를 브라우저에 저장한 뒤에만 호출 — 그제야 서버가 OpenAI 저장본을 지운다
export function ackAiJob(jobId: string) {
  void fetch("/api/ai-job", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: jobId, ack: true }),
  }).catch(() => undefined);
}

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
  // 결과를 받으면 먼저 저장(호출자 책임)하고, 저장이 예외 없이 끝난 뒤에만 OpenAI 저장본 삭제를 요청
  onResult?: (result: T) => void,
): Promise<T> {
  if ("result" in start) {
    onResult?.(start.result);
    return start.result;
  }
  const jobId = start.jobId;
  onJobId?.(jobId);
  const started = Date.now();
  let interval = 2500;
  let consecutiveErrors = 0;
  for (;;) {
    onProgress(
      `${label}… (${fmtElapsed(Date.now() - started)} 경과, 사진이 많으면 수 분 소요)`,
    );
    await new Promise((r) => setTimeout(r, interval));
    interval = Math.min(interval + 500, 6000);
    let data: { status?: string; result?: T; error?: string; code?: string };
    try {
      const res = await fetch("/api/ai-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: jobId, imageUrls }),
      });
      data = await res.json();
      if (!res.ok)
        throw new Error(data.error ?? `상태 조회 실패 (${res.status})`);
      consecutiveErrors = 0;
    } catch (err) {
      // 일시 오류는 몇 번 더 시도하되, 계속 실패하면 멈추고 알린다(새로고침하면 이어받음).
      // 예전엔 20분 동안 조용히 돌아서 "진행 중"에 갇혔음.
      consecutiveErrors += 1;
      if (consecutiveErrors >= 6 || Date.now() - started > 20 * 60 * 1000)
        throw err instanceof Error
          ? new Error(
              `${err.message} — 상태 조회가 계속 실패합니다. 페이지를 새로고침하면 이어받습니다.`,
            )
          : err;
      continue;
    }
    if (data.status === "completed" && data.result !== undefined) {
      onResult?.(data.result); // 여기서 예외가 나면 ack 없이 던져져 결과는 OpenAI에 남는다
      ackAiJob(jobId);
      return data.result;
    }
    if (data.status === "failed")
      throw new JobFailedError(
        data.error ?? "AI 판단에 실패했습니다.",
        data.code,
      );
    if (Date.now() - started > 25 * 60 * 1000)
      throw new Error(
        "AI 판단이 너무 오래 걸립니다. 페이지를 새로고침하면 이어받습니다.",
      );
  }
}

// 도구 API에 폼을 보내고 시작 응답을 받는다. 정책 검사 결과를 처리:
//  - 409 + confirmRequired: 같은 차량 재실행 경고 → 확인창, 동의하면 confirmDuplicate=1로 한 번 재전송
//  - 403 + blocked: 사유를 그대로 에러로
//  - JSON이 아닌 응답(413 등)은 상태코드 기준 메시지
export async function postToolForm<T>(
  url: string,
  formData: FormData,
  fileLabel = "첨부 파일",
): Promise<JobStartResponse<T>> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, { method: "POST", body: formData });
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      const text = await res.text();
      throw new Error(
        res.status === 413
          ? `${fileLabel} 용량이 너무 큽니다. 다른 파일로 다시 시도해주세요.`
          : `서버 오류 (${res.status}): ${text.slice(0, 200)}`,
      );
    }
    const data = (await res.json()) as JobStartResponse<T> & {
      error?: string;
      confirmRequired?: boolean;
    };
    if (res.status === 409 && data.confirmRequired) {
      if (attempt === 0 && window.confirm(data.error ?? "다시 실행할까요?")) {
        formData.set("confirmDuplicate", "1");
        continue;
      }
      throw new Error("실행을 취소했습니다.");
    }
    if (!res.ok) throw new Error(data.error ?? "요청에 실패했습니다.");
    return data;
  }
  throw new Error("요청에 실패했습니다.");
}
