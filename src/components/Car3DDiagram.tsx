"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { matchDiagramZones } from "@/lib/damage-diagram-zones";
import type {
  DamagedPartSummary,
  SuspectedHiddenDamage,
} from "@/lib/procedure-types";

// 정비공정 손상 위치 도해 — 로우폴리 세단을 패널 단위로 조립해 확인된 손상(빨강)·
// 정밀점검 추정(노랑)을 칠하고, 마우스로 돌려 전후좌우 어디서든 볼 수 있게 함.
// 패널 id는 2D 도해와 같은 damage-diagram-zones 키를 그대로 씀(매칭 로직 공유).

type ZoneStatus = "confirmed" | "suspected";

const COLOR = {
  body: 0xd6dce6,
  bodyDark: 0xcbd5e1,
  confirmed: 0xef4444,
  suspected: 0xf59e0b,
  glass: 0x7fb3e6,
  wheel: 0x1e293b,
  rim: 0x94a3b8,
  edge: 0x475569,
  lamp: 0xf8fafc,
  tail: 0xfca5a5,
};

// 부품 메타 — 색·유리 여부·손상 매칭 대상 여부. 형상은 아래 buildCar에서 곡선으로 만듦.
interface PartMeta {
  label: string;
  zone?: boolean;
  glass?: boolean;
  color?: number;
}
const PARTS: Record<string, PartMeta> = {
  core: { label: "차체", color: COLOR.bodyDark },
  bumper_front: { label: "프론트범퍼", zone: true },
  bumper_rear: { label: "리어범퍼", zone: true },
  grille: { label: "라디에이터그릴", zone: true, color: 0x334155 },
  headlamp_L: { label: "헤드램프(좌)", zone: true, color: COLOR.lamp },
  headlamp_R: { label: "헤드램프(우)", zone: true, color: COLOR.lamp },
  taillamp_L: {
    label: "리어콤비네이션램프(좌)",
    zone: true,
    color: COLOR.tail,
  },
  taillamp_R: {
    label: "리어콤비네이션램프(우)",
    zone: true,
    color: COLOR.tail,
  },
  hood: { label: "후드", zone: true },
  roof: { label: "루프", zone: true },
  trunk: { label: "트렁크", zone: true },
  fender_front_L: { label: "프론트펜더(좌)", zone: true },
  fender_front_R: { label: "프론트펜더(우)", zone: true },
  door_front_L: { label: "프론트도어(좌)", zone: true },
  door_front_R: { label: "프론트도어(우)", zone: true },
  door_rear_L: { label: "리어도어(좌)", zone: true },
  door_rear_R: { label: "리어도어(우)", zone: true },
  fender_rear_L: { label: "리어펜더(좌)", zone: true },
  fender_rear_R: { label: "리어펜더(우)", zone: true },
  windshield: { label: "윈드실드", glass: true },
  rear_glass: { label: "리어글라스", glass: true },
  win_front_L: { label: "프론트도어 글라스(좌)", glass: true },
  win_front_R: { label: "프론트도어 글라스(우)", glass: true },
  win_rear_L: { label: "리어도어 글라스(좌)", glass: true },
  win_rear_R: { label: "리어도어 글라스(우)", glass: true },
  pillars: { label: "필러", color: COLOR.bodyDark },
  mirror_L: { label: "사이드미러(좌)", color: COLOR.bodyDark },
  mirror_R: { label: "사이드미러(우)", color: COLOR.bodyDark },
};

// ── 형상 헬퍼 ────────────────────────────────────────────────────────────
// 좌표계: X = 좌(-)/우(+), Y = 높이, Z = 앞(+)/뒤(-). 단위 m.
const WHEEL_Z = 1.5;
const WHEEL_Y = 0.34;
const ARCH_R = 0.44;

const BEVEL = {
  bevelEnabled: true,
  bevelThickness: 0.015,
  bevelSize: 0.015,
  bevelSegments: 3,
  curveSegments: 28,
};

// 옆면(Z-Y 평면) 도형을 X 방향으로 뽑아냄. xLeft(최소 x)부터 width만큼.
function extrudeSide(
  shape: THREE.Shape,
  width: number,
  xLeft: number,
  bevel = true,
): THREE.BufferGeometry {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    ...(bevel ? BEVEL : { bevelEnabled: false }),
  });
  // 로컬 (x,y,z) → 월드 (z=x, y, x=-z): Y축 -90° 회전 후 x 이동
  geo.rotateY(-Math.PI / 2);
  geo.translate(xLeft + width, 0, 0);
  return geo;
}

// 평면도(X-Z 평면) 도형을 Y 방향으로 뽑아냄 (범퍼용). shape의 y축 = 월드 -z.
function extrudePlan(
  shape: THREE.Shape,
  height: number,
  yBottom: number,
): THREE.BufferGeometry {
  const geo = new THREE.ExtrudeGeometry(shape, { depth: height, ...BEVEL });
  geo.rotateX(-Math.PI / 2); // 로컬 z(뽑기) → 월드 y, 로컬 y → 월드 -z
  geo.translate(0, yBottom, 0);
  return geo;
}

function roundedBox(
  w: number,
  h: number,
  d: number,
  r: number,
): THREE.BufferGeometry {
  const sh = new THREE.Shape();
  const x = -w / 2,
    y = -h / 2;
  sh.moveTo(x + r, y);
  sh.lineTo(x + w - r, y);
  sh.quadraticCurveTo(x + w, y, x + w, y + r);
  sh.lineTo(x + w, y + h - r);
  sh.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  sh.lineTo(x + r, y + h);
  sh.quadraticCurveTo(x, y + h, x, y + h - r);
  sh.lineTo(x, y + r);
  sh.quadraticCurveTo(x, y, x + r, y);
  const geo = new THREE.ExtrudeGeometry(sh, {
    depth: d,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.01,
    bevelSegments: 2,
    curveSegments: 12,
  });
  geo.translate(0, 0, -d / 2);
  return geo;
}

// 바닥 선을 따라가되 휠아치 자리를 반원으로 파냄 (z1 > z2 방향으로 진행)
function bottomWithArches(
  sh: THREE.Shape,
  zFrom: number,
  zTo: number,
  y: number,
  arches: number[],
) {
  const dir = zTo < zFrom ? -1 : 1;
  const sorted = [...arches].sort((a, b) => (dir < 0 ? b - a : a - b));
  let cur = zFrom;
  for (const az of sorted) {
    const a = az - dir * ARCH_R;
    const b = az + dir * ARCH_R;
    if (
      (dir < 0 && (a > zFrom || b < zTo)) ||
      (dir > 0 && (a < zFrom || b > zTo))
    )
      continue;
    sh.lineTo(a, y);
    // 반원: 중심 (az, WHEEL_Y), 위쪽으로
    sh.absarc(
      az,
      WHEEL_Y,
      ARCH_R,
      dir < 0 ? 0 : Math.PI,
      dir < 0 ? Math.PI : 0,
      dir > 0,
    );
    cur = b;
  }
  sh.lineTo(zTo, y);
  return cur;
}

// 옆면 패널 (펜더·도어·쿼터): 상단은 벨트라인, 하단은 사이드실, 필요하면 휠아치
function sidePanel(
  zFront: number,
  zRear: number,
  yTop: number,
  yTopRear: number,
  arches: number[],
): THREE.Shape {
  const yBot = 0.3;
  const sh = new THREE.Shape();
  sh.moveTo(zFront, yBot);
  sh.lineTo(zFront, yTop);
  sh.quadraticCurveTo(
    (zFront + zRear) / 2,
    (yTop + yTopRear) / 2 + 0.01,
    zRear,
    yTopRear,
  );
  sh.lineTo(zRear, yBot);
  bottomWithArches(sh, zRear, zFront, yBot, arches);
  sh.closePath();
  return sh;
}

// 위 곡면 슬랩(후드·루프·트렁크): 상단 곡선 + 두께
function slab(
  pts: [number, number][],
  ctrl: [number, number],
  thick: number,
): THREE.Shape {
  const [a, b] = pts;
  const sh = new THREE.Shape();
  sh.moveTo(a[0], a[1]);
  sh.quadraticCurveTo(ctrl[0], ctrl[1], b[0], b[1]);
  sh.lineTo(b[0], b[1] - thick);
  sh.quadraticCurveTo(ctrl[0], ctrl[1] - thick, a[0], a[1] - thick);
  sh.closePath();
  return sh;
}

// 범퍼 평면도: 모서리를 감싸는 U자 띠. front=true면 앞쪽.
function bumperPlan(front: boolean): THREE.Shape {
  const s = front ? 1 : -1;
  // shape y = 월드 -z 이므로 앞쪽(z 양수)은 y 음수
  const zOut = -s * 2.36,
    zIn = -s * 2.1,
    zBack = -s * 1.85;
  const sh = new THREE.Shape();
  sh.moveTo(-0.94, zBack);
  sh.quadraticCurveTo(-0.94, zOut, -0.55, zOut);
  sh.lineTo(0.55, zOut);
  sh.quadraticCurveTo(0.94, zOut, 0.94, zBack);
  sh.lineTo(0.84, zBack);
  sh.quadraticCurveTo(0.84, zIn, 0.5, zIn);
  sh.lineTo(-0.5, zIn);
  sh.quadraticCurveTo(-0.84, zIn, -0.84, zBack);
  sh.closePath();
  return sh;
}

function buildCar(
  scene: THREE.Scene,
  edgeMat: THREE.LineBasicMaterial,
): Map<string, THREE.Mesh> {
  const meshes = new Map<string, THREE.Mesh>();
  const add = (
    id: string,
    geo: THREE.BufferGeometry,
    opts?: { edges?: boolean },
  ) => {
    const meta = PARTS[id];
    const mat = meta.glass
      ? new THREE.MeshPhysicalMaterial({
          color: COLOR.glass,
          transparent: true,
          opacity: 0.42,
          roughness: 0.1,
          metalness: 0.05,
          clearcoat: 0.6,
          envMapIntensity: 0.35,
        })
      : new THREE.MeshPhysicalMaterial({
          color: meta.color ?? COLOR.body,
          roughness: 0.32,
          metalness: 0.1,
          clearcoat: 0.9,
          clearcoatRoughness: 0.12,
          envMapIntensity: 0.55,
        });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = !meta.glass;
    mesh.receiveShadow = true;
    mesh.userData = { id, label: meta.label, zone: !!meta.zone };
    if (!meta.glass && opts?.edges !== false)
      mesh.add(
        new THREE.LineSegments(new THREE.EdgesGeometry(geo, 28), edgeMat),
      );
    scene.add(mesh);
    meshes.set(id, mesh);
    return mesh;
  };

  // 차체 코어: 옆면 실루엣 전체(하부~벨트라인)를 폭 1.6으로 — 패널 뒤에서 틈을 메움
  {
    const sh = new THREE.Shape();
    sh.moveTo(2.2, 0.3);
    sh.lineTo(2.2, 0.72);
    sh.quadraticCurveTo(1.6, 0.98, 0.95, 0.99);
    sh.lineTo(-1.1, 0.99);
    sh.lineTo(-2.2, 0.92);
    sh.lineTo(-2.2, 0.3);
    sh.closePath();
    add("core", extrudeSide(sh, 1.62, -0.81, false), { edges: false });
  }
  // 후드 / 루프 / 트렁크 (곡면 슬랩)
  add(
    "hood",
    extrudeSide(
      slab(
        [
          [2.24, 0.74],
          [0.96, 1.0],
        ],
        [1.65, 1.02],
        0.06,
      ),
      1.56,
      -0.78,
    ),
  );
  add(
    "roof",
    extrudeSide(
      slab(
        [
          [0.3, 1.43],
          [-1.15, 1.41],
        ],
        [-0.42, 1.5],
        0.06,
      ),
      1.46,
      -0.73,
    ),
  );
  add(
    "trunk",
    extrudeSide(
      slab(
        [
          [-1.62, 1.03],
          [-2.24, 0.93],
        ],
        [-1.95, 1.05],
        0.06,
      ),
      1.56,
      -0.78,
    ),
  );
  // 옆면 패널 (좌/우) — 펜더·도어·쿼터, 휠아치 포함
  const sides: [string, number][] = [
    ["L", -0.9],
    ["R", 0.82],
  ];
  for (const [sfx, x] of sides) {
    add(
      `fender_front_${sfx}`,
      extrudeSide(sidePanel(2.22, 0.96, 0.75, 1.0, [WHEEL_Z]), 0.08, x),
    );
    add(
      `door_front_${sfx}`,
      extrudeSide(sidePanel(0.94, -0.12, 1.0, 1.0, []), 0.08, x),
    );
    add(
      `door_rear_${sfx}`,
      extrudeSide(sidePanel(-0.14, -1.1, 1.0, 0.99, []), 0.08, x),
    );
    add(
      `fender_rear_${sfx}`,
      extrudeSide(sidePanel(-1.12, -2.22, 0.99, 0.92, [-WHEEL_Z]), 0.08, x),
    );
  }
  // 범퍼 (평면도 U자, 모서리 감쌈)
  add("bumper_front", extrudePlan(bumperPlan(true), 0.42, 0.22));
  add("bumper_rear", extrudePlan(bumperPlan(false), 0.42, 0.22));
  // 그릴·램프
  {
    const g = roundedBox(0.78, 0.2, 0.08, 0.04);
    g.translate(0, 0.82, 2.3);
    add("grille", g);
    for (const [sfx, x] of [
      ["L", -0.62],
      ["R", 0.62],
    ] as [string, number][]) {
      const h = roundedBox(0.44, 0.15, 0.1, 0.05);
      h.rotateY(sfx === "L" ? 0.22 : -0.22);
      h.translate(x * 0.94, 0.84, 2.17);
      add(`headlamp_${sfx}`, h);
      const t = roundedBox(0.42, 0.13, 0.08, 0.05);
      t.rotateY(sfx === "L" ? -0.2 : 0.2);
      t.translate(x * 0.94, 0.86, -2.19);
      add(`taillamp_${sfx}`, t);
    }
  }
  // 유리: 윈드실드·리어글라스(옆면 슬랩), 도어 글라스(옆면 사다리꼴)
  add(
    "windshield",
    extrudeSide(
      slab(
        [
          [0.94, 1.0],
          [0.32, 1.42],
        ],
        [0.6, 1.24],
        0.03,
      ),
      1.44,
      -0.72,
      false,
    ),
  );
  add(
    "rear_glass",
    extrudeSide(
      slab(
        [
          [-1.12, 1.41],
          [-1.6, 1.04],
        ],
        [-1.4, 1.26],
        0.03,
      ),
      1.44,
      -0.72,
      false,
    ),
  );
  for (const [sfx, x] of [
    ["L", -0.78],
    ["R", 0.76],
  ] as [string, number][]) {
    const wf = new THREE.Shape();
    wf.moveTo(0.9, 1.02);
    wf.lineTo(0.28, 1.4);
    wf.lineTo(-0.1, 1.4);
    wf.lineTo(-0.1, 1.02);
    wf.closePath();
    add(`win_front_${sfx}`, extrudeSide(wf, 0.02, x, false));
    const wr = new THREE.Shape();
    wr.moveTo(-0.16, 1.02);
    wr.lineTo(-0.16, 1.4);
    wr.lineTo(-1.1, 1.4);
    wr.lineTo(-1.5, 1.04);
    wr.closePath();
    add(`win_rear_${sfx}`, extrudeSide(wr, 0.02, x, false));
  }
  // 필러 (A/B/C 좌우 한 덩어리로)
  {
    const group = new THREE.Group();
    const pil = (len: number, tilt: number, y: number, z: number) => {
      const g = new THREE.BoxGeometry(0.05, 0.05, len);
      g.rotateX(tilt);
      return g.translate(0, y, z);
    };
    const geos: THREE.BufferGeometry[] = [];
    for (const x of [-0.76, 0.76]) {
      geos.push(pil(0.76, 0.6, 1.21, 0.63).translate(x, 0, 0));
      geos.push(
        new THREE.BoxGeometry(0.05, 0.42, 0.05).translate(x, 1.2, -0.13),
      );
      geos.push(pil(0.62, -0.66, 1.225, -1.36).translate(x, 0, 0));
    }
    // 여러 지오메트리를 하나로
    const merged = mergeGeos(geos);
    void group;
    add("pillars", merged, { edges: false });
  }
  // 디테일(손상 매칭 없음): 그릴 슬랫·하부 인테이크·번호판·도어 핸들·사이드실 트림
  {
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.7,
      metalness: 0.2,
    });
    const chrome = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.2,
      metalness: 0.9,
    });
    const plate = new THREE.MeshStandardMaterial({ color: 0xf8fafc });
    const addDeco = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      scene.add(m);
    };
    for (let i = 0; i < 4; i++)
      addDeco(
        new THREE.BoxGeometry(0.7, 0.012, 0.02).translate(
          0,
          0.76 + i * 0.04,
          2.35,
        ),
        chrome,
      );
    addDeco(
      roundedBox(1.0, 0.12, 0.06, 0.03).translate(0, 0.36, 2.37),
      trimMat,
    );
    addDeco(
      roundedBox(0.9, 0.1, 0.05, 0.02).translate(0, 0.36, -2.37),
      trimMat,
    );
    addDeco(
      new THREE.BoxGeometry(0.34, 0.09, 0.012).translate(0, 0.5, 2.39),
      plate,
    );
    addDeco(
      new THREE.BoxGeometry(0.34, 0.09, 0.012).translate(0, 0.62, -2.39),
      plate,
    );
    for (const x of [-0.93, 0.93]) {
      for (const z of [0.25, -0.75])
        addDeco(
          roundedBox(0.02, 0.03, 0.14, 0.01).translate(x, 0.86, z),
          chrome,
        );
      addDeco(
        new THREE.BoxGeometry(0.03, 0.05, 3.4).translate(x * 0.97, 0.29, 0),
        trimMat,
      );
    }
  }
  // 미러
  for (const [sfx, x] of [
    ["L", -1.0],
    ["R", 1.0],
  ] as [string, number][]) {
    const m = roundedBox(0.16, 0.09, 0.12, 0.03);
    m.translate(x, 1.1, 0.78);
    add(`mirror_${sfx}`, m);
  }
  // 휠
  for (const [x, z] of WHEELS) {
    const tire = new THREE.Mesh(
      new THREE.CylinderGeometry(WHEEL_Y, WHEEL_Y, 0.24, 36),
      new THREE.MeshStandardMaterial({ color: COLOR.wheel, roughness: 0.95 }),
    );
    tire.rotation.z = Math.PI / 2;
    tire.position.set(x, WHEEL_Y, z);
    tire.castShadow = true;
    scene.add(tire);
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.21, 0.21, 0.25, 24),
      new THREE.MeshStandardMaterial({
        color: COLOR.rim,
        roughness: 0.25,
        metalness: 0.7,
      }),
    );
    rim.rotation.z = Math.PI / 2;
    rim.position.set(x, WHEEL_Y, z);
    scene.add(rim);
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 0.27, 16),
      new THREE.MeshStandardMaterial({
        color: 0x64748b,
        roughness: 0.4,
        metalness: 0.6,
      }),
    );
    hub.rotation.z = Math.PI / 2;
    hub.position.set(x, WHEEL_Y, z);
    scene.add(hub);
    // 림 안쪽 어두운 면 + 스포크 5개
    const dark = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.19, 0.2, 24),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 }),
    );
    dark.rotation.z = Math.PI / 2;
    dark.position.set(x, WHEEL_Y, z);
    scene.add(dark);
    const spokeMat = new THREE.MeshStandardMaterial({
      color: COLOR.rim,
      roughness: 0.25,
      metalness: 0.7,
    });
    for (let i = 0; i < 5; i++) {
      const g = new THREE.BoxGeometry(0.035, 0.28, 0.05);
      g.translate(0, 0.13, 0); // 중심에서 바깥으로
      g.rotateX((i * Math.PI * 2) / 5); // 바퀴 면(Y-Z) 안에서 회전
      const sp = new THREE.Mesh(g, spokeMat);
      sp.position.set(x + (x > 0 ? 0.11 : -0.11), WHEEL_Y, z);
      scene.add(sp);
    }
  }
  return meshes;
}

// BufferGeometry 여러 개를 단순 합침 (같은 속성 구성일 때만 — 여기선 BoxGeometry끼리)
function mergeGeos(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  for (const g of geos) {
    const ng = g.toNonIndexed();
    positions.push(
      ...Array.from(ng.getAttribute("position").array as Float32Array),
    );
    normals.push(
      ...Array.from(ng.getAttribute("normal").array as Float32Array),
    );
    ng.dispose();
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  return out;
}

const WHEELS: [number, number][] = [
  [-0.86, WHEEL_Z],
  [0.86, WHEEL_Z],
  [-0.86, -WHEEL_Z],
  [0.86, -WHEEL_Z],
];

type ViewKey = "iso" | "front" | "rear" | "left" | "right" | "top";
const VIEWS: Record<ViewKey, { label: string; pos: [number, number, number] }> =
  {
    iso: { label: "기본", pos: [4.2, 3.0, 5.2] },
    front: { label: "전면", pos: [0, 1.6, 7.2] },
    rear: { label: "후면", pos: [0, 1.6, -7.2] },
    left: { label: "좌측", pos: [-7.2, 1.6, 0] },
    right: { label: "우측", pos: [7.2, 1.6, 0] },
    top: { label: "위", pos: [0, 9.6, 1.0] },
  };

function computeStatus(
  damagedParts: DamagedPartSummary[],
  hidden: SuspectedHiddenDamage[],
) {
  const status = new Map<string, ZoneStatus>();
  const unmatched: string[] = [];
  for (const p of damagedParts) {
    if (p.damage_type === "손상없음" || p.required_action === "작업 없음")
      continue;
    const ids = matchDiagramZones(p.part_name, p.side);
    if (!ids.length) unmatched.push(p.part_name);
    for (const id of ids) status.set(id, "confirmed");
  }
  for (const h of hidden) {
    const ids = matchDiagramZones(h.item, h.side);
    if (!ids.length) unmatched.push(h.item);
    for (const id of ids)
      if (status.get(id) !== "confirmed") status.set(id, "suspected");
  }
  return { status, unmatched };
}

export function Car3DDiagram({
  damagedParts,
  suspectedHiddenDamage,
}: {
  damagedParts: DamagedPartSummary[];
  suspectedHiddenDamage: SuspectedHiddenDamage[];
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    meshes: Map<string, THREE.Mesh>;
    target: THREE.Vector3;
  } | null>(null);
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);
  const [view, setView] = useState<ViewKey>("iso");

  const { status, unmatched } = computeStatus(
    damagedParts,
    suspectedHiddenDamage,
  );
  const statusKey = [...status.entries()]
    .map(([k, v]) => `${k}:${v}`)
    .sort()
    .join("|");

  // 장면 구성 (마운트 1회)
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(...VIEWS.iso.pos);
    const target = new THREE.Vector3(0, 0.7, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 4;
    controls.maxDistance = 14;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;

    // 스튜디오 환경광 — 도장 광택·유리 반사가 살아남 (파일 없이 절차적으로 생성)
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xffffff, 0xcbd5e1, 0.35));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(4, 7, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -4;
    key.shadow.camera.right = 4;
    key.shadow.camera.top = 4;
    key.shadow.camera.bottom = -4;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.3);
    fill.position.set(-5, 3, -4);
    scene.add(fill);

    // 바닥(그림자 받침)
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(4.2, 64),
      new THREE.ShadowMaterial({ opacity: 0.18 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0.0;
    ground.receiveShadow = true;
    scene.add(ground);
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(4.2, 64),
      new THREE.MeshBasicMaterial({ color: 0xf8fafc }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = -0.005;
    scene.add(disc);

    const edgeMat = new THREE.LineBasicMaterial({
      color: COLOR.edge,
      transparent: true,
      opacity: 0.3,
    });
    const meshes = buildCar(scene, edgeMat);

    sceneRef.current = { camera, controls, meshes, target };

    // 호버 라벨
    const ray = new THREE.Raycaster();
    const ptr = new THREE.Vector2();
    let hovered: string | null = null;
    const onMove = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      ptr.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -((e.clientY - r.top) / r.height) * 2 + 1,
      );
      ray.setFromCamera(ptr, camera);
      const hit = ray.intersectObjects([...meshes.values()], false)[0];
      const label = hit ? (hit.object.userData.label as string) : null;
      if (label !== hovered) {
        hovered = label;
        setHoverLabel(label);
      }
    };
    const onLeave = () => {
      hovered = null;
      setHoverLabel(null);
    };
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerleave", onLeave);

    const resize = () => {
      const w = mount.clientWidth;
      const h = Math.max(240, Math.round(w * 0.62));
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = `${h}px`;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    let raf = 0;
    const loop = () => {
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerleave", onLeave);
      controls.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
          o.geometry.dispose();
          const m = o.material as THREE.Material | THREE.Material[];
          (Array.isArray(m) ? m : [m]).forEach((mm) => mm.dispose());
        }
      });
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, []);

  // 손상 상태 → 패널 색
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    for (const [id, meta] of Object.entries(PARTS)) {
      const mesh = s.meshes.get(id);
      if (!mesh || meta.glass) continue;
      const mat = mesh.material as THREE.MeshPhysicalMaterial;
      const st = meta.zone ? status.get(id) : undefined;
      const base = meta.color ?? COLOR.body;
      mat.color.setHex(
        st === "confirmed"
          ? COLOR.confirmed
          : st === "suspected"
            ? COLOR.suspected
            : base,
      );
      mat.emissive.setHex(
        st === "confirmed"
          ? 0x7f1d1d
          : st === "suspected"
            ? 0x78350f
            : 0x000000,
      );
      mat.emissiveIntensity = st ? 0.35 : 0;
      mat.needsUpdate = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusKey]);

  function goView(k: ViewKey) {
    setView(k);
    const s = sceneRef.current;
    if (!s) return;
    // 부드럽게 이동
    const from = s.camera.position.clone();
    const to = new THREE.Vector3(...VIEWS[k].pos);
    let start: number | null = null;
    const dur = 420;
    const step = (t: number) => {
      if (start === null) start = t;
      const u = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - u, 3);
      s.camera.position.lerpVectors(from, to, e);
      s.controls.update();
      if (u < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  const hoveredId = hoverLabel
    ? Object.entries(PARTS).find(([, m]) => m.label === hoverLabel)?.[0]
    : undefined;
  const hoveredStatus =
    hoveredId && PARTS[hoveredId].zone ? status.get(hoveredId) : undefined;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {(Object.keys(VIEWS) as ViewKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => goView(k)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-all active:scale-95 ${
                view === k
                  ? "bg-slate-900 text-white shadow-[0_4px_10px_-4px_rgba(15,23,42,0.6)]"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {VIEWS[k].label}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-slate-400">
          드래그로 회전 · 휠로 확대
        </span>
      </div>

      <div
        ref={mountRef}
        className="relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-100 shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)]"
      >
        {hoverLabel && (
          <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-slate-900/85 px-2.5 py-1.5 text-[11px] font-bold text-white shadow backdrop-blur">
            {hoverLabel}
            {hoveredStatus === "confirmed" && (
              <span className="ml-1.5 text-red-300">확인된 손상</span>
            )}
            {hoveredStatus === "suspected" && (
              <span className="ml-1.5 text-amber-300">정밀점검(추정)</span>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] font-medium text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-red-400" /> 확인된 손상
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" /> 정밀점검
          필요(추정)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border border-slate-300 bg-slate-100" />{" "}
          이상 없음
        </span>
      </div>

      {unmatched.length > 0 && (
        <p className="text-center text-[11px] text-slate-400">
          도해에 표시되지 않은 항목: {unmatched.join(", ")}
        </p>
      )}
    </div>
  );
}
