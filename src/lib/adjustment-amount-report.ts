import type { AdjustmentItem, AdjustmentResult } from "./adjustment-types";
import type { AmountRow, AmountSummary } from "./adjustment-amounts";
import { overrideKey } from "./adjustment-overrides";
import { workKindOf, type EstimateTree } from "./estimate-tree";

// 금액 상세 보고 — 청구·사정·삭감을 공임(작업 종류별) / 도장 재료 / 부품으로 나눈 표.
// 화면의 "금액 상세" 패널, 보고서 PDF, 분석용 내보내기가 같은 값을 쓴다.
// 공임은 순공임만(도장 행의 재료비는 "도장 재료"로 따로). 금액은 원(정수).

export interface AmountLine {
  key: string;
  n: number; // 견적서 줄 수
  claimed: number;
  assessed: number;
  cut: number; // 확정 삭감
  held: number; // 협의·조사로 보류된 청구액
  pending: number; // 과다청구인데 금액을 못 정한 청구액
}

export interface CutItem {
  no: string;
  kind: string;
  name: string;
  group: string;
  verdict: string;
  reason: string;
  claimed: number;
  assessed: number;
  cut: number;
}

export interface AmountReport {
  labor: AmountLine[]; // 작업 종류별 순공임
  laborTotal: AmountLine;
  materials: AmountLine; // 도장 재료 등 공임 행에 딸린 재료비
  parts: AmountLine;
  partsByStatus: AmountLine[]; // 인정 / 불인정(메인 연동) / 보류 / 확인 / 미판정
  total: AmountLine;
  byReason: AmountLine[]; // 삭감·보류 사유별
  byGroup: AmountLine[]; // 부위별(공임+재료+부품)
  topCuts: CutItem[]; // 삭감액 큰 줄부터
  heldItems: CutItem[]; // 보류·확인 줄(잠재 삭감)
}

const KIND_ORDER = ["교환", "탈착", "판금", "수리", "교정", "도장"];

const line = (key: string): AmountLine => ({
  key,
  n: 0,
  claimed: 0,
  assessed: 0,
  cut: 0,
  held: 0,
  pending: 0,
});

function put(
  l: AmountLine,
  v: { claimed: number; assessed: number },
  status: string,
  count = true,
) {
  if (count) l.n += 1;
  l.claimed += v.claimed;
  l.assessed += v.assessed;
  l.cut += v.claimed - v.assessed;
  if (status === "보류") l.held += v.claimed;
  if (status === "확인") l.pending += v.claimed;
}

const bucket = (m: Map<string, AmountLine>, key: string) => {
  let l = m.get(key);
  if (!l) {
    l = line(key);
    m.set(key, l);
  }
  return l;
};

export const rateOf = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;

// 삭감 사유 추정 분류 — 판정과 문구 키워드로만. 분석 쪽에서 원문으로 다시 볼 수 있게 원문도 같이 내보냄.
export function cutReasonOf(
  row: AmountRow,
  item: AdjustmentItem | null,
  isPart: boolean,
): string {
  if (
    row.claimed === row.assessed &&
    row.status !== "보류" &&
    row.status !== "확인"
  )
    return "";
  if (isPart) return "부품(메인 판정 연동)";
  if (!item) return "";
  if (item.override?.cascaded) return "담당자 수정 연쇄";
  if (item.override) return "담당자 수정";
  const text = `${item.reasoning} ${item.adjustment_note}`;
  const v = row.verdict;
  if (v === "불인정") {
    if (item.follows_parent) return "메인 불인정 연동";
    if (/중복/.test(text)) return "중복 청구";
    if (/무관|경로|반대|기존 손상|사고와/.test(text))
      return "사고 무관·경로 밖";
    if (item.judgment_basis === "추론") return "추론상 불필요(내판·구조부)";
    return "불인정(기타)";
  }
  if (v === "과다청구") {
    if (item.follows_parent) return "메인 과다청구 연동";
    if (row.status === "조정") return "판금·수리 시간 과다";
    if (/중복|수량/.test(text)) return "중복·수량 과다";
    if (/도장|Lv|등급|보수도장/.test(text) && item.role === "도장")
      return "도장 등급·범위 과다";
    if (/교환/.test(text) && /판금|수리|복원|보수/.test(text))
      return "과잉수리(교환→수리)";
    if (/시간|H\b/.test(text)) return "시간 과다(금액 미확정)";
    return "과다청구(기타)";
  }
  if (v === "협의필요") {
    if (item.judgment_basis === "추론") return "협의(추론 반반)";
    if (/사진|증빙|확인/.test(text)) return "협의(증빙·사진 요청)";
    return "협의(기타)";
  }
  if (v === "조사필요") return "조사(판독 불가)";
  return "";
}

export function buildAmountReport(
  tree: EstimateTree | null | undefined,
  result: AdjustmentResult | null | undefined,
  amounts: AmountSummary | null | undefined,
): AmountReport | null {
  if (!tree || !result || !amounts) return null;
  const items = new Map(
    result.items.map((it) => [overrideKey(it.line_no), it] as const),
  );
  const labor = new Map<string, AmountLine>();
  const partsBy = new Map<string, AmountLine>();
  const reasons = new Map<string, AmountLine>();
  const groups = new Map<string, AmountLine>();
  const laborTotal = line("공임 소계");
  const materials = line("도장 재료");
  const parts = line("부품");
  const total = line("합계");
  const cuts: CutItem[] = [];
  const held: CutItem[] = [];

  for (const l of tree.rows) {
    const key = overrideKey(l.line_no);
    const row = amounts.rows.get(key);
    if (!row) continue;
    const isPart = l.kind === "부품";
    const item = isPart
      ? row.linkedTo
        ? (items.get(row.linkedTo) ?? null)
        : null
      : (items.get(key) ?? null);
    const kind = workKindOf(l);
    const all = { claimed: row.claimed, assessed: row.assessed };
    if (isPart) {
      put(parts, row.split.part, row.status);
      put(bucket(partsBy, row.status), row.split.part, row.status);
    } else {
      put(bucket(labor, kind), row.split.labor, row.status);
      put(laborTotal, row.split.labor, row.status);
      if (row.split.materials.claimed > 0)
        put(materials, row.split.materials, row.status);
    }
    put(total, all, row.status);
    put(bucket(groups, item?.group || "(미분류)"), all, row.status);
    const reason = cutReasonOf(row, isPart ? null : item, isPart);
    if (reason) put(bucket(reasons, reason), all, row.status);
    const entry: CutItem = {
      no: l.line_no,
      kind,
      name: l.name,
      group: item?.group ?? "",
      verdict: row.verdict ?? "",
      reason,
      claimed: row.claimed,
      assessed: row.assessed,
      cut: row.claimed - row.assessed,
    };
    if (entry.cut > 0) cuts.push(entry);
    else if (row.status === "보류" || row.status === "확인") held.push(entry);
  }

  const byCut = (a: AmountLine, b: AmountLine) =>
    b.cut - a.cut ||
    b.held + b.pending - (a.held + a.pending) ||
    b.claimed - a.claimed;
  const laborLines = [...labor.values()].sort((a, b) => {
    const ia = KIND_ORDER.indexOf(a.key);
    const ib = KIND_ORDER.indexOf(b.key);
    if (ia !== -1 || ib !== -1)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return b.claimed - a.claimed;
  });
  const STATUS_ORDER = ["인정", "불인정", "보류", "확인", "미판정"];
  return {
    labor: laborLines,
    laborTotal,
    materials,
    parts,
    partsByStatus: [...partsBy.values()].sort(
      (a, b) => STATUS_ORDER.indexOf(a.key) - STATUS_ORDER.indexOf(b.key),
    ),
    total,
    byReason: [...reasons.values()].sort(byCut),
    byGroup: [...groups.values()].sort(byCut),
    topCuts: cuts.sort((a, b) => b.cut - a.cut),
    heldItems: held.sort((a, b) => b.claimed - a.claimed),
  };
}

// 여러 건의 보고를 하나로 합침(분석용 내보내기의 전체 요약). 줄 목록은 건별에만 둔다.
export function mergeAmountReports(reports: AmountReport[]) {
  const mergeLines = (pick: (r: AmountReport) => AmountLine[]) => {
    const m = new Map<string, AmountLine>();
    for (const r of reports)
      for (const l of pick(r)) {
        const b = bucket(m, l.key);
        b.n += l.n;
        b.claimed += l.claimed;
        b.assessed += l.assessed;
        b.cut += l.cut;
        b.held += l.held;
        b.pending += l.pending;
      }
    return [...m.values()];
  };
  const one = (pick: (r: AmountReport) => AmountLine) =>
    mergeLines((r) => [pick(r)])[0] ?? null;
  const labor = mergeLines((r) => r.labor).sort((a, b) => {
    const ia = KIND_ORDER.indexOf(a.key);
    const ib = KIND_ORDER.indexOf(b.key);
    if (ia !== -1 || ib !== -1)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return b.claimed - a.claimed;
  });
  return {
    labor,
    laborTotal: one((r) => r.laborTotal),
    materials: one((r) => r.materials),
    parts: one((r) => r.parts),
    partsByStatus: mergeLines((r) => r.partsByStatus),
    total: one((r) => r.total),
    byReason: mergeLines((r) => r.byReason).sort((a, b) => b.cut - a.cut),
  };
}

// 내보내기용 — 율(%)을 붙인 평평한 객체
export function withRates(l: AmountLine) {
  return {
    ...l,
    cut_rate_pct: rateOf(l.cut, l.claimed),
    assessed_rate_pct: rateOf(l.assessed, l.claimed),
  };
}
