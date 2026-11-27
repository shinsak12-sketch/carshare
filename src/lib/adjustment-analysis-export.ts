import type { StoredCase } from "./adjustment-lab-store";
import type { AdjustmentItem } from "./adjustment-types";
import { computeAmounts } from "./adjustment-amounts";
import { applyOverrides, overrideKey } from "./adjustment-overrides";
import {
  buildAmountReport,
  cutReasonOf,
  mergeAmountReports,
  withRates as lineRates,
  type AmountReport,
} from "./adjustment-amount-report";
import { caseTitleOf } from "./case-store";
import { isEstimateTree, workKindOf, type EstimateLine } from "./estimate-tree";

// 분석용 내보내기 — 수요 보고서(손해절감 효과) 분석에 쓸 건별·항목별 데이터.
// 화면용 보고서와 달리 사람이 읽는 문서가 아니라 분석 도구(Claude 등)에 그대로 넣는 JSON.
// 금액은 전부 원(정수). AI 원판정 기준(ai)과 담당자 수정 반영(final) 두 벌을 같이 담는다.
// 사진·견적서 원문은 넣지 않는다. 차량번호는 뒤 4자리만.

export const ANALYSIS_EXPORT_SCHEMA = "carshare.adjustment-analysis.v1";

const GUIDE = [
  "이 파일은 AI 손해사정 결과를 분석용으로 내보낸 것임. 금액 단위는 원.",
  "cases[].totals.ai = AI 원판정 기준, totals.final = 담당자 수정(인정/불인정 버튼) 반영 기준.",
  "claimed = 청구액(견적서 사정전 금액. labor_rate가 있으면 시간×수가로 다시 계산한 공임).",
  "assessed = 사정액. 인정=청구액, 불인정=0, 과다청구(시간)=공임×인정시간÷청구시간, 과다청구(시간 외)=청구액 유지(status '확인'), 협의·조사=청구액 유지(status '보류').",
  "cut = claimed − assessed (확정 삭감). held = 협의·조사로 보류된 청구액(삭감에 안 셈, 잠재 삭감 상한). pending = 과다청구인데 금액을 못 정한 청구액.",
  "rate.cut = cut ÷ claimed (삭감률), rate.assessed = assessed ÷ claimed (사정률·인정률).",
  "lines[]는 견적서 한 줄 = 한 원소. 부품 줄은 AI 판정 대상이 아니라 같은 부위 메인 항목의 판정을 따라감(linked_to).",
  "lines[].est_after = 견적서 PDF의 '사정후' 열 값. 종결 견적서를 넣었다면 실제 사정 결과이고, 청구 단계 견적서면 비어 있거나 청구액과 같음.",
  "lines[].cut_reason은 판정·문구에서 기계적으로 붙인 추정 분류임. 정확한 사유는 reasoning·note 원문으로 판단할 것.",
  "amount_report = 금액 상세 보고. labor[]는 작업 종류별 순공임(교환·탈착·판금·수리·교정·도장…), materials는 도장 재료비, parts는 부품비. 각 줄에 claimed·assessed·cut·held·pending과 삭감률. top_cuts는 삭감액 큰 줄, held_items는 보류·확인 줄(잠재 삭감).",
  "confidence는 AI가 근거 종류로 매긴 판정 신뢰도(0~100). breakdown.by_confidence로 '신뢰도 높은 삭감'만 따로 볼 수 있음.",
  "실제 종결 내역과 비교할 때: 건은 label 또는 plate_tail(차량번호 뒤 4자리)로 맞추고, 줄은 no(견적서 순번)로 맞출 것.",
];

type Bucket = {
  n: number;
  claimed: number;
  assessed: number;
  cut: number;
  held: number;
};
const emptyBucket = (): Bucket => ({
  n: 0,
  claimed: 0,
  assessed: 0,
  cut: 0,
  held: 0,
});
const pct = (a: number, b: number) =>
  b > 0 ? Math.round((a / b) * 1000) / 10 : 0;

function withRates(b: Bucket) {
  return {
    ...b,
    cut_rate_pct: pct(b.cut, b.claimed),
    assessed_rate_pct: pct(b.assessed, b.claimed),
  };
}

function add(
  map: Map<string, Bucket>,
  key: string,
  row: { claimed: number; assessed: number; status: string },
) {
  const b = map.get(key) ?? emptyBucket();
  b.n += 1;
  b.claimed += row.claimed;
  b.assessed += row.assessed;
  b.cut += row.claimed - row.assessed;
  if (row.status === "보류") b.held += row.claimed;
  map.set(key, b);
}

const toObj = (map: Map<string, Bucket>) =>
  Object.fromEntries(
    [...map.entries()]
      .sort((a, b) => b[1].cut - a[1].cut || b[1].claimed - a[1].claimed)
      .map(([k, v]) => [k, withRates(v)]),
  );

const confBand = (c: number | undefined) =>
  typeof c !== "number"
    ? "미표시"
    : c >= 90
      ? "90~100"
      : c >= 70
        ? "70~89"
        : c >= 50
          ? "50~69"
          : "0~49";

function lineAmounts(line: EstimateLine) {
  return {
    labor: line.before.labor ?? 0,
    materials: line.kind === "부품" ? 0 : (line.before.part ?? 0),
    part: line.kind === "부품" ? (line.before.part ?? 0) : 0,
  };
}

function exportCase(c: StoredCase, index: number) {
  const base = {
    label: caseTitleOf(c, index),
    plate_tail: c.plateNo ? c.plateNo.replace(/\s/g, "").slice(-4) : "",
    vehicle: `${c.manufacturer} ${c.model}`.trim(),
    run_at: new Date(c.createdAt).toISOString(),
    photo_count: c.photoCount,
    estimate_file: c.estimateName,
    memo: c.memo || "",
    labor_rate: c.laborRate ?? null,
    run: c.runMeta
      ? {
          model: c.runMeta.model ?? null,
          prompt_version: c.runMeta.promptVersion ?? null,
          cost_krw: c.runMeta.costKrw ?? null,
          duration_sec:
            c.runMeta.durationMs != null
              ? Math.round(c.runMeta.durationMs / 1000)
              : null,
          input_tokens: c.runMeta.inputTokens ?? null,
          output_tokens: c.runMeta.outputTokens ?? null,
        }
      : null,
  };
  const raw = c.result;
  if (!raw) return null;
  const final = applyOverrides(raw, c.overrides);
  const tree = isEstimateTree(c.estimateTree) ? c.estimateTree : null;
  const aiAmt = computeAmounts(tree, raw, c.laborRate ?? null);
  const finalAmt = computeAmounts(tree, final, c.laborRate ?? null);

  const itemByKey = new Map(
    final.items.map((it) => [overrideKey(it.line_no), it] as const),
  );

  // 판정 건수(독립 판정만 — 화면 집계와 같은 기준)
  const verdictCounts = (items: AdjustmentItem[], useOverride: boolean) => {
    const m: Record<string, number> = {};
    for (const it of items) {
      if (it.follows_parent && !it.override) continue;
      const v = useOverride ? (it.override?.verdict ?? it.verdict) : it.verdict;
      m[v] = (m[v] ?? 0) + 1;
    }
    return m;
  };

  const overrides = Object.entries(c.overrides ?? {}).map(([no, o]) => ({
    no,
    to: o.verdict,
    from: raw.items.find((it) => overrideKey(it.line_no) === no)?.verdict,
    cascaded: o.cascaded,
  }));

  const confidences = raw.items
    .filter((it) => !it.follows_parent && typeof it.confidence === "number")
    .map((it) => it.confidence as number);

  const head = {
    ...base,
    has_estimate_table: !!tree,
    vehicle_structure: raw.repair_plan?.vehicle_structure ?? null,
    structure_confidence: raw.repair_plan?.structure_confidence ?? null,
    damage_summary: raw.repair_plan?.damage_summary ?? null,
    consistency_warning: raw.physical_consistency.consistent
      ? null
      : raw.physical_consistency.warning,
    item_count: raw.items.length,
    verdict_counts: {
      ai: verdictCounts(raw.items, false),
      final: verdictCounts(final.items, true),
    },
    inferred_count: raw.items.filter(
      (it) => !it.follows_parent && it.judgment_basis === "추론",
    ).length,
    confidence: confidences.length
      ? {
          avg: Math.round(
            confidences.reduce((s, v) => s + v, 0) / confidences.length,
          ),
          min: Math.min(...confidences),
          below_70: confidences.filter((v) => v < 70).length,
        }
      : null,
    overrides,
  };

  if (!tree || !aiAmt || !finalAmt) {
    // 견적서 표를 못 읽은 건 — 금액 없이 판정만
    return {
      ...head,
      totals: null,
      breakdown: null,
      amount_report: null,
      _reports: null,
      lines: raw.items.map((it) => ({
        no: String(it.line_no),
        name: it.item_name,
        action: it.claimed_action,
        role: it.role,
        group: it.group,
        linked: it.follows_parent,
        verdict_ai: it.verdict,
        verdict_final:
          itemByKey.get(overrideKey(it.line_no))?.override?.verdict ??
          it.verdict,
        basis: it.judgment_basis ?? null,
        confidence: it.confidence ?? null,
        claimed_hours: it.claimed_hours,
        adjusted_hours: it.adjusted_hours ?? null,
        reasoning: it.reasoning,
        note: it.adjustment_note,
      })),
    };
  }

  const totalsOf = (a: NonNullable<typeof aiAmt>) => {
    let pending = 0;
    for (const r of a.rows.values())
      if (r.status === "확인") pending += r.claimed;
    return {
      claimed: a.claimedTotal,
      claimed_labor: a.claimedLabor,
      claimed_part: a.claimedPart,
      assessed: a.assessedTotal,
      assessed_labor: a.assessedLabor,
      assessed_part: a.assessedPart,
      cut: a.cut,
      cut_labor: a.claimedLabor - a.assessedLabor,
      cut_part: a.claimedPart - a.assessedPart,
      cut_rate_pct: pct(a.cut, a.claimedTotal),
      assessed_rate_pct: pct(a.assessedTotal, a.claimedTotal),
      held: a.held,
      held_rate_pct: pct(a.held, a.claimedTotal),
      pending,
      pending_rows: a.pendingHours,
    };
  };

  // 집계는 담당자 수정 반영(final) 기준 + AI 원판정 기준 둘 다
  const breakdownOf = (a: NonNullable<typeof aiAmt>, useFinal: boolean) => {
    const byKind = new Map<string, Bucket>();
    const byVerdict = new Map<string, Bucket>();
    const byRole = new Map<string, Bucket>();
    const byGroup = new Map<string, Bucket>();
    const byReason = new Map<string, Bucket>();
    const byConf = new Map<string, Bucket>();
    const byBasis = new Map<string, Bucket>();
    const src = useFinal ? final : raw;
    const items = new Map(
      src.items.map((it) => [overrideKey(it.line_no), it] as const),
    );
    for (const line of tree.rows) {
      const key = overrideKey(line.line_no);
      const row = a.rows.get(key);
      if (!row) continue;
      const isPart = line.kind === "부품";
      const item = isPart
        ? row.linkedTo
          ? (items.get(row.linkedTo) ?? null)
          : null
        : (items.get(key) ?? null);
      add(byKind, workKindOf(line), row);
      add(byVerdict, row.verdict ?? "미판정", row);
      add(byRole, isPart ? "부품" : (item?.role ?? "미판정"), row);
      add(byGroup, item?.group || "(미분류)", row);
      const reason = cutReasonOf(row, isPart ? null : item, isPart);
      if (reason) add(byReason, reason, row);
      if (!isPart && item) {
        add(byConf, confBand(item.confidence), row);
        add(byBasis, item.judgment_basis ?? "미표시", row);
      }
    }
    return {
      by_work_kind: toObj(byKind),
      by_verdict: toObj(byVerdict),
      by_role: toObj(byRole),
      by_group: toObj(byGroup),
      by_cut_reason: toObj(byReason),
      by_confidence: toObj(byConf),
      by_basis: toObj(byBasis),
    };
  };

  const reportOut = (r: AmountReport | null) =>
    r
      ? {
          labor: r.labor.map(lineRates),
          labor_total: lineRates(r.laborTotal),
          materials: lineRates(r.materials),
          parts: lineRates(r.parts),
          parts_by_status: r.partsByStatus.map(lineRates),
          total: lineRates(r.total),
          by_reason: r.byReason.map(lineRates),
          by_group: r.byGroup.map(lineRates),
          top_cuts: r.topCuts.slice(0, 15),
          held_items: r.heldItems.slice(0, 15),
        }
      : null;
  const reportAi = buildAmountReport(tree, raw, aiAmt);
  const reportFinal = buildAmountReport(tree, final, finalAmt);

  let estAfterTotal = 0;
  let estAfterSeen = false;
  const lines = tree.rows.map((line) => {
    const key = overrideKey(line.line_no);
    const isPart = line.kind === "부품";
    const ai = aiAmt.rows.get(key);
    const fin = finalAmt.rows.get(key);
    const item = isPart ? null : (itemByKey.get(key) ?? null);
    const amounts = lineAmounts(line);
    const after = isPart
      ? line.after.part
      : line.after.labor != null || line.after.part != null
        ? (line.after.labor ?? 0) + (line.after.part ?? 0)
        : null;
    if (after != null) {
      estAfterSeen = true;
      estAfterTotal += after;
    }
    return {
      no: line.line_no,
      kind: workKindOf(line),
      name: line.name,
      action: line.action || null,
      hours: line.hours,
      qty: line.qty,
      user_defined: !!line.userDefined,
      est_labor: amounts.labor,
      est_materials: amounts.materials,
      est_part: amounts.part,
      est_after: after,
      claimed: fin?.claimed ?? 0,
      group: item?.group ?? null,
      role: isPart ? "부품" : (item?.role ?? null),
      linked: isPart ? !!fin?.linkedTo : !!item?.follows_parent,
      linked_to: isPart ? (fin?.linkedTo ?? null) : null,
      verdict_ai: isPart ? (ai?.verdict ?? null) : (item?.verdict ?? null),
      verdict_final: fin?.verdict ?? null,
      overridden: item?.override
        ? item.override.cascaded
          ? "연쇄"
          : "담당자"
        : null,
      status_ai: ai?.status ?? null,
      status_final: fin?.status ?? null,
      assessed_ai: ai?.assessed ?? null,
      assessed_final: fin?.assessed ?? null,
      cut_ai: ai ? ai.claimed - ai.assessed : null,
      cut_final: fin ? fin.claimed - fin.assessed : null,
      cut_reason: fin ? cutReasonOf(fin, item, isPart) : "",
      basis: item?.judgment_basis ?? null,
      confidence: item?.confidence ?? null,
      photo_evidence: item?.photo_evidence ?? null,
      photo_refs: item?.photo_refs ?? [],
      claimed_hours: item?.claimed_hours ?? null,
      adjusted_hours: item?.adjusted_hours ?? null,
      damage_type: item?.damage_type ?? null,
      reasoning: item?.reasoning ?? "",
      note: item?.adjustment_note || fin?.note || "",
    };
  });

  return {
    ...head,
    totals: {
      ai: totalsOf(aiAmt),
      final: totalsOf(finalAmt),
      // 견적서 PDF에 사정후 금액이 들어 있으면(종결 견적서) 그 합계
      estimate_after: estAfterSeen ? estAfterTotal : null,
    },
    breakdown: {
      ai: breakdownOf(aiAmt, false),
      final: breakdownOf(finalAmt, true),
    },
    amount_report: { ai: reportOut(reportAi), final: reportOut(reportFinal) },
    // 합산용 원본(파일에는 summary.amount_report로만 나감)
    _reports: { ai: reportAi, final: reportFinal },
    plan: raw.repair_plan
      ? {
          main_works: raw.repair_plan.main_works.map((w) => ({
            part: w.part_name,
            work: w.work,
            basis: w.judgment_basis,
            reasoning: w.reasoning,
          })),
          rejected: raw.repair_plan.rejected,
        }
      : null,
    lines,
  };
}

export function buildAnalysisExport(cases: StoredCase[], allCases = cases) {
  const exported = cases
    .map((c) => exportCase(c, Math.max(0, allCases.indexOf(c))))
    .filter((c): c is NonNullable<ReturnType<typeof exportCase>> => !!c);

  // 건 전체 요약 — 금액이 있는 건만 합산
  const withAmt = exported.filter((c) => c.totals);
  const sum = (pick: (c: (typeof withAmt)[number]) => number) =>
    withAmt.reduce((s, c) => s + pick(c), 0);
  const summaryOf = (which: "ai" | "final") => {
    const claimed = sum((c) => c.totals![which].claimed);
    const assessed = sum((c) => c.totals![which].assessed);
    const held = sum((c) => c.totals![which].held);
    const pending = sum((c) => c.totals![which].pending);
    return {
      claimed,
      assessed,
      cut: claimed - assessed,
      cut_rate_pct: pct(claimed - assessed, claimed),
      held,
      held_rate_pct: pct(held, claimed),
      pending,
    };
  };
  const mergeBreakdown = (
    which: "ai" | "final",
    dim:
      | "by_work_kind"
      | "by_verdict"
      | "by_role"
      | "by_cut_reason"
      | "by_confidence"
      | "by_basis",
  ) => {
    const m = new Map<string, Bucket>();
    for (const c of withAmt) {
      const d = c.breakdown![which][dim] as Record<string, Bucket>;
      for (const [k, v] of Object.entries(d)) {
        const b = m.get(k) ?? emptyBucket();
        b.n += v.n;
        b.claimed += v.claimed;
        b.assessed += v.assessed;
        b.cut += v.cut;
        b.held += v.held;
        m.set(k, b);
      }
    }
    return toObj(m);
  };
  const costs = exported
    .map((c) => c.run?.cost_krw)
    .filter((v): v is number => typeof v === "number");
  const durations = exported
    .map((c) => c.run?.duration_sec)
    .filter((v): v is number => typeof v === "number");

  const mergedReport = (which: "ai" | "final") => {
    const list = withAmt
      .map((c) => c._reports?.[which])
      .filter((r): r is AmountReport => !!r);
    if (list.length === 0) return null;
    const m = mergeAmountReports(list);
    return {
      labor: m.labor.map(lineRates),
      labor_total: m.laborTotal ? lineRates(m.laborTotal) : null,
      materials: m.materials ? lineRates(m.materials) : null,
      parts: m.parts ? lineRates(m.parts) : null,
      parts_by_status: m.partsByStatus.map(lineRates),
      total: m.total ? lineRates(m.total) : null,
      by_reason: m.byReason.map(lineRates),
    };
  };

  return {
    schema: ANALYSIS_EXPORT_SCHEMA,
    exported_at: new Date().toISOString(),
    guide: GUIDE,
    summary: {
      case_count: exported.length,
      cases_with_amounts: withAmt.length,
      ai: summaryOf("ai"),
      final: summaryOf("final"),
      ai_cost_krw_total: costs.length ? costs.reduce((s, v) => s + v, 0) : null,
      ai_duration_sec_avg: durations.length
        ? Math.round(durations.reduce((s, v) => s + v, 0) / durations.length)
        : null,
      per_case: exported.map((c) => ({
        label: c.label,
        plate_tail: c.plate_tail,
        vehicle: c.vehicle,
        claimed: c.totals?.final.claimed ?? null,
        assessed_ai: c.totals?.ai.assessed ?? null,
        assessed_final: c.totals?.final.assessed ?? null,
        cut_ai: c.totals?.ai.cut ?? null,
        cut_rate_ai_pct: c.totals?.ai.cut_rate_pct ?? null,
        cut_final: c.totals?.final.cut ?? null,
        cut_rate_final_pct: c.totals?.final.cut_rate_pct ?? null,
        held: c.totals?.final.held ?? null,
        estimate_after: c.totals?.estimate_after ?? null,
        overrides: c.overrides.filter((o) => !o.cascaded).length,
        ai_cost_krw: c.run?.cost_krw ?? null,
      })),
      amount_report: { ai: mergedReport("ai"), final: mergedReport("final") },
      breakdown: {
        ai: {
          by_work_kind: mergeBreakdown("ai", "by_work_kind"),
          by_verdict: mergeBreakdown("ai", "by_verdict"),
          by_role: mergeBreakdown("ai", "by_role"),
          by_cut_reason: mergeBreakdown("ai", "by_cut_reason"),
          by_confidence: mergeBreakdown("ai", "by_confidence"),
          by_basis: mergeBreakdown("ai", "by_basis"),
        },
        final: {
          by_work_kind: mergeBreakdown("final", "by_work_kind"),
          by_verdict: mergeBreakdown("final", "by_verdict"),
          by_role: mergeBreakdown("final", "by_role"),
          by_cut_reason: mergeBreakdown("final", "by_cut_reason"),
          by_confidence: mergeBreakdown("final", "by_confidence"),
          by_basis: mergeBreakdown("final", "by_basis"),
        },
      },
    },
    cases: exported.map((c) => {
      const out: Record<string, unknown> = { ...c };
      delete out._reports;
      return out;
    }),
  };
}
