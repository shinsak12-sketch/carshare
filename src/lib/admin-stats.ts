import { prisma } from "./prisma";
import { AuditAction } from "./audit-log";
import { TOOL_LABEL, type AiTool } from "./ai-usage";
import { kstDayKey, kstDayStart, kstMonthStart } from "./kst";

// 관리자 화면용 집계. 모두 AiRun 기준(결과 본문 없음, 토큰·비용·건수만).

// 날짜 경계는 한국시간 기준(서버는 UTC)
export const monthStart = kstMonthStart;
export const dayStart = kstDayStart;

export async function getDashboardStats() {
  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const month = monthStart(now);
  const today = dayStart(now);

  const [
    pendingCount,
    activeCount,
    loginFail24h,
    monthAgg,
    todayCount,
    blockedMonth,
    failedMonth,
    dupGroups,
    recent,
  ] = await Promise.all([
    prisma.user.count({ where: { status: "PENDING" } }),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.auditLog.count({
      where: { action: AuditAction.LOGIN_FAIL, createdAt: { gte: since24h } },
    }),
    prisma.aiRun.aggregate({
      where: { createdAt: { gte: month }, status: "succeeded" },
      _sum: { costKrw: true, costUsd: true },
      _count: { _all: true },
    }),
    prisma.aiRun.count({
      where: {
        createdAt: { gte: today },
        status: { in: ["succeeded", "queued"] },
      },
    }),
    prisma.aiRun.count({
      where: { createdAt: { gte: month }, status: "blocked" },
    }),
    prisma.aiRun.count({
      where: { createdAt: { gte: month }, status: "failed" },
    }),
    prisma.aiRun.groupBy({
      by: ["plateNo", "tool"],
      where: {
        createdAt: { gte: month },
        status: "succeeded",
        plateNo: { not: null },
      },
      _count: { _all: true },
      having: { plateNo: { _count: { gt: 1 } } },
    }),
    prisma.aiRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { user: { select: { name: true } } },
    }),
  ]);

  const monthCost = monthAgg._sum.costKrw ?? 0;
  const monthCostUsd = monthAgg._sum.costUsd ?? 0;
  const monthRuns = monthAgg._count._all;
  return {
    pendingCount,
    activeCount,
    loginFail24h,
    monthCost,
    monthCostUsd,
    monthRuns,
    avgCost: monthRuns ? Math.round(monthCost / monthRuns) : 0,
    avgCostUsd: monthRuns ? monthCostUsd / monthRuns : 0,
    todayCount,
    blockedMonth,
    failedMonth,
    duplicateVehicles: dupGroups.length,
    recent,
  };
}

export type Range = "today" | "7d" | "month" | "30d";
export function rangeStart(r: Range): Date {
  const now = new Date();
  if (r === "today") return dayStart(now);
  if (r === "7d") return new Date(now.getTime() - 7 * 86400_000);
  if (r === "30d") return new Date(now.getTime() - 30 * 86400_000);
  return monthStart(now);
}

export interface UsageRow {
  key: string;
  label: string;
  sub?: string;
  runs: number;
  failed: number;
  blocked: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  costKrw: number;
  costUsd: number;
  maxCostKrw: number;
  maxCostUsd: number;
  verdicts: Record<string, number>;
}

function emptyRow(key: string, label: string, sub?: string): UsageRow {
  return {
    key,
    label,
    sub,
    runs: 0,
    failed: 0,
    blocked: 0,
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    costKrw: 0,
    costUsd: 0,
    maxCostKrw: 0,
    maxCostUsd: 0,
    verdicts: {},
  };
}

export async function getUsageStats(range: Range, tool?: AiTool | null) {
  const since = rangeStart(range);
  const runs = await prisma.aiRun.findMany({
    where: { createdAt: { gte: since }, ...(tool ? { tool } : {}) },
    include: { user: { select: { name: true, employeeId: true } } },
    orderBy: { createdAt: "asc" },
  });

  const byUser = new Map<string, UsageRow>();
  const byTool = new Map<string, UsageRow>();
  const byDay = new Map<
    string,
    { day: string; runs: number; costKrw: number; costUsd: number }
  >();

  const add = (row: UsageRow, r: (typeof runs)[number]) => {
    if (r.status === "blocked") {
      row.blocked += 1;
      return;
    }
    if (r.status === "failed") row.failed += 1;
    if (r.status === "succeeded") row.runs += 1;
    row.inputTokens += r.inputTokens;
    row.cachedInputTokens += r.cachedInputTokens;
    row.outputTokens += r.outputTokens;
    row.reasoningTokens += r.reasoningTokens;
    row.costKrw += r.costKrw ?? 0;
    row.costUsd += r.costUsd ?? 0;
    if ((r.costKrw ?? 0) > row.maxCostKrw) {
      row.maxCostKrw = r.costKrw ?? 0;
      row.maxCostUsd = r.costUsd ?? 0;
    }
    const vc = (r.verdictCounts ?? null) as Record<string, number> | null;
    if (vc)
      for (const [k, v] of Object.entries(vc))
        row.verdicts[k] = (row.verdicts[k] ?? 0) + v;
  };

  for (const r of runs) {
    const uKey = r.userId ?? r.employeeId;
    if (!byUser.has(uKey))
      byUser.set(
        uKey,
        emptyRow(
          uKey,
          r.user?.name ?? r.employeeId,
          r.user?.employeeId ?? r.employeeId,
        ),
      );
    add(byUser.get(uKey)!, r);

    const tKey = r.tool;
    if (!byTool.has(tKey))
      byTool.set(tKey, emptyRow(tKey, TOOL_LABEL[tKey as AiTool] ?? tKey));
    add(byTool.get(tKey)!, r);

    const day = kstDayKey(r.createdAt);
    const d = byDay.get(day) ?? { day, runs: 0, costKrw: 0, costUsd: 0 };
    if (r.status === "succeeded") {
      d.runs += 1;
      d.costKrw += r.costKrw ?? 0;
      d.costUsd += r.costUsd ?? 0;
    }
    byDay.set(day, d);
  }

  const total = emptyRow("total", "합계");
  for (const r of runs) add(total, r);

  return {
    since,
    total,
    byUser: [...byUser.values()].sort((a, b) => b.costKrw - a.costKrw),
    byTool: [...byTool.values()].sort((a, b) => b.costKrw - a.costKrw),
    byDay: [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)),
  };
}

export interface RunFilter {
  range: Range;
  tool?: AiTool | null;
  userId?: string | null;
  status?: string | null;
  plate?: string | null;
}

export async function listRuns(f: RunFilter, take = 200) {
  const since = rangeStart(f.range);
  const runs = await prisma.aiRun.findMany({
    where: {
      createdAt: { gte: since },
      ...(f.tool ? { tool: f.tool } : {}),
      ...(f.userId ? { userId: f.userId } : {}),
      ...(f.status ? { status: f.status } : {}),
      ...(f.plate
        ? { plateNo: { contains: f.plate.replace(/\s+/g, "") } }
        : {}),
    },
    include: { user: { select: { name: true, employeeId: true } } },
    orderBy: { createdAt: "desc" },
    take,
  });
  // 같은 차량번호·도구가 기간 내 여러 번이면 배지용 카운트
  const dup = new Map<string, number>();
  for (const r of runs) {
    if (!r.plateNo || r.status === "blocked") continue;
    const k = `${r.plateNo}|${r.tool}`;
    dup.set(k, (dup.get(k) ?? 0) + 1);
  }
  return runs.map((r) => ({
    ...r,
    dupCount: r.plateNo ? (dup.get(`${r.plateNo}|${r.tool}`) ?? 1) : 1,
  }));
}

export async function listUsersForFilter() {
  return prisma.user.findMany({
    select: { id: true, name: true, employeeId: true },
    orderBy: { name: "asc" },
  });
}
