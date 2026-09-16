import "server-only";
import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import {
  recordBlockedRun,
  TOOL_LABEL,
  type AiTool,
  type RunStart,
} from "./ai-usage";
import { dayStart, monthStart } from "./admin-stats";
import {
  DEFAULT_POLICY,
  UsagePolicySchema,
  type UsagePolicy,
} from "./usage-policy-schema";

const KEY = "usage-policy";

export async function getPolicy(): Promise<UsagePolicy> {
  const row = await prisma.appSetting.findUnique({ where: { key: KEY } });
  if (!row) return DEFAULT_POLICY;
  const parsed = UsagePolicySchema.safeParse(row.value);
  // 예전 저장분에 새 필드가 없으면 기본값으로 메움
  return parsed.success
    ? parsed.data
    : { ...DEFAULT_POLICY, ...(row.value as Partial<UsagePolicy>) };
}

export async function savePolicy(value: UsagePolicy, updatedBy: string) {
  return prisma.appSetting.upsert({
    where: { key: KEY },
    update: { value, updatedBy },
    create: { key: KEY, value, updatedBy },
  });
}

export interface PolicyInput extends RunStart {
  role: "EMPLOYEE" | "ADMIN";
  confirmDuplicate: boolean;
}

export type PolicyResult =
  | { ok: true; warning?: string }
  | { ok: false; kind: "block"; code: string; message: string }
  | { ok: false; kind: "confirm"; code: "duplicate"; message: string };

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

// 검사 순서: 도구 on/off → 사진 수 → 계정 한도 → 월 예산 → 견적 금액 → 같은 차량 재실행
export async function checkPolicy(input: PolicyInput): Promise<PolicyResult> {
  const p = await getPolicy();
  const label = TOOL_LABEL[input.tool];
  const exempt = input.role === "ADMIN" && p.exemptAdmins;
  const block = (code: string, message: string): PolicyResult => ({
    ok: false,
    kind: "block",
    code,
    message: `${message} ${p.blockMessage}`.trim(),
  });

  if (!p.toolEnabled[input.tool])
    return block(
      "tool_disabled",
      `${label} 도구는 현재 사용이 중지돼 있습니다.`,
    );

  if (p.maxPhotos != null && input.photoCount > p.maxPhotos)
    return block(
      "too_many_photos",
      `사진은 최대 ${p.maxPhotos}장까지 첨부할 수 있습니다(첨부 ${input.photoCount}장).`,
    );

  // 견적 금액 — 견적서가 있을 때만(estimateAmount null이면 선견적 사진 단독)
  if (input.tool !== "procedure" && input.estimateAmount != null) {
    const min = p.minEstimate[input.tool];
    const max = p.maxEstimate[input.tool];
    if (min != null && input.estimateAmount < min)
      return block(
        "estimate_below_min",
        `견적 금액 ${won(input.estimateAmount)}은 ${label} 사용 하한(${won(min)}) 미만입니다.`,
      );
    if (max != null && input.estimateAmount > max)
      return block(
        "estimate_above_max",
        `견적 금액 ${won(input.estimateAmount)}은 ${label} 사용 상한(${won(max)})을 넘습니다.`,
      );
  }

  if (!exempt) {
    const now = new Date();
    const [daily, monthly, budget] = await Promise.all([
      p.perUserDailyRuns != null
        ? prisma.aiRun.count({
            where: {
              userId: input.user.id,
              createdAt: { gte: dayStart(now) },
              status: { in: ["succeeded", "queued"] },
            },
          })
        : Promise.resolve(0),
      p.perUserMonthlyRuns != null || p.perUserMonthlyCostKrw != null
        ? prisma.aiRun.aggregate({
            where: {
              userId: input.user.id,
              createdAt: { gte: monthStart(now) },
              status: { in: ["succeeded", "queued"] },
            },
            _count: { _all: true },
            _sum: { costKrw: true },
          })
        : Promise.resolve(null),
      p.monthlyBudgetKrw != null
        ? prisma.aiRun.aggregate({
            where: { createdAt: { gte: monthStart(now) }, status: "succeeded" },
            _sum: { costKrw: true },
          })
        : Promise.resolve(null),
    ]);
    if (p.perUserDailyRuns != null && daily >= p.perUserDailyRuns)
      return block(
        "daily_limit",
        `오늘 실행 한도(${p.perUserDailyRuns}건)에 도달했습니다.`,
      );
    if (
      monthly &&
      p.perUserMonthlyRuns != null &&
      monthly._count._all >= p.perUserMonthlyRuns
    )
      return block(
        "monthly_limit",
        `이번 달 실행 한도(${p.perUserMonthlyRuns}건)에 도달했습니다.`,
      );
    if (
      monthly &&
      p.perUserMonthlyCostKrw != null &&
      (monthly._sum.costKrw ?? 0) >= p.perUserMonthlyCostKrw
    )
      return block(
        "monthly_cost_limit",
        `이번 달 사용 비용 한도(${won(p.perUserMonthlyCostKrw)})에 도달했습니다.`,
      );
    if (
      budget &&
      p.monthlyBudgetKrw != null &&
      (budget._sum.costKrw ?? 0) >= p.monthlyBudgetKrw
    )
      return block(
        "budget_exhausted",
        `이번 달 전체 AI 예산(${won(p.monthlyBudgetKrw)})이 소진됐습니다.`,
      );

    // 같은 차량 재실행
    if (input.plateNo && p.dupAction !== "allow" && p.dupWindowDays > 0) {
      const since = new Date(now.getTime() - p.dupWindowDays * 86400_000);
      const prev = await prisma.aiRun.findMany({
        where: {
          plateNo: input.plateNo,
          tool: input.tool,
          createdAt: { gte: since },
          status: "succeeded",
        },
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true } } },
      });
      if (prev.length >= p.dupMaxRuns) {
        const last = prev[0];
        const who = last.user?.name ?? last.employeeId;
        const when = last.createdAt.toLocaleString("ko-KR", {
          month: "numeric",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        const cost = last.costKrw != null ? `, 비용 ${won(last.costKrw)}` : "";
        const msg = `차량 ${input.plateNo}은 최근 ${p.dupWindowDays}일 안에 ${label}을 ${prev.length}회 실행했습니다(마지막 ${when} ${who}${cost}).`;
        if (p.dupAction === "block") return block("duplicate", msg);
        if (!input.confirmDuplicate)
          return {
            ok: false,
            kind: "confirm",
            code: "duplicate",
            message: `${msg} 그래도 다시 실행할까요? 토큰 비용이 다시 발생합니다.`,
          };
        return { ok: true, warning: msg };
      }
    }
  }
  return { ok: true };
}

// 라우트용: 검사 후 막아야 하면 응답을 만들어 돌려주고(차단 기록 포함), 통과면 null
export async function enforcePolicy(
  input: PolicyInput,
): Promise<NextResponse | null> {
  const r = await checkPolicy(input);
  if (r.ok) return null;
  if (r.kind === "confirm")
    return NextResponse.json(
      { error: r.message, code: r.code, confirmRequired: true },
      { status: 409 },
    );
  await recordBlockedRun(input, `${r.code}: ${r.message}`).catch((e) =>
    console.error("[policy] record failed", e),
  );
  return NextResponse.json(
    { error: r.message, code: r.code, blocked: true },
    { status: 403 },
  );
}

// 관리자 개요의 이상 징후
export async function getAnomalies() {
  const p = await getPolicy();
  const now = new Date();
  const month = monthStart(now);
  const weekAgo = new Date(now.getTime() - 7 * 86400_000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400_000);
  const [budgetAgg, thisWeek, lastWeek, dups, recentFails] = await Promise.all([
    prisma.aiRun.aggregate({
      where: { createdAt: { gte: month }, status: "succeeded" },
      _sum: { costKrw: true },
    }),
    prisma.aiRun.groupBy({
      by: ["userId", "employeeId"],
      where: { createdAt: { gte: weekAgo }, status: "succeeded" },
      _count: { _all: true },
    }),
    prisma.aiRun.groupBy({
      by: ["userId"],
      where: {
        createdAt: { gte: twoWeeksAgo, lt: weekAgo },
        status: "succeeded",
      },
      _count: { _all: true },
    }),
    prisma.aiRun.groupBy({
      by: ["plateNo", "tool"],
      where: {
        createdAt: { gte: month },
        status: "succeeded",
        plateNo: { not: null },
      },
      _count: { _all: true },
      having: { plateNo: { _count: { gte: 3 } } },
    }),
    prisma.aiRun.findMany({
      where: {
        createdAt: { gte: weekAgo },
        status: { in: ["failed", "succeeded"] },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { status: true },
    }),
  ]);
  const items: { tone: "warn" | "error"; text: string; href: string }[] = [];
  const spent = budgetAgg._sum.costKrw ?? 0;
  if (p.monthlyBudgetKrw != null) {
    const pct = Math.round((spent / p.monthlyBudgetKrw) * 100);
    if (pct >= 100)
      items.push({
        tone: "error",
        text: `월 예산 소진 — ${won(spent)} / ${won(p.monthlyBudgetKrw)}. 직원 실행이 차단됩니다.`,
        href: "/admin/policy",
      });
    else if (pct >= p.budgetWarnPct)
      items.push({
        tone: "warn",
        text: `월 예산 ${pct}% 사용 — ${won(spent)} / ${won(p.monthlyBudgetKrw)}`,
        href: "/admin/usage",
      });
  }
  const lastMap = new Map(lastWeek.map((r) => [r.userId, r._count._all]));
  for (const r of thisWeek) {
    const prev = lastMap.get(r.userId) ?? 0;
    if (r._count._all >= 5 && r._count._all >= prev * 2)
      items.push({
        tone: "warn",
        text: `${r.employeeId} 계정 이번 주 ${r._count._all}건 — 전주(${prev}건) 대비 급증`,
        href: `/admin/runs?range=7d&user=${r.userId ?? ""}`,
      });
  }
  for (const d of dups)
    items.push({
      tone: "warn",
      text: `차량 ${d.plateNo} ${TOOL_LABEL[d.tool as AiTool] ?? d.tool} ${d._count._all}회 실행(이번 달)`,
      href: `/admin/runs?range=month&plate=${encodeURIComponent(d.plateNo ?? "")}`,
    });
  if (
    recentFails.length >= 3 &&
    recentFails.slice(0, 3).every((r) => r.status === "failed")
  )
    items.push({
      tone: "error",
      text: "최근 실행 3건 연속 실패 — OpenAI 크레딧·키·장애 확인 필요",
      href: "/admin/runs?range=7d&status=failed",
    });
  return { items, policy: p, monthSpent: spent };
}
