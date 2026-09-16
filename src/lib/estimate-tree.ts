// [실험] 청구 견적서 항목 표(EstimateRow[])를 화면용 트리로 — GPT 없이 규칙으로.
// 견적서는 메인 작업 다음에 그 부위의 부품·도장·부수작업이 이어지는 순서라,
// 순번 순으로 읽으며 "메인" 후보를 만나면 새 그룹을 열고 그 뒤 항목은 그 그룹에 붙인다.
import type { EstimateRow } from "./estimate-table";

export type EstimateLineKind = "부품" | "공임" | "도장" | "기타";
export type EstimateLineRole = "메인" | "부수" | "도장" | "부품" | "기타";

export interface EstimateLine {
  line_no: string;
  kind: EstimateLineKind;
  role: EstimateLineRole;
  name: string;
  action: string;
  hours: number | null;
  qty: number | null;
  partCode: string;
  before: { part: number | null; labor: number | null };
  after: { part: number | null; labor: number | null };
}

export interface EstimateGroup {
  group: string;
  lines: EstimateLine[];
}

export interface EstimateTree {
  groups: EstimateGroup[];
  rowCount: number;
}

// 메인 작업이 될 수 있는 부위(판넬·구조부) — 이 단어가 들어간 교환/판금/수리 공임이면 새 그룹
const MAIN_PANEL =
  /(범퍼어셈블리|범퍼커버|프런트범퍼|리어범퍼|앞범퍼|뒷범퍼|펜더|쿼터패널|도어(?!스커프|스텝|오픈|트림|글라스|핸들|미러)|후드|본넷|트렁크리드|백도어|테일게이트|백패널|사이드멤버|필러(?!몰딩|트림)|루프|바닥패널|플로어|휠하우스|크로스멤버|라디에이터서포트|캐리어|사이드스텝|컴비네이션패널|헤드램프|리어컴비네이션램프|콤비램프|컴비램프|그릴)/;
// 그룹 없이 공통으로 모으는 도장·부대 항목 (이름이 이걸로 시작할 때만)
const COMMON =
  /^(가열건조|컬러매칭|블렌딩|보카시|폴리싱|방청제|방청작업|액세서리|투톤)/;
// 메인이 될 수 없는 부속품
const SUB_PART =
  /브라켓|브라케트|몰딩|언더커버|트림|가니시|가니쉬|스위치|센서|카메라|힌지|웨더스트립|스테이|레일|프로텍터|라이너|델타|스커프|스텝플레이트|휠가드|엠블|앰블|심볼|래치|스트라이커|플러그|안테나|와이어링|배선|커버\(/;

function stripSuffix(name: string): string {
  return name
    .replace(/\s*(표면보수|표면판금보수|전면판금보수|교환|보수|판금)$/, "")
    .trim();
}
function norm(s: string): string {
  return s
    .replace(/[\s－\-,()（）]/g, "")
    .replace(/어셈블리|앗세이|에셈블리|어셈|assy/gi, "");
}
function panelKey(name: string): string | null {
  const m = MAIN_PANEL.exec(name);
  return m ? m[1] : null;
}

export function buildEstimateTree(rows: EstimateRow[]): EstimateTree {
  const groups: EstimateGroup[] = [];
  let cur: EstimateGroup | null = null;
  const open = (label: string) => {
    cur = { group: label, lines: [] };
    groups.push(cur);
    return cur;
  };
  const findByName = (name: string): EstimateGroup | null => {
    const n = norm(name);
    // 그룹 라벨(정규화)이 이름에 포함되면 그 그룹. 긴 라벨부터.
    const cands = groups
      .filter((g) => g.group !== "공통" && g.group !== "기타 부품")
      .map((g) => ({ g, k: norm(stripSuffix(g.group)) }))
      .filter(({ k }) => k.length >= 2 && n.includes(k))
      .sort((a, b) => b.k.length - a.k.length);
    if (cands.length) return cands[0].g;
    // 부위 키워드가 같으면 그 그룹 (같은 키워드 여러 개면 좌/우 표기 일치 우선)
    const key = panelKey(name);
    if (!key) return null;
    const side = /\(좌|좌측|,좌/.test(name)
      ? "좌"
      : /\(우|우측|,우/.test(name)
        ? "우"
        : "";
    const same = groups.filter((g) => panelKey(g.group) === key);
    return same.find((g) => side && g.group.includes(side)) ?? same[0] ?? null;
  };

  for (const r of rows) {
    const isPart =
      r.action === "" && (r.partCode !== "" || (r.before.part ?? 0) > 0);
    const isPaint = r.action === "도장" || r.action.endsWith("도장");
    const kind: EstimateLineKind = isPart
      ? "부품"
      : isPaint
        ? "도장"
        : r.action
          ? "공임"
          : "기타";
    const isCommon = COMMON.test(r.name);
    const isMain =
      kind === "공임" &&
      /^(교환|판금|수리)$/.test(r.action) &&
      MAIN_PANEL.test(r.name) &&
      !SUB_PART.test(r.name);
    // 메인 없이 나온 판넬 도장(표면보수도장 등)은 그 자체로 그룹을 연다
    const paintOpens =
      kind === "도장" &&
      !isCommon &&
      MAIN_PANEL.test(r.name) &&
      !SUB_PART.test(r.name) &&
      (!cur || cur.lines.every((l) => l.role !== "메인")) &&
      !(
        cur &&
        norm(cur.group) &&
        norm(r.name).includes(norm(stripSuffix(cur.group)))
      );

    let role: EstimateLineRole =
      kind === "부품"
        ? "부품"
        : kind === "도장"
          ? "도장"
          : kind === "공임"
            ? "부수"
            : "기타";
    if (isMain) role = "메인";

    let target: EstimateGroup;
    if (isCommon) {
      target = groups.find((g) => g.group === "공통") ?? open("공통");
      cur = groups.find((g) => g.group !== "공통" && g === cur) ?? null;
    } else if (isMain) {
      target = open(stripSuffix(r.name));
    } else if (paintOpens) {
      target = open(stripSuffix(r.name));
    } else if (
      kind === "부품" &&
      (!cur ||
        cur.group === "공통" ||
        cur.lines.every((l) => l.role !== "메인"))
    ) {
      // 뒤쪽에 몰아 적힌 부품은 이름으로 해당 부위 그룹을 찾아 붙임
      target =
        findByName(r.name) ??
        groups.find((g) => g.group === "기타 부품") ??
        open("기타 부품");
      if (target.group === "기타 부품") cur = null;
    } else if (cur) {
      target = cur;
    } else {
      target = open(stripSuffix(r.name));
    }
    target.lines.push({
      line_no: r.no,
      kind,
      role,
      name: r.name,
      action: r.action,
      hours: kind === "부품" ? null : r.hq,
      qty: kind === "부품" ? r.hq : null,
      partCode: r.partCode,
      before: r.before,
      after: r.after,
    });
  }
  return { groups, rowCount: rows.length };
}
