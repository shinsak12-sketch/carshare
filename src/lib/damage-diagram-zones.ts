// 정비공정 결과의 "손상 위치 도해"용 — 손상부위 문자열을 차량 평면도의
// 특정 구역에 매칭시키는 키워드 테이블. 손상부위 이름은 자유 텍스트라
// 완벽한 매칭은 불가능함을 전제로, 최대한 겹치지 않게 대표 키워드로
// 매칭하고 매칭 실패 항목은 호출부에서 별도 목록으로 안내한다.

export interface DiagramZone {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  dashed?: boolean; // 사이드멤버/엔진룸처럼 외부에서 안 보이는 구조부
}

export const CAR_DIAGRAM_VIEWBOX = "0 0 300 552";

export const CAR_DIAGRAM_BODY = { x: 55, y: 14, w: 190, h: 524, rx: 55 };

export const CAR_DIAGRAM_WHEELS = [
  { cx: 50, cy: 130 },
  { cx: 250, cy: 130 },
  { cx: 50, cy: 428 },
  { cx: 250, cy: 428 },
];

export const DIAGRAM_ZONES: DiagramZone[] = [
  { id: "bumper_front", label: "프론트범퍼", x: 65, y: 20, w: 170, h: 22 },
  { id: "headlamp_L", label: "헤드램프(좌)", x: 65, y: 46, w: 42, h: 24 },
  { id: "headlamp_R", label: "헤드램프(우)", x: 193, y: 46, w: 42, h: 24 },
  { id: "grille", label: "라디에이터그릴", x: 107, y: 46, w: 86, h: 24 },
  { id: "radiator", label: "라디에이터/코어서포트", x: 107, y: 74, w: 86, h: 32 },
  { id: "fender_front_L", label: "프론트펜더(좌)", x: 65, y: 74, w: 42, h: 110 },
  { id: "fender_front_R", label: "프론트펜더(우)", x: 193, y: 74, w: 42, h: 110 },
  { id: "hood", label: "후드", x: 107, y: 106, w: 86, h: 78 },
  { id: "side_member_L", label: "사이드멤버(좌)", x: 124, y: 106, w: 8, h: 110, dashed: true },
  { id: "side_member_R", label: "사이드멤버(우)", x: 168, y: 106, w: 8, h: 110, dashed: true },
  { id: "engine_bay", label: "엔진룸(엔진·변속기)", x: 136, y: 118, w: 28, h: 70, dashed: true },
  { id: "door_front_L", label: "프론트도어(좌)", x: 65, y: 184, w: 42, h: 95 },
  { id: "door_front_R", label: "프론트도어(우)", x: 193, y: 184, w: 42, h: 95 },
  { id: "roof", label: "루프", x: 107, y: 184, w: 86, h: 190 },
  { id: "door_rear_L", label: "리어도어(좌)", x: 65, y: 279, w: 42, h: 95 },
  { id: "door_rear_R", label: "리어도어(우)", x: 193, y: 279, w: 42, h: 95 },
  { id: "fender_rear_L", label: "리어펜더(좌)", x: 65, y: 374, w: 42, h: 108 },
  { id: "fender_rear_R", label: "리어펜더(우)", x: 193, y: 374, w: 42, h: 108 },
  { id: "trunk", label: "트렁크", x: 107, y: 374, w: 86, h: 132 },
  { id: "taillamp_L", label: "리어콤비네이션램프(좌)", x: 65, y: 482, w: 42, h: 24 },
  { id: "taillamp_R", label: "리어콤비네이션램프(우)", x: 193, y: 482, w: 42, h: 24 },
  { id: "bumper_rear", label: "리어범퍼", x: 65, y: 508, w: 170, h: 22 },
];

const FRONT_WORDS = ["프론트", "전면", "전방"];
const REAR_WORDS = ["리어", "후면", "후방"];

function hasAny(text: string, words: string[]): boolean {
  return words.some((w) => text.includes(w));
}

// 좌/우는 더 이상 텍스트에서 추측하지 않음 — AI가 채우는 side 필드를
// 그대로 받아서 씀(procedure-prompt.ts에서 근거 없이 단정하지 말라고 지시함).
function sideToLR(side: string): "L" | "R" | "both" {
  if (side === "좌") return "L";
  if (side === "우") return "R";
  return "both"; // "중앙" | "양쪽" | 그 외 예상치 못한 값
}

function classifyFrontRear(text: string, fallback: "front" | "rear" | "both"): "front" | "rear" | "both" {
  const f = hasAny(text, FRONT_WORDS);
  const r = hasAny(text, REAR_WORDS);
  if (f && !r) return "front";
  if (r && !f) return "rear";
  return fallback;
}

function sided(base: string, side: "L" | "R" | "both"): string[] {
  if (side === "both") return [`${base}_L`, `${base}_R`];
  return [`${base}_${side}`];
}

// 텍스트(손상부위명 또는 추정손상 항목명)와 AI가 채운 side 필드를 받아
// 매칭되는 구역 id 목록을 반환. 매칭되는 게 없으면 빈 배열 — 호출부에서
// "도해에 표시 안 됨" 목록으로 처리.
export function matchDiagramZones(text: string, sideField: string): string[] {
  const t = text.replace(/\s/g, "");
  const side = sideToLR(sideField);
  const ids = new Set<string>();

  if (t.includes("범퍼") || t.includes("크래시박스") || t.includes("범퍼스테이") || t.includes("언더커버")) {
    const fr = classifyFrontRear(t, "both");
    if (fr !== "rear") ids.add("bumper_front");
    if (fr !== "front") ids.add("bumper_rear");
  }
  if (t.includes("헤드램프") || t.includes("전조등") || t.includes("헤드라이트")) {
    sided("headlamp", side).forEach((id) => ids.add(id));
  }
  if (t.includes("그릴")) ids.add("grille");
  if (t.includes("라디에이터")) ids.add("radiator");
  if (t.includes("펜더") || t.includes("쿼터패널") || t.includes("휠하우스") || t.includes("머드가드")) {
    const fr = classifyFrontRear(t, "front");
    const base = fr === "rear" ? "fender_rear" : "fender_front";
    sided(base, side).forEach((id) => ids.add(id));
  }
  if (t.includes("후드") || t.includes("보닛")) ids.add("hood");
  if (t.includes("사이드멤버")) sided("side_member", side).forEach((id) => ids.add(id));
  if (t.includes("엔진") || t.includes("변속기") || t.includes("미션")) ids.add("engine_bay");
  if (t.includes("도어")) {
    const fr = classifyFrontRear(t, "front");
    const base = fr === "rear" ? "door_rear" : "door_front";
    sided(base, side).forEach((id) => ids.add(id));
  }
  if (t.includes("루프") || t.includes("지붕")) ids.add("roof");
  if (t.includes("트렁크") || t.includes("테일게이트")) ids.add("trunk");
  if (t.includes("콤비네이션램프") || t.includes("테일램프") || t.includes("후미등")) {
    sided("taillamp", side).forEach((id) => ids.add(id));
  }

  return Array.from(ids);
}
