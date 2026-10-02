import {
  ADJUSTMENT_SYSTEM_PROMPT,
  ADJUSTMENT_RESPONSE_SCHEMA,
} from "./adjustment-prompt";
import { REPAIR_PLAN_SCHEMA } from "./assessment-prompt";

// AI손해사정 v2(실험) adj5.0 — 현행 adj4.2 프롬프트를 그대로 쓰되, 한 번의 호출 안에
// "중간 산출물을 밖으로 쓰게 하는" 단계를 앞뒤로 붙인다.
//   0단계 사진 목록화 → 1단계 관찰표(판단 없음) → [현행 1단계 정비사 → 2단계 손해사정사,
//   단 모든 판정이 관찰 ID를 인용] → 자기검증(모순 찾아 수정) → 종합
// 현행과 같은 사진·견적서로 나란히 돌려 놓침·모순·비용을 비교하는 용도.
// 본문은 adjustment-prompt.ts를 잘라 끼우므로 현행 프롬프트가 바뀌면 같이 따라간다.

export const ADJUSTMENT2_PROMPT_VERSION_TAG = "adj5.0";

const base = ADJUSTMENT_SYSTEM_PROMPT;
const iStage1 = base.indexOf("# 1단계 — 정비사");
const iPrinciples = base.indexOf("# 원칙");
const iOutput = base.indexOf("# 출력");
if (iStage1 < 0 || iPrinciples < 0 || iOutput < 0)
  throw new Error("adjustment2-prompt: 현행 프롬프트의 구간 표식을 찾지 못함");

const head = base
  .slice(0, iStage1)
  .replace(
    "검토는 두 단계이며 한 응답 안에서 순서대로 수행합니다.",
    "검토는 아래 순서로 한 응답 안에서 수행합니다 — 0단계 사진 목록화, 1단계 관찰표, 그다음 정비사 단계와 손해사정사 단계, 마지막에 자기검증. 뒤 단계는 앞 단계의 산출물(사진 번호·관찰 ID)을 반드시 인용합니다.\n\n정비사·손해사정사 두 단계 중",
  );
const stages12 = base.slice(iStage1, iPrinciples);
const principles = base.slice(iPrinciples, iOutput);

const STAGE0_1 = `# 0단계 — 사진 목록화 (photo_index)
첨부 순서대로 모든 사진을 한 줄씩 적습니다: 사진 번호, 무엇이 찍혔는지(부위·각도,
예: "좌측 후미 비스듬히", "트렁크 바닥 탈거 후"), 수리 전 파손 / 작업 진행 / 완료 /
서류·기타 중 어느 것인지, 판독 가능 여부(흐림·역광·너무 멀면 false). 한 장도 빼지
마십시오 — 목록에 없는 사진은 뒤 단계에서 근거로 쓸 수 없습니다.

# 1단계 전 — 관찰표 (observations)
판단 없이 "보이는 것"만 적습니다. 관찰 하나 = 부위 하나의 손상 하나.
- id: 1부터 번호. part_name: 부위(좌/우 포함). damage_kind: 긁힘·찍힘·완만한 함몰·
  꺾임·주름·접힘·균열·찢어짐·천공·단차·벌어짐·헤밍부 이탈·탈락·기존 손상·부식 중.
  severity: 경미 / 보통 / 심함. photo_refs: 그 손상이 보이는 사진 번호 전부.
- 수리 전 파손 사진에서 읽은 것만 관찰입니다. 작업 사진에서 "교환된 신품"을 봤다면
  그것은 관찰이 아니라 실시 증거이므로 여기 적지 않습니다(2단계 photo_evidence에서).
- 내부·구조부처럼 보이지 않는 것은 적지 않습니다. 추론은 정비사 단계의 일입니다.
- 손상이 없는데 청구된 부위는 관찰이 없는 채로 두면 됩니다(억지로 만들지 마십시오).

`;

const EVIDENCE_RULES = `# 근거 인용 규칙 (정비사·손해사정사 단계 공통)
- repair_plan.main_works의 각 작업과 items의 각 항목은 evidence_ids에 근거가 된
  관찰 ID를 적습니다. 경로상 부수작업은 그 메인 작업의 관찰 ID를 그대로 적습니다.
  관찰에 없는 근거로 판단한 항목(추론, 청구서 구조·중복 판단, 작업 사진만 있는 항목)은
  evidence_ids를 빈 배열로 두고 reasoning에 왜 관찰 없이 판단했는지 한 구절 적습니다.
- confidence(높음/중간/낮음): 관찰이 직접 뒷받침하고 사진이 선명하면 높음, 추론·
  간접확인이 섞이면 중간, 사진 부족·판독 어려움·관찰과 청구가 어긋나면 낮음.
  낮음 항목은 담당자가 먼저 보는 항목이 되므로 아껴 쓰되 숨기지 마십시오.

`;

const SELF_CHECK = `# 자기검증 (self_check) — 판정을 다 쓴 뒤 반드시 수행
자기 결과를 처음 보는 검토자처럼 다시 읽고 아래를 확인해 self_check에 적습니다.
발견한 모순은 items·repair_plan을 고친 뒤, 무엇을 어떻게 고쳤는지(fixed) 적습니다.
모순이 없으면 self_check는 빈 배열입니다. 점검 목록:
1. rejected에 있는 line_no가 items에서 불인정이 아닌 것.
2. 메인 작업이 불인정·과다청구(수준 조정)인데 그 경로의 부수작업·교환도장이 인정인 것.
3. evidence_ids가 비었는데 judgment_basis가 "직접확인"인 메인 작업 항목.
4. 0단계에서 판독 가능하다고 한 수리 전 사진이 어느 관찰에도 쓰이지 않은 것
   (그 사진에 손상이 정말 없는지 다시 보고, 있으면 관찰표에 추가).
5. 같은 group에서 교환 공임과 판금·보수도장이 동시에 인정된 중복.
6. 독립 판정 항목의 절반 이상이 불인정·과다청구인 경우 — 기준을 잘못 적용했는지
   (탈착을 파손 여부로 판단, 경로를 좁게 잡음) 정비사 단계부터 다시 봄.

`;

export const ADJUSTMENT2_SYSTEM_PROMPT =
  head +
  STAGE0_1 +
  EVIDENCE_RULES +
  stages12 +
  SELF_CHECK +
  principles +
  `# 출력
JSON 스키마에 정의된 필드만 채우십시오. 채우는 순서: photo_index → observations →
repair_plan(메인 작업마다 evidence_ids) → items(항목마다 evidence_ids·confidence) →
self_check. items는 견적서의 공임·작업 항목(메인 작업, 도장, 부수 작업) 각각에
대응하는 하나의 원소이며, 부품비 라인은 넣지 말고, 견적서에 없는 항목을 새로 만들지
마십시오. repair_plan의 rejected에 있는 line_no는 items에서 반드시 "불인정"이어야
하고, 그 외 items의 불인정은 중복 또는 사진과의 명백한 모순만입니다.`;

// ---- 스키마: 현행 + photo_index·observations·evidence_ids·confidence·self_check ----
const CONFIDENCE_ENUM = ["높음", "중간", "낮음"] as const;

const REPAIR_PLAN_SCHEMA_V2 = {
  ...REPAIR_PLAN_SCHEMA,
  properties: {
    ...REPAIR_PLAN_SCHEMA.properties,
    main_works: {
      type: "array",
      items: {
        type: "object",
        properties: {
          ...REPAIR_PLAN_SCHEMA.properties.main_works.items.properties,
          evidence_ids: { type: "array", items: { type: "integer" } },
        },
        required: [
          ...REPAIR_PLAN_SCHEMA.properties.main_works.items.required,
          "evidence_ids",
        ],
        additionalProperties: false,
      },
    },
  },
} as const;

const baseItem = ADJUSTMENT_RESPONSE_SCHEMA.properties.items.items;

export const ADJUSTMENT2_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    estimate_provided: { type: "boolean" },
    photo_index: {
      type: "array",
      items: {
        type: "object",
        properties: {
          photo_no: { type: "integer" },
          view: { type: "string" },
          kind: {
            type: "string",
            enum: ["수리전", "작업중", "완료", "서류·기타"],
          },
          usable: { type: "boolean" },
        },
        required: ["photo_no", "view", "kind", "usable"],
        additionalProperties: false,
      },
    },
    observations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "integer" },
          part_name: { type: "string" },
          damage_kind: { type: "string" },
          severity: { type: "string", enum: ["경미", "보통", "심함"] },
          photo_refs: { type: "array", items: { type: "integer" } },
        },
        required: ["id", "part_name", "damage_kind", "severity", "photo_refs"],
        additionalProperties: false,
      },
    },
    repair_plan: REPAIR_PLAN_SCHEMA_V2,
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          ...baseItem.properties,
          evidence_ids: { type: "array", items: { type: "integer" } },
          confidence: { type: "string", enum: CONFIDENCE_ENUM },
        },
        required: [...baseItem.required, "evidence_ids", "confidence"],
        additionalProperties: false,
      },
    },
    physical_consistency:
      ADJUSTMENT_RESPONSE_SCHEMA.properties.physical_consistency,
    self_check: {
      type: "array",
      items: {
        type: "object",
        properties: {
          issue: { type: "string" },
          fixed: { type: "string" },
        },
        required: ["issue", "fixed"],
        additionalProperties: false,
      },
    },
  },
  required: [
    "estimate_provided",
    "photo_index",
    "observations",
    "repair_plan",
    "items",
    "physical_consistency",
    "self_check",
  ],
  additionalProperties: false,
} as const;
