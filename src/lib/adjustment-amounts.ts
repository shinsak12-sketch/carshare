import type { AdjustmentItem, AdjustmentResult } from "./adjustment-types";
import type { EstimateLine, EstimateTree } from "./estimate-tree";
import { effectiveVerdict, overrideKey } from "./adjustment-overrides";
import type { VerdictLabel } from "./review-items";

// 손해사정 전후 금액 비교. AI는 금액을 산정하지 않으므로(프롬프트 원칙) 코드가 계산한다.
// - 청구액: 견적서 항목표의 사정전 금액. 수가(원/H)를 입력하면 시간이 있는 공임·도장 행은
//   시간 × 수가로 다시 계산(거래처별 수가가 견적서와 다를 수 있음). 재료비·부품비는 그대로.
// - AI 사정액: 판정별로 —
//   인정 → 청구액 / 불인정 → 0 / 과다청구(시간) → 공임 × 인정시간 ÷ 청구시간 /
//   과다청구(시간 외) → 청구액 유지 + "확인" / 협의·조사 → 청구액 유지 + "보류"(삭감에 안 셈)
// - 부품비 행은 판정 대상이 아니므로 같은 부위의 메인 항목을 따라간다
//   (메인 불인정이면 부품비도 0). 담당자 수정(override)도 그대로 반영.

export type AmountStatus =
  | "인정"
  | "불인정"
  | "조정"
  | "확인"
  | "보류"
  | "미판정";

export interface AmountRow {
  key: string;
  status: AmountStatus;
  verdict: VerdictLabel | null;
  claimed: number; // 공임(+재료) 또는 부품비
  assessed: number;
  note: string;
  overridden: boolean;
  // 부품 행이 따라간 메인 항목의 line_no 키
  linkedTo?: string;
}

export interface AmountSummary {
  claimedLabor: number;
  claimedPart: number;
  assessedLabor: number;
  assessedPart: number;
  claimedTotal: number;
  assessedTotal: number;
  cut: number; // 확정 삭감액(보류 제외)
  cutRate: number; // 0~1
  held: number; // 협의·조사로 보류된 청구액
  pendingHours: number; // 과다청구인데 인정 시간이 없어 금액 계산을 못 한 행 수
  judged: number; // 판정이 붙은 행 수
  rows: Map<string, AmountRow>;
}

const round = (n: number) => Math.round(n);

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[\s·.,/\-_]/g, "")
    .replace(/(교환|탈착|판금|수리|도장|공임|부품|어셈블리|assy|ass'y)/g, "");

function findMainForPart(
  line: EstimateLine,
  items: AdjustmentItem[],
  prevLabor: AdjustmentItem | null,
): AdjustmentItem | null {
  const n = norm(line.name);
  if (n) {
    const mains = items.filter((it) => it.role === "메인");
    const exact = mains.find(
      (it) => norm(it.item_name) === n || norm(it.group) === n,
    );
    if (exact) return exact;
    const partial = mains.find((it) => {
      const a = norm(it.item_name);
      const g = norm(it.group);
      return (
        (a && (a.includes(n) || n.includes(a))) ||
        (g && (g.includes(n) || n.includes(g)))
      );
    });
    if (partial) return partial;
  }
  return prevLabor;
}

export function computeAmounts(
  tree: EstimateTree | null | undefined,
  result: AdjustmentResult | null | undefined,
  laborRate: number | null | undefined,
): AmountSummary | null {
  if (!tree || !result) return null;
  const items = result.items;
  const byKey = new Map(items.map((it) => [overrideKey(it.line_no), it]));
  const rate = laborRate && laborRate > 0 ? laborRate : null;

  const rows = new Map<string, AmountRow>();
  let claimedLabor = 0;
  let claimedPart = 0;
  let assessedLabor = 0;
  let assessedPart = 0;
  let held = 0;
  let pendingHours = 0;
  let judged = 0;
  let prevLabor: AdjustmentItem | null = null;

  for (const line of tree.rows) {
    const key = overrideKey(line.line_no);
    if (line.kind === "부품") {
      const claimed = line.before.part ?? 0;
      claimedPart += claimed;
      const main = findMainForPart(line, items, prevLabor);
      const row: AmountRow = {
        key,
        status: "미판정",
        verdict: null,
        claimed,
        assessed: claimed,
        note: "",
        overridden: false,
        linkedTo: main ? overrideKey(main.line_no) : undefined,
      };
      if (main) {
        const v = effectiveVerdict(main);
        row.verdict = v;
        row.overridden = !!main.override;
        if (v === "불인정") {
          row.status = "불인정";
          row.assessed = 0;
          row.note = `${main.item_name} 불인정에 연동`;
        } else if (v === "과다청구") {
          row.status = "확인";
          row.note = `${main.item_name} 과다청구 — 교환→판금 조정이면 부품 불필요`;
        } else if (v === "협의필요" || v === "조사필요") {
          row.status = "보류";
          row.note = `${main.item_name} ${v}`;
          held += claimed;
        } else {
          row.status = "인정";
        }
      }
      assessedPart += row.assessed;
      rows.set(key, row);
      continue;
    }

    // 공임·도장·기타
    const materials = line.before.part ?? 0;
    const labor =
      rate && line.hours != null
        ? round(line.hours * rate)
        : (line.before.labor ?? 0);
    const claimed = labor + materials;
    claimedLabor += claimed;
    const item = byKey.get(key) ?? null;
    const row: AmountRow = {
      key,
      status: "미판정",
      verdict: null,
      claimed,
      assessed: claimed,
      note: "",
      overridden: false,
    };
    if (item) {
      judged += 1;
      prevLabor = item.role === "메인" ? item : prevLabor;
      const v = effectiveVerdict(item);
      row.verdict = v;
      row.overridden = !!item.override;
      if (v === "인정") {
        row.status = "인정";
      } else if (v === "불인정") {
        row.status = "불인정";
        row.assessed = 0;
      } else if (v === "과다청구") {
        const claimedHrs = item.claimed_hours ?? line.hours;
        const adj = item.override ? null : (item.adjusted_hours ?? null);
        if (adj != null && claimedHrs && claimedHrs > 0 && adj < claimedHrs) {
          row.status = "조정";
          row.assessed = round((labor * adj) / claimedHrs) + materials;
          row.note = `${claimedHrs}H → ${adj}H`;
        } else {
          row.status = "확인";
          row.note =
            adj != null ? "인정 시간이 청구 시간 이상" : "조정 시간 미확정";
          pendingHours += 1;
        }
      } else {
        row.status = "보류";
        held += claimed;
      }
    }
    assessedLabor += row.assessed;
    rows.set(key, row);
  }

  const claimedTotal = claimedLabor + claimedPart;
  const assessedTotal = assessedLabor + assessedPart;
  const cut = claimedTotal - assessedTotal;
  return {
    claimedLabor,
    claimedPart,
    assessedLabor,
    assessedPart,
    claimedTotal,
    assessedTotal,
    cut,
    cutRate: claimedTotal > 0 ? cut / claimedTotal : 0,
    held,
    pendingHours,
    judged,
    rows,
  };
}

export const AMOUNT_STATUS_LABEL: Record<AmountStatus, string> = {
  인정: "인정",
  불인정: "불인정",
  조정: "시간 조정",
  확인: "금액 확인",
  보류: "보류",
  미판정: "",
};
