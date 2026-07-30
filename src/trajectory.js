import * as THREE from 'three';
import { TRAJECTORY } from './config.js';
import { positionOf } from './axes.js';
import { makeLabel } from './labels.js';

// 같은 party_key의 연도별 이동을 화살표로 잇는다 — 명세 13.3절.
// 정적 스냅숏에서는 완전히 사라지는 정보이며, 이 앱의 존재 이유에 가장 가깝다.

// party_key로 묶고 연도 오름차순 정렬. 레코드가 하나뿐인 정당은 궤적이 없다.
export function groupTrajectories(parties) {
  const byKey = new Map();
  for (const rec of parties) {
    if (!byKey.has(rec.party_key)) byKey.set(rec.party_key, []);
    byKey.get(rec.party_key).push(rec);
  }

  const out = new Map();
  for (const [key, recs] of byKey) {
    if (recs.length < 2) continue;
    out.set(key, [...recs].sort((a, b) => a.year - b.year));
  }
  return out;
}

// label_short에 이미 "'10" 같은 연도 축약이 붙은 레코드가 있다. 그대로 두고 연도를
// 덧붙이면 "Fidesz '10 · 2010"이 되므로, 축약을 떼고 네 자리 연도로 통일한다.
function endpointLabelText(rec) {
  const base = rec.label_short.replace(/\s*['’]\d{2}\s*$/, '');
  return `${base} ${rec.year}`;
}

// (0,1,0) 기준 기하를 두 점 사이 방향으로 눕힌다.
function orient(mesh, from, to) {
  const dir = new THREE.Vector3().subVectors(to, from).normalize();
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
}

function buildArrow(from, to, material) {
  const g = new THREE.Group();
  const full = new THREE.Vector3().subVectors(to, from);
  const len = full.length();

  // 점 표면에서 시작·종료시킨다. 두 점이 너무 가까우면 화살표를 생략한다.
  const usable = len - TRAJECTORY.endGap * 2;
  if (usable <= TRAJECTORY.headLength * 1.2) return null;

  const dir = full.clone().normalize();
  const start = from.clone().addScaledVector(dir, TRAJECTORY.endGap);
  const end = to.clone().addScaledVector(dir, -TRAJECTORY.endGap);

  const shaftLen = usable - TRAJECTORY.headLength;
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(TRAJECTORY.shaftRadius, TRAJECTORY.shaftRadius, shaftLen, 8),
    material,
  );
  shaft.position.copy(start).addScaledVector(dir, shaftLen / 2);
  orient(shaft, start, end);
  g.add(shaft);

  const head = new THREE.Mesh(
    new THREE.ConeGeometry(TRAJECTORY.headRadius, TRAJECTORY.headLength, 12),
    material,
  );
  head.position.copy(end).addScaledVector(dir, -TRAJECTORY.headLength / 2);
  orient(head, start, end);
  g.add(head);

  return g;
}

export function buildTrajectories(scene, parties, items) {
  const trajs = groupTrajectories(parties);
  const byId = new Map(items.map((i) => [i.rec.id, i]));

  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: TRAJECTORY.color,
    transparent: true,
    opacity: TRAJECTORY.opacity,
    roughness: TRAJECTORY.roughness,
    metalness: TRAJECTORY.metalness,
  });

  // key -> { recs, arrows[], labels[] }
  const built = new Map();

  for (const [key, recs] of trajs) {
    const arrows = [];
    for (let i = 0; i < recs.length - 1; i++) {
      const a = buildArrow(positionOf(recs[i]), positionOf(recs[i + 1]), material);
      if (a) {
        group.add(a);
        arrows.push(a);
      }
    }

    // 양 끝점은 라벨을 유지한다 — 상시 라벨 금지 규칙의 명시적 예외(명세 13.3절).
    // 호버·선택 라벨은 점 위쪽에 붙으므로 궤적 라벨은 아래쪽에 두어 겹치지 않게 한다.
    const labels = [];
    for (const rec of [recs[0], recs[recs.length - 1]]) {
      const item = byId.get(rec.id);
      if (!item) continue;
      const lab = makeLabel(endpointLabelText(rec), 'traj-label');
      lab.position.set(0, -TRAJECTORY.endGap * 2.1, 0);
      item.mesh.add(lab);
      labels.push({ lab, item });
    }

    built.set(key, { recs, arrows, labels });
  }

  scene.add(group);

  let visible = TRAJECTORY.defaultVisible;

  function apply() {
    group.visible = visible;
    for (const { arrows, labels } of built.values()) {
      // 궤적의 어느 끝점이라도 필터에 걸러지면 화살표째 숨긴다 —
      // 점이 숨겨진 채 화살표만 허공에 남는 것을 막는다
      const allMatched = labels.length > 0 && labels.every(({ item }) => item.matched);
      for (const a of arrows) a.visible = allMatched;
      for (const { lab } of labels) lab.visible = visible && allMatched;
    }
  }

  apply();

  return {
    group,
    keys: new Set(built.keys()),
    trajectories: trajs,
    count: built.size,
    setVisible(v) {
      visible = v;
      apply();
    },
    isVisible: () => visible,
    // 필터가 바뀌면 끝점 라벨 표시도 따라가야 한다
    syncFilter: apply,
    recordsOf: (key) => trajs.get(key) ?? null,
  };
}
