import type { PartSide, ProcedureResult, ViewCue } from "./procedure-types";

// 차량 기준 좌/우 환산 — AI의 관찰 사실(view_cue)로 코드가 결정한다.
// 기준: 운전자가 앉아 앞을 볼 때의 좌/우. 국내 차량은 운전석이 왼쪽.
//  · 앞에서 마주보고 찍음(앞머리가 카메라 쪽): 화면 왼쪽 = 차량 우측, 화면 오른쪽 = 차량 좌측
//  · 뒤에서 찍음(앞머리가 카메라 반대쪽): 화면 왼쪽 = 차량 좌측
//  · 옆/코너에서 찍음: 앞머리가 화면 오른쪽을 향하면 보이는 옆면은 차량 우측, 왼쪽을 향하면 차량 좌측
//    (차가 오른쪽으로 달리는 걸 보면 내가 보는 면은 그 차의 오른쪽 옆구리)
export function sideFromViewCue(cue: ViewCue | undefined): PartSide | null {
  if (!cue) return null;
  if (cue.damage_screen_side === "중앙") return "중앙";
  const fd = cue.front_direction;
  const ds = cue.damage_screen_side;

  // 옆·코너: 보이는 옆면 자체가 좌/우를 결정
  if (fd === "화면오른쪽") return "우";
  if (fd === "화면왼쪽") return "좌";

  // 앞/뒤에서 마주본 경우: 화면 좌우로 결정
  const facingCamera =
    fd === "카메라쪽" ||
    (fd === "불명" && (cue.camera === "앞" || cue.camera === "앞코너"));
  const facingAway =
    fd === "카메라반대쪽" ||
    (fd === "불명" && (cue.camera === "뒤" || cue.camera === "뒤코너"));
  if (ds === "화면왼쪽") {
    if (facingCamera) return "우";
    if (facingAway) return "좌";
  }
  if (ds === "화면오른쪽") {
    if (facingCamera) return "좌";
    if (facingAway) return "우";
  }
  return null;
}

// AI가 적은 side가 환산 결과와 다르면 환산 결과로 덮어쓴다. 중앙·양쪽은 AI 판단 유지.
export function normalizeProcedureSides(
  result: ProcedureResult,
): ProcedureResult {
  const fix = <T extends { side: PartSide; view_cue?: ViewCue }>(x: T): T => {
    if (x.side === "중앙" || x.side === "양쪽") return x;
    const computed = sideFromViewCue(x.view_cue);
    if (computed && computed !== "중앙" && computed !== x.side)
      return { ...x, side: computed };
    return x;
  };
  return {
    ...result,
    damaged_parts: result.damaged_parts.map(fix),
    suspected_hidden_damage: result.suspected_hidden_damage.map(fix),
  };
}
