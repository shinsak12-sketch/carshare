import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { listRuns, type Range } from "@/lib/admin-stats";
import { TOOL_LABEL, type AiTool } from "@/lib/ai-usage";
import { fmtKst } from "@/lib/kst";

export const dynamic = "force-dynamic";

// 실행 이력 CSV (관리자). 결과 본문은 없음 — 토큰·비용·건 메타만.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN")
    return NextResponse.json(
      { error: "관리자 권한이 필요합니다." },
      { status: 403 },
    );
  const sp = req.nextUrl.searchParams;
  const range = (
    ["today", "7d", "30d", "month"].includes(sp.get("range") ?? "")
      ? sp.get("range")
      : "month"
  ) as Range;
  const tool = (sp.get("tool") || null) as AiTool | null;
  const runs = await listRuns({ range, tool }, 5000);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = [
    "시각",
    "사번",
    "이름",
    "도구",
    "상태",
    "차량번호",
    "접수번호",
    "사진수",
    "견적금액",
    "입력토큰",
    "캐시토큰",
    "출력토큰",
    "추론토큰",
    "비용USD",
    "비용KRW",
    "소요초",
    "프롬프트",
    "차단사유",
    "오류",
  ];
  const lines = runs.map((r) =>
    [
      fmtKst(r.createdAt),
      r.employeeId,
      r.user?.name ?? "",
      TOOL_LABEL[r.tool as AiTool] ?? r.tool,
      r.status,
      r.plateNo ?? "",
      r.claimNo ?? "",
      r.photoCount,
      r.estimateAmount ?? "",
      r.inputTokens,
      r.cachedInputTokens,
      r.outputTokens,
      r.reasoningTokens,
      r.costUsd?.toFixed(4) ?? "",
      r.costKrw ?? "",
      r.durationMs ? Math.round(r.durationMs / 1000) : "",
      r.promptVersion,
      r.blockedReason ?? "",
      r.errorMessage ?? "",
    ]
      .map(esc)
      .join(","),
  );
  const csv = "﻿" + [head.map(esc).join(","), ...lines].join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ai-usage-${range}.csv"`,
    },
  });
}
