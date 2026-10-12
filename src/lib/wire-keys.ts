// 출력 JSON 키 축약. 모델에게는 짧은 키의 스키마를 주고, 응답은 서버에서 원래 키로
// 되돌린다(expandWireKeys). 화면·리포트 코드는 원래 키만 본다.
// 축약 키는 전역에서 유일해야 하고(역변환이 문맥 없이 이뤄짐), 어떤 스키마의 원래
// 키와도 겹치면 안 된다. 원래 키를 그대로 둔 것(role, item, note, side…)은 이미 짧은 것.

export const WIRE_KEYS: Record<string, string> = {
  line_no: "no",
  group: "grp",
  follows_parent: "link",
  item_name: "name",
  part_name: "part",
  stage_name: "stage",
  claimed_action: "act",
  claimed_hours: "hrs",
  photo_evidence: "evid",
  judgment_basis: "basis",
  photo_refs: "refs",
  damage_type: "dtype",
  verdict: "v",
  reasoning: "why",
  adjustment_note: "adj",
  cost_comparison: "cost",
  replace_option: "replace",
  repair_option: "repair",
  recommendation: "rec",
  estimate_provided: "est",
  physical_consistency: "consist",
  consistent: "ok",
  warning: "warn",
  overall_repair_scope_review: "scope",
  appropriate: "fit",
  evidence_confidence: "conf",
  labor_time_check: "time",
  claimed_h: "claimed",
  reference_h: "ref",
  reference_verdict: "ref_v",
  general_assessment: "assess",
  ancillary_work_check: "anc",
  in_allowed_list: "listed",
  mechanically_plausible: "plausible",
  required_action: "action",
  claimed_but_not_visible: "not_visible",
  damage_but_not_claimed: "not_claimed",
  other_findings: "other",
  category: "cat",
  description: "desc",
  reference_basis: "ref_basis",
  overall_opinion: "opinion",
  damaged_parts: "damaged",
  view_cue: "cue",
  front_direction: "front",
  damage_screen_side: "dside",
  suspected_hidden_damage: "hidden",
  suspicion_level: "level",
  recommended_check: "check",
  process_stages: "stages",
  overall_summary: "summary",
  repair_plan: "plan",
  vehicle_structure: "structure",
  damage_summary: "damage",
  main_works: "works",
  access_path: "access",
  for_work: "for",
  // 경미손상판독
  vehicle_note: "note_v",
  observations: "obs",
  classification: "cls",
  key_evidence: "evidence",
  exchange_conditions: "conditions",
  repair_method: "method",
  additional_photos: "more_photos",
  report_text: "report",
  location: "loc",
};

const INVERSE: Record<string, string> = {};
for (const [long, short] of Object.entries(WIRE_KEYS)) {
  if (INVERSE[short]) throw new Error(`wire key 중복: ${short}`);
  if (WIRE_KEYS[short]) throw new Error(`wire key가 원래 키와 겹침: ${short}`);
  INVERSE[short] = long;
}

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v);

// JSON 스키마의 properties/required 키를 축약형으로 바꾼 사본
export function toWireSchema<T>(schema: T): T {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (!isObj(node)) return node;
    const out: Json = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === "properties" && isObj(v)) {
        const props: Json = {};
        for (const [pk, pv] of Object.entries(v)) {
          const short = WIRE_KEYS[pk] ?? pk;
          if (short !== pk && pk in v && short in v)
            throw new Error(`축약 키 충돌: ${pk} → ${short}`);
          props[short] = walk(pv);
        }
        out[k] = props;
      } else if (k === "required" && Array.isArray(v)) {
        out[k] = v.map((r) =>
          typeof r === "string" ? (WIRE_KEYS[r] ?? r) : r,
        );
      } else out[k] = walk(v);
    }
    return out;
  };
  return walk(schema) as T;
}

// 모델 응답의 축약 키를 원래 키로. 모델이 원래 키로 냈어도 그대로 통과.
export function expandWireKeys<T = unknown>(value: unknown): T {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (!isObj(node)) return node;
    const out: Json = {};
    for (const [k, v] of Object.entries(node)) out[INVERSE[k] ?? k] = walk(v);
    return out;
  };
  return walk(value) as T;
}

// 프롬프트 본문은 원래 필드명으로 쓰여 있으므로, 스키마에 실제로 쓰인 축약 키의
// 대응표를 프롬프트 끝에 붙인다.
export function wireKeyLegend(schema: unknown): string {
  const used = new Set<string>();
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!isObj(node)) return;
    for (const [k, v] of Object.entries(node)) {
      if (k === "properties" && isObj(v))
        for (const pk of Object.keys(v)) if (WIRE_KEYS[pk]) used.add(pk);
      walk(v);
    }
  };
  walk(schema);
  if (used.size === 0) return "";
  const pairs = [...used].map((k) => `${k}=${WIRE_KEYS[k]}`).join(", ");
  return `# 출력 키 대응표
스키마의 JSON 키는 축약형입니다. 위 본문의 필드명 = 스키마 키: ${pairs}. 의미와
채우는 규칙은 본문 그대로이며 키 이름만 다릅니다.`;
}
