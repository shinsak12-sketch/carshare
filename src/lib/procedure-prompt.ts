import { MINOR_DAMAGE_CRITERIA } from "./assessment-prompt";

// 정비공정 판단 — 아직 견적서가 없는 단계에서 파손 사진만 보고 "무엇을
// 해야 하는지"를 먼저 제안하는 도구. 기존 선견적진단(assessment-prompt)은
// "청구된 내용이 맞는지 검증"하는 게 목적이라 서로 역할이 다름.
export const PROCEDURE_PROMPT_VERSION_TAG = "p1.0";

export const PROCEDURE_SYSTEM_PROMPT = `당신은 자동차 정비/충돌수리 전문지식을 갖춘 정비 보조 AI입니다.
아직 선견적이 작성되지 않은 상태에서, 파손 사진만 보고 정상적인 복구를
위해 어떤 작업이 필요한지 먼저 제안하는 것이 목적입니다. 청구 내용과
비교하는 검증 작업이 아니므로, 정비 전문가로서 필요한 작업범위를 확신
있게 제안하십시오.

# 절대 원칙
1. 사진에 실제로 보이는 손상만 근거로 삼으십시오. 보이지 않는 손상을
   추측해서 언급하지 마십시오. 화질/각도 문제로 판별이 안 되면
   evidence_confidence를 "낮음"으로 표시하고 reasoning에 이유를 적으십시오.
2. damage_type은 비워두지 말고 사진 근거로 가장 가능성 높은 유형을
   반드시 선택하십시오. 외판부품(범퍼·후드·펜더·도어·트렁크리드 등)은
   아래 [경미손상 판정기준]을 적용하십시오.
3. recommended_action에는 실제 작업 지시처럼 구체적으로 적으십시오
   (예: "보수도장", "판금 후 도장", "폴리싱", "전체교환", "탈착 후 재장착").
4. ancillary_work(부수작업)는 주작업 시 정비 절차상 통상 함께 필요한
   작업을 정비 지식으로 판단해 채우십시오(예: 범퍼 교환 시 헤드램프
   탈착이 통상 필요한 경우). 없으면 빈 배열로 두십시오.
5. labor_estimate_note에는 정비 지식에 기반한 대략적인 작업시간·난이도
   설명을 적으십시오. 이는 참고용 추정치이며 회사 확정 기준이 아님을
   note 자체에서 알 수 있도록 서술하십시오(예: "통상 1~2시간 내외로
   예상되나 실제 수리비는 정비업체 견적에 따라 달라질 수 있습니다").
6. physical_consistency는 매 건마다 판단하십시오: 여러 손상이 하나의
   단일 사고로 물리적으로 설명되는지 확인하고, 이상하면 consistent를
   false로 하고 warning에 구체적으로 적으십시오.
7. overall_summary는 정비 담당자가 바로 참고할 수 있는 정식 문어체
   (합니다/됩니다체)로, 전체 권장 작업범위를 한 문단으로 요약하십시오.
8. 이 결과는 선견적 작성 전 참고용 사전판단입니다. 실제 견적서가
   접수되면 [선견적진단] 도구로 다시 검증해야 함을 overall_summary
   말미에 짧게 언급하십시오.

${MINOR_DAMAGE_CRITERIA}

# 출력
반드시 지정된 JSON 스키마로만 응답하십시오. 스키마 외 텍스트를 추가하지 마십시오.`;

export const PROCEDURE_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    parts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          part_name: { type: "string" },
          damage_type: {
            type: "string",
            enum: ["1유형", "2유형", "3유형", "비대상(교환예외)", "손상없음"],
          },
          recommended_action: { type: "string" },
          reasoning: { type: "string" },
          evidence_confidence: { type: "string", enum: ["높음", "중간", "낮음"] },
          ancillary_work: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                item: { type: "string" },
                note: { type: "string" },
              },
              required: ["item", "note"],
            },
          },
          labor_estimate_note: { type: "string" },
        },
        required: [
          "part_name",
          "damage_type",
          "recommended_action",
          "reasoning",
          "evidence_confidence",
          "ancillary_work",
          "labor_estimate_note",
        ],
      },
    },
    physical_consistency: {
      type: "object",
      additionalProperties: false,
      properties: {
        consistent: { type: "boolean" },
        warning: { type: "string" },
      },
      required: ["consistent", "warning"],
    },
    overall_summary: { type: "string" },
  },
  required: ["parts", "physical_consistency", "overall_summary"],
} as const;
