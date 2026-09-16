// [실험] 청구 견적서(PDF 텍스트)를 부위별 트리로 구조화 — 사진 없이 텍스트만 보내는 가벼운 호출.
// 화면에서 PDF 뷰어 대신 "[메인] 프런트범퍼 교환 └ [부수] 브라켓 탈착 └ [도장] 교환도장 └ [부품] 범퍼커버"로 보여줌.

export type EstimateLineKind = "부품" | "공임" | "도장" | "기타";
export type EstimateLineRole = "메인" | "부수" | "도장" | "부품" | "기타";

export interface EstimateLine {
  line_no: number;
  kind: EstimateLineKind;
  role: EstimateLineRole;
  name: string;
  action: string;
  hours: number | null;
  amount: number | null;
  qty: number | null;
}

export interface EstimateGroup {
  group: string;
  lines: EstimateLine[];
}

export interface EstimateTree {
  groups: EstimateGroup[];
  summary: {
    parts_total: number | null;
    labor_total: number | null;
    paint_total: number | null;
    total: number | null;
  };
}

export const ESTIMATE_TREE_PROMPT = `당신은 자동차 보험수리비 견적서(청구서) 원문 텍스트를 구조화하는 도우미입니다.
판단·평가는 하지 않고, 청구서에 적힌 항목을 부위(판넬) 단위 트리로 재구성만 합니다.

규칙
1. 청구서의 모든 항목(부품·공임·도장)을 빠짐없이 lines에 넣으십시오. 한 항목은 한 번만.
2. group = 부위(판넬) 이름. 같은 부위의 부품·공임·도장·부수작업은 같은 group에 묶습니다.
   예: "프런트범퍼", "프런트펜더(우)", "헤드램프(좌)". 좌/우가 있으면 이름에 괄호로 표기.
3. role
   - "메인": 그 부위의 핵심 작업 공임(교환·판금·수리·복원). 부위당 하나.
   - "부수": 그 부위 작업에 딸린 탈착·O/H·소부품 교환 공임.
   - "도장": 교환도장·보수도장·컬러매칭·가열건조 등 도장 항목.
   - "부품": 부품비 라인.
   - "기타": 위에 안 들어가는 항목(공임 총계·부가세 등은 넣지 말고 summary에).
4. kind는 청구서 구분(부품/공임/도장)을 그대로. action은 작업명(교환, 탈착, 판금, 교환도장 등),
   hours는 시간(있으면 숫자, 없으면 null), amount는 금액(원, 없으면 null), qty는 수량(없으면 null).
5. line_no는 청구서 원문의 순번(없으면 위에서부터 센 순번). 원문 순서를 유지하십시오.
6. 어느 부위인지 알 수 없는 공통 항목(컬러매칭, 가열건조, 방청 등)은 group "도장 공통" 또는 "공통"으로.
7. summary에는 청구서에 적힌 부품 합계·공임 합계·도장 합계·총계를 그대로(없으면 null). 계산하지 마십시오.
8. 지정된 JSON 스키마로만 응답하십시오.`;

export const ESTIMATE_TREE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    groups: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          group: { type: "string" },
          lines: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                line_no: { type: "integer" },
                kind: {
                  type: "string",
                  enum: ["부품", "공임", "도장", "기타"],
                },
                role: {
                  type: "string",
                  enum: ["메인", "부수", "도장", "부품", "기타"],
                },
                name: { type: "string" },
                action: { type: "string" },
                hours: { type: ["number", "null"] },
                amount: { type: ["number", "null"] },
                qty: { type: ["number", "null"] },
              },
              required: [
                "line_no",
                "kind",
                "role",
                "name",
                "action",
                "hours",
                "amount",
                "qty",
              ],
            },
          },
        },
        required: ["group", "lines"],
      },
    },
    summary: {
      type: "object",
      additionalProperties: false,
      properties: {
        parts_total: { type: ["number", "null"] },
        labor_total: { type: ["number", "null"] },
        paint_total: { type: ["number", "null"] },
        total: { type: ["number", "null"] },
      },
      required: ["parts_total", "labor_total", "paint_total", "total"],
    },
  },
  required: ["groups", "summary"],
} as const;
