// 보험수리비 내역서(AOS 양식) PDF의 항목 표를 텍스트 좌표로 그대로 읽어낸다. GPT 없음.
// 표 열: NO | 작업항목 및 부품명 | 작업 | H,Q,% | 부품코드 | [손해 사정전] 부품가격 · 공임 | [손해 사정후] 부품가격 · 공임
// 숫자 열은 오른쪽 정렬이라 각 토큰의 오른쪽 끝을 헤더의 오른쪽 끝과 비교해 열을 정한다.

export interface EstimateRow {
  no: string; // "1", "U88" 등 원문 그대로
  name: string;
  action: string; // 교환 / 탈착 / 판금 / 수리 / 도장 / ""(부품)
  hq: number | null; // H,Q,% 값
  partCode: string;
  before: { part: number | null; labor: number | null }; // 손해 사정전(청구)
  after: { part: number | null; labor: number | null }; // 손해 사정후
}

interface Tok {
  x: number;
  right: number;
  y: number;
  s: string;
}

function toNum(s: string): number | null {
  const t = s.replace(/,/g, "").trim();
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

export async function parseEstimateTable(
  buffer: Buffer,
): Promise<EstimateRow[]> {
  const pdfjs = await import("pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const rows: EstimateRow[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const toks: Tok[] = tc.items
      .filter((it) => it.str.trim() !== "")
      .map((it) => ({
        x: it.transform[4],
        right: it.transform[4] + it.width,
        y: it.transform[5],
        s: it.str,
      }));

    // 헤더 위치 찾기 (페이지마다 표 헤더가 반복됨)
    const hNo = toks.find((t) => t.s.trim() === "NO");
    const hAction = toks.find((t) => t.s.trim() === "작업");
    const hHq = toks.find((t) => t.s.includes("H,Q"));
    const hCode = toks.find((t) => t.s.includes("부품코드"));
    const numHeads = toks
      .filter((t) => t.s.trim() === "부품가격" || t.s.trim() === "공임")
      .sort((a, b) => a.x - b.x);
    if (!hNo || !hAction || !hHq || !hCode || numHeads.length < 4) continue;
    const headerY = hNo.y;
    const colRights = numHeads.slice(0, 4).map((t) => t.right); // [전 부품, 전 공임, 후 부품, 후 공임]

    // 행 묶기: 헤더 아래(y 작음)만, y 근접(±3)으로
    const body = toks.filter((t) => t.y < headerY - 4 && t.y > 40);
    body.sort((a, b) => b.y - a.y || a.x - b.x);
    const lines: Tok[][] = [];
    for (const t of body) {
      const last = lines[lines.length - 1];
      if (last && Math.abs(last[0].y - t.y) <= 3) last.push(t);
      else lines.push([t]);
    }

    for (const line of lines) {
      line.sort((a, b) => a.x - b.x);
      const first = line[0];
      if (!/^U?\d+$/.test(first.s.trim())) continue; // 순번으로 시작하는 행만
      if (first.x > hNo.x + 20) continue;
      let no = first.s.trim();
      const nameParts: string[] = [];
      let action = "";
      let hq: number | null = null;
      let partCode = "";
      const nums: { right: number; v: number }[] = [];
      // 열 경계: 헤더 x의 중간값. 헤더 글자는 열 가운데 정렬이고 값은 왼쪽 정렬이라 중간값이 안전
      const actionEnd = (hAction.x + hHq.x) / 2;
      const hqEnd = (hHq.x + hCode.x) / 2 + 6;
      const codeEnd = colRights[0] - 70;
      for (const t of line.slice(1)) {
        const s = t.s.trim();
        if (t.x < hAction.x - 6) {
          // 사용자 정의 항목은 순번 앞에 "U"가 따로 찍힘
          if (s === "U" && nameParts.length === 0) no = `U${no}`;
          else nameParts.push(s);
        } else if (t.x < actionEnd) {
          action = s;
        } else if (t.x < hqEnd) {
          const v = toNum(s);
          if (v !== null) hq = v;
          else partCode = s;
        } else if (t.x < codeEnd) {
          const v = toNum(s);
          if (v !== null && t.right < codeEnd) partCode = s;
          else if (v !== null) nums.push({ right: t.right, v });
          else partCode = s;
        } else {
          const v = toNum(s);
          if (v !== null) nums.push({ right: t.right, v });
        }
      }
      // 숫자 열 배정: 오른쪽 끝이 가장 가까운 헤더 열
      const cells: (number | null)[] = [null, null, null, null];
      for (const n of nums) {
        let best = 0;
        let bestD = Infinity;
        colRights.forEach((r, i) => {
          const d = Math.abs(r - n.right);
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        });
        cells[best] = n.v;
      }
      rows.push({
        no,
        name: nameParts.join(" ").replace(/\s+/g, " ").trim(),
        action,
        hq,
        partCode,
        before: { part: cells[0], labor: cells[1] },
        after: { part: cells[2], labor: cells[3] },
      });
    }
  }
  return rows;
}
