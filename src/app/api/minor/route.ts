import { after, NextRequest, NextResponse } from "next/server";
import { startStructuredJob } from "@/lib/ai-job";
import { resolveModel } from "@/lib/ai-model";
import { buildSystemPrompt } from "@/lib/output-mode";
import {
  MINOR_PROMPT_VERSION_TAG,
  MINOR_RESPONSE_SCHEMA,
  MINOR_SYSTEM_PROMPT,
} from "@/lib/minor-prompt";
import {
  MINOR_PART_ALIASES,
  MINOR_PARTS,
  type MinorPartInput,
} from "@/lib/minor-types";
import { getCurrentUser } from "@/lib/session";
import { sweepStaleBlobs } from "@/lib/blob-cleanup";
import { AuditAction, getRequestMeta, logAudit } from "@/lib/audit-log";
import {
  attachJob,
  completeRun,
  createRun,
  failRun,
  normalizePlate,
} from "@/lib/ai-usage";
import { enforcePolicy } from "@/lib/usage-policy";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    return await handle(req);
  } catch (err) {
    console.error("[/api/minor] failed:", err);
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handle(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 },
    );

  const form = await req.formData();
  const str = (k: string) => (form.get(k) ? String(form.get(k)).trim() : "");
  const manufacturer = str("manufacturer");
  const model = str("model");
  const year = str("year");
  const memo = str("memo");

  let imageUrls: string[] = [];
  try {
    imageUrls = JSON.parse(str("imageUrls") || "[]");
  } catch {
    imageUrls = [];
  }
  if (!Array.isArray(imageUrls) || imageUrls.length === 0)
    return NextResponse.json(
      { error: "외판 사진을 1장 이상 첨부해주세요." },
      { status: 400 },
    );

  let parts: MinorPartInput[] = [];
  try {
    parts = JSON.parse(str("parts") || "[]");
  } catch {
    parts = [];
  }
  parts = Array.isArray(parts)
    ? parts.filter(
        (p) =>
          p &&
          [...MINOR_PARTS, ...MINOR_PART_ALIASES].includes(p.part_name) &&
          ["좌", "우", "중앙"].includes(p.side),
      )
    : [];
  if (parts.length === 0)
    return NextResponse.json(
      { error: "도해도에서 판독할 부위를 하나 이상 선택해주세요." },
      { status: 400 },
    );

  const partLines = parts.map(
    (p, i) =>
      `${i + 1}. ${p.part_name}${p.side === "중앙" ? "" : `(${p.side})`}`,
  );
  const contextLines = [
    manufacturer || model || year
      ? `차량정보: ${manufacturer} ${model} ${year ? year + "년식" : ""}`.trim()
      : null,
    `[판독 대상 부위]\n${partLines.join("\n")}`,
    memo ? `[담당자 메모]\n${memo}` : null,
    `첨부된 사진은 총 ${imageUrls.length}장이며 첨부 순서대로 1번부터 번호가 매겨져 있습니다.`,
  ].filter(Boolean);

  const aiModel = await resolveModel();
  const runInput = {
    user,
    tool: "minor" as const,
    promptVersion: MINOR_PROMPT_VERSION_TAG,
    model: aiModel.id,
    photoCount: imageUrls.length,
    plateNo: normalizePlate(str("plateNo") || null),
  };
  const denied = await enforcePolicy({
    ...runInput,
    role: user.role,
    confirmDuplicate: form.get("confirmDuplicate") === "1",
  });
  if (denied) return denied;

  const run = await createRun(runInput);
  let started;
  try {
    started = await startStructuredJob({
      // 짧은 회신문이 산출물이라 출력 상세도 설정과 무관하게 항상 상세
      system: buildSystemPrompt(
        MINOR_SYSTEM_PROMPT,
        MINOR_RESPONSE_SCHEMA,
        "detailed",
      ),
      userText: contextLines.join("\n\n"),
      imageUrls,
      schemaName: "minor_damage_result",
      schema: MINOR_RESPONSE_SCHEMA as unknown as Record<string, unknown>,
      effort: "medium",
      model: aiModel,
    });
  } catch (err) {
    await failRun(run.id, err instanceof Error ? err.message : String(err));
    throw err;
  }
  if ("jobId" in started) await attachJob(run.id, started.jobId);
  else await completeRun(run.id, started.usage, started.result);

  const { ip, userAgent } = getRequestMeta(req);
  void logAudit({
    action: AuditAction.MINOR_CHECKED,
    actorUserId: user.id,
    actorEmployeeId: user.employeeId,
    detail:
      `${manufacturer} ${model}`.trim() +
      ` · ${partLines.map((l) => l.replace(/^\d+\. /, "")).join(", ")}`,
    ip,
    userAgent,
  });
  after(async () => {
    await sweepStaleBlobs("/api/minor");
  });
  return NextResponse.json(
    "jobId" in started ? started : { result: started.result },
  );
}
