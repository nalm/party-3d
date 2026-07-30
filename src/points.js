import * as THREE from 'three';
import { NORMS_BANDS, POINT, ESTIMATED, DROPLINE, FILTER, COUNTRY_TAG, bandOf } from './config.js';
import { makeLabel } from './labels.js';
import { positionOf, FLOOR_Y } from './axes.js';

// 정당 점 · 드롭라인 · 규범 구간 인코딩.
// 색만으로 범주를 구분하지 않는다. 구간마다 색과 도형을 함께 바꾼다 — CLAUDE.md 절대규칙 6.

const R = POINT.radius;

// 도형별 기하. 눈에 보이는 크기를 비슷하게 맞추려면 외접원 반지름을 보정해야 한다.
const GEO_CACHE = {};
function shapeGeometry(shape) {
  if (GEO_CACHE[shape]) return GEO_CACHE[shape];
  let g;
  if (shape === 'sphere') g = new THREE.SphereGeometry(R, POINT.sphereSegments, POINT.sphereSegments);
  else if (shape === 'octahedron') g = new THREE.OctahedronGeometry(R * 1.28);
  else g = new THREE.TetrahedronGeometry(R * 1.5);
  GEO_CACHE[shape] = g;
  return g;
}

// 추정치 표시용 케이지. 도형별로 같은 실루엣을 유지하되 성분을 적게 둔다.
const SHELL_CACHE = {};
function shellGeometry(shape) {
  if (SHELL_CACHE[shape]) return SHELL_CACHE[shape];
  const s = 1.18;
  let g;
  if (shape === 'sphere') g = new THREE.IcosahedronGeometry(R * s, 1);
  else if (shape === 'octahedron') g = new THREE.OctahedronGeometry(R * 1.28 * s);
  else g = new THREE.TetrahedronGeometry(R * 1.5 * s);
  SHELL_CACHE[shape] = g;
  return g;
}

function isEstimated(rec) {
  return rec.econ.estimated || rec.cultural.estimated || rec.norms.estimated;
}

function buildDropLine(pos) {
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(pos.x, pos.y, pos.z),
    new THREE.Vector3(pos.x, FLOOR_Y, pos.z),
  ]);
  return new THREE.Line(
    geo,
    new THREE.LineBasicMaterial({
      color: DROPLINE.color,
      transparent: true,
      opacity: DROPLINE.opacity,
    }),
  );
}

export function buildPoints(scene, parties) {
  const group = new THREE.Group();
  const items = [];

  for (const rec of parties) {
    const pos = positionOf(rec);
    const band = bandOf(rec.norms.v);
    const meta = NORMS_BANDS.meta[band];
    const estimated = isEstimated(rec);

    const material = new THREE.MeshStandardMaterial({
      color: meta.colorHex,
      roughness: POINT.roughness,
      metalness: POINT.metalness,
      transparent: estimated,
      opacity: estimated ? ESTIMATED.opacity : 1,
    });

    const mesh = new THREE.Mesh(shapeGeometry(meta.shape), material);
    mesh.position.copy(pos);
    // 레이캐스팅으로 되짚을 수 있게 원본 레코드를 붙여 둔다 (3단계 선택 기능).
    mesh.userData.record = rec;
    group.add(mesh);

    let shell = null;
    if (estimated) {
      shell = new THREE.Mesh(
        shellGeometry(meta.shape),
        new THREE.MeshBasicMaterial({
          color: ESTIMATED.outlineColor,
          wireframe: true,
          transparent: true,
          opacity: ESTIMATED.outlineOpacity * 0.6,
          depthWrite: false,
        }),
      );
      shell.position.copy(pos);
      shell.raycast = () => {}; // 케이지가 클릭을 가로채지 않게 한다
      group.add(shell);
    }

    const dropline = buildDropLine(pos);
    group.add(dropline);

    // 국가 코드 태그. 래퍼는 크기 0이고 안쪽 span만 화면 오른쪽으로 밀어낸다 —
    // CSS2DRenderer가 래퍼의 transform을 덮어쓰므로 래퍼 자체는 옮길 수 없다.
    // 카메라를 돌려도 항상 점의 화면 오른쪽에 붙는다.
    const tag = makeLabel('', 'country-tag');
    tag.element.append(
      Object.assign(document.createElement('span'), { textContent: rec.country }),
    );
    mesh.add(tag);

    items.push({
      rec, mesh, shell, dropline, band, tag,
      baseOpacity: estimated ? ESTIMATED.opacity : 1,
      matched: true,
    });
  }

  scene.add(group);

  // 절단점이 바뀌면 색과 도형을 즉시 갱신한다 (4단계 슬라이더).
  function applyBands() {
    for (const item of items) {
      const band = bandOf(item.rec.norms.v);
      if (band === item.band) continue;
      const meta = NORMS_BANDS.meta[band];
      item.mesh.geometry = shapeGeometry(meta.shape);
      item.mesh.material.color.setHex(meta.colorHex);
      if (item.shell) item.shell.geometry = shellGeometry(meta.shape);
      item.band = band;
    }
  }

  // 필터 적용. hide=false면 걸러진 점을 흐리게 남긴다 (config.FILTER 주석 참조).
  // 드롭라인과 추정치 케이지는 어느 모드에서든 매칭된 점만 유지한다.
  function applyFilter(matchFn, hide) {
    let shown = 0;
    for (const item of items) {
      const on = !!matchFn(item.rec);
      item.matched = on;
      if (on) shown++;

      const mat = item.mesh.material;
      item.mesh.visible = hide ? on : true;
      mat.opacity = on ? item.baseOpacity : FILTER.dimOpacity;
      mat.transparent = mat.opacity < 1;
      // 반투명 점이 서로를 가리며 정렬 artifact를 만드는 것을 줄인다
      mat.depthWrite = on;

      item.dropline.visible = on;
      if (item.shell) item.shell.visible = on;
      // CSS2DRenderer가 부모의 visible을 항상 존중하지는 않으므로 직접 끈다
      item.tag.visible = on;
    }
    return shown;
  }

  return { group, items, applyBands, applyFilter };
}
