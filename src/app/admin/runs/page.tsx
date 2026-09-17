import Link from "next/link";
import {
  listModelsForFilter,
  listRuns,
  listUsersForFilter,
} from "@/lib/admin-stats";
import { TOOL_LABEL, type AiTool } from "@/lib/ai-usage";
import { krw, money, num, tok, dt } from "@/lib/format-krw";
import { RangeTabs, parseRange } from "@/components/admin/RangeTabs";
import { StatusBadge } from "@/components/admin/StatusBadge";

export const dynamic = "force-dynamic";

const STATUSES = [
  ["", "전체"],
  ["succeeded", "완료"],
  ["failed", "실패"],
  ["blocked", "차단"],
  ["queued", "진행 중"],
] as const;

export default async function RunsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const range = parseRange(sp.range);
  const tool = (
    ["assess", "adjustment", "procedure"].includes(sp.tool ?? "") ? sp.tool : ""
  ) as AiTool | "";
  const status = STATUSES.some(([k]) => k === (sp.status ?? ""))
    ? (sp.status ?? "")
    : "";
  const userId = sp.user ?? "";
  const plate = sp.plate ?? "";
  const model = sp.model ?? "";
  const [runs, users, models] = await Promise.all([
    listRuns({
      range,
      tool: tool || null,
      userId: userId || null,
      status: status || null,
      plate: plate || null,
      model: model || null,
    }),
    listUsersForFilter(),
    listModelsForFilter(),
  ]);
  const keep = {
    tool: tool || undefined,
    status: status || undefined,
    user: userId || undefined,
    plate: plate || undefined,
    model: model || undefined,
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">실행 이력</h1>
          <p className="mt-1 text-sm text-slate-500">
            최근 200건. 결과 본문·사진은 저장하지 않으며 토큰·비용·판정 집계만
            남습니다.
          </p>
        </div>
        <RangeTabs current={range} basePath="/admin/runs" params={keep} />
      </div>

      <form
        className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs shadow-sm"
        method="get"
      >
        <input type="hidden" name="range" value={range} />
        <select
          name="user"
          defaultValue={userId}
          className="rounded-lg border border-slate-300 px-2 py-1.5"
        >
          <option value="">전체 계정</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.employeeId})
            </option>
          ))}
        </select>
        <select
          name="tool"
          defaultValue={tool}
          className="rounded-lg border border-slate-300 px-2 py-1.5"
        >
          <option value="">전체 도구</option>
          {(["assess", "adjustment", "procedure"] as AiTool[]).map((t) => (
            <option key={t} value={t}>
              {TOOL_LABEL[t]}
            </option>
          ))}
        </select>
        <select
          name="model"
          defaultValue={model}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 font-mono"
        >
          <option value="">전체 모델</option>
          {models.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={status}
          className="rounded-lg border border-slate-300 px-2 py-1.5"
        >
          {STATUSES.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
        <input
          name="plate"
          defaultValue={plate}
          placeholder="차량번호"
          className="w-32 rounded-lg border border-slate-300 px-2 py-1.5"
        />
        <button
          type="submit"
          className="rounded-full bg-slate-900 px-3 py-1.5 font-bold text-white"
        >
          조회
        </button>
        {(tool || status || userId || plate || model) && (
          <Link
            href={`/admin/runs?range=${range}`}
            className="text-slate-500 underline"
          >
            필터 해제
          </Link>
        )}
      </form>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[1240px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs text-slate-500">
              <th className="px-4 py-3 font-semibold">시각</th>
              <th className="px-3 py-3 font-semibold">계정</th>
              <th className="px-3 py-3 font-semibold">도구</th>
              <th className="px-3 py-3 font-semibold">모델</th>
              <th className="px-3 py-3 font-semibold">차량 / 접수</th>
              <th className="px-3 py-3 text-right font-semibold">사진</th>
              <th className="px-3 py-3 text-right font-semibold">견적 금액</th>
              <th className="px-3 py-3 text-right font-semibold">
                토큰 (입력/출력)
              </th>
              <th className="px-3 py-3 text-right font-semibold">비용</th>
              <th className="px-3 py-3 text-right font-semibold">소요</th>
              <th className="px-3 py-3 font-semibold">판정</th>
              <th className="px-4 py-3 font-semibold">상태</th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 && (
              <tr>
                <td
                  colSpan={12}
                  className="px-4 py-10 text-center text-xs text-slate-400"
                >
                  조건에 맞는 실행이 없습니다.
                </td>
              </tr>
            )}
            {runs.map((r) => {
              const vc = (r.verdictCounts ?? null) as Record<
                string,
                number
              > | null;
              return (
                <tr key={r.id} className="border-b border-slate-50 align-top">
                  <td className="px-4 py-2.5 tabular-nums text-slate-600">
                    {dt(r.createdAt)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="text-slate-900">
                      {r.user?.name ?? r.employeeId}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {r.employeeId}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-slate-700">
                    {TOOL_LABEL[r.tool as AiTool] ?? r.tool}
                    <div className="text-[10px] text-slate-400">
                      {r.promptVersion}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/admin/runs?range=${range}&model=${encodeURIComponent(r.model)}`}
                      className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700 transition-colors hover:bg-slate-200"
                      title="이 모델만 보기"
                    >
                      {r.model}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-700">
                    <span className="flex items-center gap-1.5">
                      {r.plateNo ?? "-"}
                      {r.dupCount > 1 && (
                        <Link
                          href={`/admin/runs?range=${range}&plate=${encodeURIComponent(r.plateNo ?? "")}`}
                          className="rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-bold text-amber-800"
                          title="같은 차량·도구가 기간 내 여러 번 실행됨"
                        >
                          ×{r.dupCount}
                        </Link>
                      )}
                    </span>
                    {r.claimNo && (
                      <div className="text-[10px] text-slate-400">
                        {r.claimNo}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                    {r.photoCount}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                    {r.estimateAmount != null ? krw(r.estimateAmount) : "-"}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                    {r.status === "blocked"
                      ? "-"
                      : `${tok(r.inputTokens)} / ${tok(r.outputTokens)}`}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-slate-900">
                    {r.status === "blocked" ? "-" : money(r.costKrw, r.costUsd)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">
                    {r.durationMs ? `${Math.round(r.durationMs / 1000)}s` : "-"}
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-slate-600">
                    {vc
                      ? Object.entries(vc)
                          .map(([k, v]) => `${k} ${num(v)}`)
                          .join(" · ")
                      : "-"}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={r.status} />
                    {(r.blockedReason || r.errorMessage) && (
                      <div className="mt-1 max-w-[220px] text-[10px] leading-snug text-slate-500">
                        {r.blockedReason ?? r.errorMessage}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
