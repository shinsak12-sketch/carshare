"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
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
  body: 0xe2e8f0,
  bodyDark: 0xcbd5e1,
  confirmed: 0xf87171,
  suspected: 0xfbbf24,
  glass: 0x93c5fd,
  wheel: 0x1e293b,
  rim: 0x94a3b8,
  edge: 0x475569,
  lamp: 0xf8fafc,
  tail: 0xfca5a5,
};

interface PanelSpec {
  id: string; // zone id 또는 장식용 이름
  label: string;
  size: [number, number, number];
  pos: [number, number, number];
  rot?: [number, number, number];
  color?: number;
  glass?: boolean;
  zone?: boolean; // 손상 매칭 대상인지
}

// 좌표계: X = 좌(-)/우(+), Y = 높이, Z = 앞(+)/뒤(-). 단위는 대략 m.
const PANELS: PanelSpec[] = [
  // 하부 차체
  {
    id: "floor",
    label: "하부",
    size: [1.78, 0.32, 4.55],
    pos: [0, 0.5, 0],
    color: COLOR.bodyDark,
  },
  {
    id: "rocker_L",
    label: "사이드실(좌)",
    size: [0.06, 0.18, 2.5],
    pos: [-0.9, 0.42, -0.2],
    color: COLOR.bodyDark,
  },
  {
    id: "rocker_R",
    label: "사이드실(우)",
    size: [0.06, 0.18, 2.5],
    pos: [0.9, 0.42, -0.2],
    color: COLOR.bodyDark,
  },
  // 앞부분
  {
    id: "bumper_front",
    label: "프론트범퍼",
    size: [1.86, 0.42, 0.3],
    pos: [0, 0.5, 2.33],
    zone: true,
  },
  {
    id: "grille",
    label: "라디에이터그릴",
    size: [0.8, 0.22, 0.08],
    pos: [0, 0.8, 2.36],
    color: 0x334155,
    zone: true,
  },
  {
    id: "headlamp_L",
    label: "헤드램프(좌)",
    size: [0.5, 0.18, 0.12],
    pos: [-0.62, 0.84, 2.36],
    color: COLOR.lamp,
    zone: true,
  },
  {
    id: "headlamp_R",
    label: "헤드램프(우)",
    size: [0.5, 0.18, 0.12],
    pos: [0.62, 0.84, 2.36],
    color: COLOR.lamp,
    zone: true,
  },
  {
    id: "hood",
    label: "후드",
    size: [1.62, 0.07, 1.35],
    pos: [0, 0.95, 1.55],
    rot: [0.06, 0, 0],
    zone: true,
  },
  {
    id: "fender_front_L",
    label: "프론트펜더(좌)",
    size: [0.1, 0.5, 1.35],
    pos: [-0.88, 0.75, 1.55],
    zone: true,
  },
  {
    id: "fender_front_R",
    label: "프론트펜더(우)",
    size: [0.1, 0.5, 1.35],
    pos: [0.88, 0.75, 1.55],
    zone: true,
  },
  // 도어
  {
    id: "door_front_L",
    label: "프론트도어(좌)",
    size: [0.09, 0.62, 1.08],
    pos: [-0.9, 0.78, 0.33],
    zone: true,
  },
  {
    id: "door_front_R",
    label: "프론트도어(우)",
    size: [0.09, 0.62, 1.08],
    pos: [0.9, 0.78, 0.33],
    zone: true,
  },
  {
    id: "door_rear_L",
    label: "리어도어(좌)",
    size: [0.09, 0.62, 1.0],
    pos: [-0.9, 0.78, -0.73],
    zone: true,
  },
  {
    id: "door_rear_R",
    label: "리어도어(우)",
    size: [0.09, 0.62, 1.0],
    pos: [0.9, 0.78, -0.73],
    zone: true,
  },
  // 뒷부분
  {
    id: "fender_rear_L",
    label: "리어펜더(좌)",
    size: [0.1, 0.55, 1.15],
    pos: [-0.88, 0.78, -1.78],
    zone: true,
  },
  {
    id: "fender_rear_R",
    label: "리어펜더(우)",
    size: [0.1, 0.55, 1.15],
    pos: [0.88, 0.78, -1.78],
    zone: true,
  },
  {
    id: "trunk",
    label: "트렁크",
    size: [1.62, 0.07, 0.95],
    pos: [0, 0.98, -1.85],
    rot: [-0.05, 0, 0],
    zone: true,
  },
  {
    id: "taillamp_L",
    label: "리어콤비네이션램프(좌)",
    size: [0.48, 0.16, 0.1],
    pos: [-0.62, 0.86, -2.36],
    color: COLOR.tail,
    zone: true,
  },
  {
    id: "taillamp_R",
    label: "리어콤비네이션램프(우)",
    size: [0.48, 0.16, 0.1],
    pos: [0.62, 0.86, -2.36],
    color: COLOR.tail,
    zone: true,
  },
  {
    id: "bumper_rear",
    label: "리어범퍼",
    size: [1.86, 0.42, 0.3],
    pos: [0, 0.5, -2.33],
    zone: true,
  },
  // 캐빈
  {
    id: "roof",
    label: "루프",
    size: [1.5, 0.07, 1.9],
    pos: [0, 1.47, -0.25],
    zone: true,
  },
  {
    id: "windshield",
    label: "윈드실드",
    size: [1.5, 0.05, 0.9],
    pos: [0, 1.22, 0.98],
    rot: [-0.62, 0, 0],
    glass: true,
  },
  {
    id: "rear_glass",
    label: "리어글라스",
    size: [1.5, 0.05, 0.78],
    pos: [0, 1.24, -1.48],
    rot: [0.66, 0, 0],
    glass: true,
  },
  {
    id: "win_L",
    label: "사이드글라스(좌)",
    size: [0.04, 0.4, 2.0],
    pos: [-0.76, 1.24, -0.2],
    glass: true,
  },
  {
    id: "win_R",
    label: "사이드글라스(우)",
    size: [0.04, 0.4, 2.0],
    pos: [0.76, 1.24, -0.2],
    glass: true,
  },
  {
    id: "pillar_A_L",
    label: "A필러(좌)",
    size: [0.06, 0.06, 0.95],
    pos: [-0.76, 1.22, 0.98],
    rot: [-0.62, 0, 0],
  },
  {
    id: "pillar_A_R",
    label: "A필러(우)",
    size: [0.06, 0.06, 0.95],
    pos: [0.76, 1.22, 0.98],
    rot: [-0.62, 0, 0],
  },
  {
    id: "pillar_B_L",
    label: "B필러(좌)",
    size: [0.06, 0.42, 0.06],
    pos: [-0.77, 1.24, -0.2],
  },
  {
    id: "pillar_B_R",
    label: "B필러(우)",
    size: [0.06, 0.42, 0.06],
    pos: [0.77, 1.24, -0.2],
  },
  {
    id: "pillar_C_L",
    label: "C필러(좌)",
    size: [0.06, 0.06, 0.82],
    pos: [-0.76, 1.24, -1.48],
    rot: [0.66, 0, 0],
  },
  {
    id: "pillar_C_R",
    label: "C필러(우)",
    size: [0.06, 0.06, 0.82],
    pos: [0.76, 1.24, -1.48],
    rot: [0.66, 0, 0],
  },
  {
    id: "mirror_L",
    label: "사이드미러(좌)",
    size: [0.18, 0.1, 0.12],
    pos: [-1.02, 1.08, 0.78],
    color: COLOR.bodyDark,
  },
  {
    id: "mirror_R",
    label: "사이드미러(우)",
    size: [0.18, 0.1, 0.12],
    pos: [1.02, 1.08, 0.78],
    color: COLOR.bodyDark,
  },
];

const WHEELS: [number, number][] = [
  [-0.86, 1.5],
  [0.86, 1.5],
  [-0.86, -1.5],
  [0.86, -1.5],
];

type ViewKey = "iso" | "front" | "rear" | "left" | "right" | "top";
const VIEWS: Record<ViewKey, { label: string; pos: [number, number, number] }> =
  {
    iso: { label: "기본", pos: [4.2, 3.0, 5.2] },
    front: { label: "전면", pos: [0, 1.6, 7.2] },
    rear: { label: "후면", pos: [0, 1.6, -7.2] },
    left: { label: "좌측", pos: [-7.2, 1.6, 0] },
    right: { label: "우측", pos: [7.2, 1.6, 0] },
    top: { label: "위", pos: [0.01, 8.0, 0.01] },
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
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 4;
    controls.maxDistance = 12;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;

    scene.add(new THREE.HemisphereLight(0xffffff, 0xcbd5e1, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(4, 7, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -4;
    key.shadow.camera.right = 4;
    key.shadow.camera.top = 4;
    key.shadow.camera.bottom = -4;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.5);
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
      new THREE.MeshBasicMaterial({ color: 0xf1f5f9 }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = -0.005;
    scene.add(disc);

    const meshes = new Map<string, THREE.Mesh>();
    const edgeMat = new THREE.LineBasicMaterial({
      color: COLOR.edge,
      transparent: true,
      opacity: 0.35,
    });
    for (const p of PANELS) {
      const geo = new THREE.BoxGeometry(...p.size);
      const mat = p.glass
        ? new THREE.MeshPhysicalMaterial({
            color: COLOR.glass,
            transparent: true,
            opacity: 0.55,
            roughness: 0.1,
            metalness: 0.1,
          })
        : new THREE.MeshStandardMaterial({
            color: p.color ?? COLOR.body,
            roughness: 0.55,
            metalness: 0.15,
          });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...p.pos);
      if (p.rot) mesh.rotation.set(...p.rot);
      mesh.castShadow = !p.glass;
      mesh.receiveShadow = true;
      mesh.userData = { id: p.id, label: p.label, zone: !!p.zone };
      if (!p.glass)
        mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat));
      scene.add(mesh);
      meshes.set(p.id, mesh);
    }
    for (const [x, z] of WHEELS) {
      const tire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.34, 0.34, 0.24, 28),
        new THREE.MeshStandardMaterial({ color: COLOR.wheel, roughness: 0.9 }),
      );
      tire.rotation.z = Math.PI / 2;
      tire.position.set(x, 0.34, z);
      tire.castShadow = true;
      scene.add(tire);
      const rim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 0.26, 20),
        new THREE.MeshStandardMaterial({
          color: COLOR.rim,
          roughness: 0.3,
          metalness: 0.6,
        }),
      );
      rim.rotation.z = Math.PI / 2;
      rim.position.set(x, 0.34, z);
      scene.add(rim);
    }

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
    for (const p of PANELS) {
      const mesh = s.meshes.get(p.id);
      if (!mesh || p.glass) continue;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      const st = p.zone ? status.get(p.id) : undefined;
      const base = p.color ?? COLOR.body;
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
      mat.emissiveIntensity = st ? 0.25 : 0;
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

  const hoveredStatus = hoverLabel
    ? PANELS.find((p) => p.label === hoverLabel && p.zone)
      ? status.get(PANELS.find((p) => p.label === hoverLabel)!.id)
      : undefined
    : undefined;

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
