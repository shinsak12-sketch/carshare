import type {
  AdjustmentItem,
  AdjustmentResult,
  VerdictOverride,
} from "./adjustment-types";
import type { VerdictLabel } from "./review-items";

// 담당자가 AI 판정을 바꾸는 기능(브라우저 캐시에만 저장, 서버 전송 없음).
// - AI 원판정(item.verdict)은 건드리지 않고 override만 붙여 둔다. 화면·금액·복사 텍스트는
//   effectiveVerdict()를 본다.
// - 메인 항목을 바꾸면 같은 group의 하위(도장·부수)가 따라온다:
//   · 불인정으로 바꾸면 그 group 전부 불인정(메인이 없으면 접근 경로도 필요 없으므로)
//   · 인정으로 바꾸면 연동 항목과 "메인 때문에" 불인정됐던 하위만 인정. 자기 사유로
//     과다청구·협의가 난 하위는 그대로 둔다.
//   · 담당자가 하위를 직접 바꾼 것(cascaded=false)은 메인 변경이 덮어쓰지 않는다.
export type OverrideMap = Record<string, VerdictOverride>;

// 견적서 순번 "U12" ↔ line_no 12 를 같은 키로(EstimateTree의 judgmentKey와 같은 규칙)
export const overrideKey = (lineNo: string | number | null | undefined) =>
  lineNo == null ? "" : String(lineNo).replace(/^U/i, "").trim();

export function effectiveVerdict(item: AdjustmentItem): VerdictLabel {
  return item.override?.verdict ?? item.verdict;
}

// override를 items에 붙인 사본. result가 없으면 그대로.
export function applyOverrides(
  result: AdjustmentResult,
  overrides: OverrideMap | null | undefined,
): AdjustmentResult {
  const strip = (it: AdjustmentItem): AdjustmentItem => {
    if (!it.override) return it;
    const copy = { ...it };
    delete copy.override;
    return copy;
  };
  if (!overrides || Object.keys(overrides).length === 0) {
    if (result.items.some((it) => it.override))
      return { ...result, items: result.items.map(strip) };
    return result;
  }
  return {
    ...result,
    items: result.items.map((it) => {
      const o = overrides[overrideKey(it.line_no)];
      return o ? { ...it, override: o } : strip(it);
    }),
  };
}

function childrenOf(result: AdjustmentResult, main: AdjustmentItem) {
  return result.items.filter(
    (it) =>
      it !== main &&
      it.line_no !== main.line_no &&
      (it.group || it.item_name) === (main.group || main.item_name),
  );
}

// 한 항목의 담당자 판정을 바꾼(또는 되돌린, verdict=null) 새 override 맵.
export function setOverride(
  result: AdjustmentResult,
  overrides: OverrideMap | null | undefined,
  lineNo: string | number,
  verdict: VerdictOverride["verdict"] | null,
): OverrideMap {
  const next: OverrideMap = { ...(overrides ?? {}) };
  const key = overrideKey(lineNo);
  const item = result.items.find((it) => overrideKey(it.line_no) === key);
  if (!item) return next;
  const isMain = item.role === "메인";
  const children = isMain ? childrenOf(result, item) : [];

  if (verdict === null) {
    delete next[key];
    // 메인을 되돌리면 그때 따라 바뀐 하위도 되돌린다(직접 바꾼 하위는 유지)
    for (const c of children) {
      const ck = overrideKey(c.line_no);
      if (next[ck]?.cascaded) delete next[ck];
    }
    return next;
  }

  const at = Date.now();
  next[key] = { verdict, at, cascaded: false };
  for (const c of children) {
    const ck = overrideKey(c.line_no);
    if (next[ck] && !next[ck].cascaded) continue; // 담당자가 직접 정한 하위는 존중
    const follow =
      verdict === "불인정" || c.follows_parent || c.verdict === "불인정";
    if (follow) next[ck] = { verdict, at, cascaded: true };
    else delete next[ck];
  }
  return next;
}

export function overrideCount(overrides: OverrideMap | null | undefined) {
  if (!overrides) return 0;
  return Object.values(overrides).filter((o) => !o.cascaded).length;
}
