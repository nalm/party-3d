import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { SPACE, CAMERA, CONTROLS } from './config.js';

// 씬 · 카메라 · 렌더러 · 컨트롤을 조립하고 프레임 루프를 돌린다.
// 라벨은 CSS2DRenderer로 처리한다. 텍스처·SDF 방식은 한글 글리프 때문에 번거롭다 — CLAUDE.md「기술 주의사항」.
export function createScene(viewEl, labelEl) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SPACE.bgColor);

  // 창 전체가 아니라 뷰 컨테이너 크기를 쓴다. 사이드바·패널이 창을 잠식하므로
  // window.innerWidth로 재면 큐브 중심이 화면 중앙에서 어긋난다.
  const size = () => ({
    w: viewEl.clientWidth || 1,
    h: viewEl.clientHeight || 1,
  });

  const camera = new THREE.PerspectiveCamera(
    CAMERA.fov,
    size().w / size().h,
    CAMERA.near,
    CAMERA.far,
  );

  // 큐브 외접구가 화면에 다 들어오는 거리. fov는 수직 기준이므로 창이 좁으면
  // 수평 화각이 더 작다. 둘 중 작은 쪽으로 맞춰야 잘리지 않는다.
  function fitDistance() {
    const radius = SPACE.half * Math.sqrt(3) * CAMERA.fitMargin;
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    return radius / Math.sin(Math.min(vFov, hFov) / 2);
  }

  // 방향을 유지하며 프레이밍 거리에 놓는다. 프리셋 전환도 이 함수를 쓴다.
  function frame(dir) {
    const d = new THREE.Vector3(...dir).normalize().multiplyScalar(fitDistance());
    camera.position.copy(d);
    camera.lookAt(0, 0, 0);
  }

  frame(CAMERA.initialDir);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(size().w, size().h);
  viewEl.appendChild(renderer.domElement);

  const labelRenderer = new CSS2DRenderer({ element: labelEl });
  labelRenderer.setSize(size().w, size().h);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = CONTROLS.damping;
  controls.minDistance = CONTROLS.minDistance;
  controls.maxDistance = fitDistance() * CONTROLS.maxDistanceFactor;
  controls.target.set(0, 0, 0);

  // 점을 "광택 있는 입체"로 읽히게 하려면 광원이 필요하다. 축 라인은 불투명
  // LineBasicMaterial이라 조명에 반응하지 않으므로 재질 대비가 그대로 유지된다.
  scene.add(new THREE.AmbientLight(0xffffff, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(1, 1.4, 1).multiplyScalar(SPACE.half * 3);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x93b4ff, 0.55);
  fill.position.set(-1, -0.6, -0.8).multiplyScalar(SPACE.half * 3);
  scene.add(fill);

  function resize() {
    const { w, h } = size();
    const prevFit = fitDistance();

    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    labelRenderer.setSize(w, h);

    // 종횡비가 바뀌면 필요한 프레이밍 거리도 바뀐다. 사용자의 줌 배율은
    // 유지하면서 프레이밍만 따라가게 같은 비율로 거리를 조정한다.
    const nextFit = fitDistance();
    const ratio = nextFit / prevFit;
    if (Number.isFinite(ratio) && ratio > 0) {
      const offset = camera.position.clone().sub(controls.target);
      camera.position.copy(controls.target).add(offset.multiplyScalar(ratio));
    }
    controls.maxDistance = nextFit * CONTROLS.maxDistanceFactor;
  }

  // 창 리사이즈뿐 아니라 사이드바 스크롤바 출현 등으로 컨테이너만 바뀌는 경우도
  // 잡아야 하므로 ResizeObserver로 컨테이너를 직접 관찰한다.
  new ResizeObserver(resize).observe(viewEl);

  const frameHooks = [];
  function onFrame(fn) {
    frameHooks.push(fn);
  }

  // ── 프리셋 전환 트윈 ──
  // 방향은 구면에서 보간하고 거리는 따로 섞는다. 위치를 직선 보간하면 카메라가
  // 원점 쪽으로 파고들며 화면이 뒤집힌다.
  let tween = null;

  function flyTo(dir, ms = CAMERA.tweenMs) {
    const from = camera.position.clone().sub(controls.target);
    const to = new THREE.Vector3(...dir).normalize().multiplyScalar(fitDistance());
    tween = {
      fromDir: from.clone().normalize(),
      toDir: to.clone().normalize(),
      fromLen: from.length(),
      toLen: to.length(),
      t0: performance.now(),
      ms,
    };
  }

  function stepTween() {
    if (!tween) return;
    const k = Math.min(1, (performance.now() - tween.t0) / tween.ms);
    const e = k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k); // easeInOutQuad

    const qFull = new THREE.Quaternion().setFromUnitVectors(tween.fromDir, tween.toDir);
    const qPart = new THREE.Quaternion().slerpQuaternions(new THREE.Quaternion(), qFull, e);
    const dir = tween.fromDir.clone().applyQuaternion(qPart);
    const len = THREE.MathUtils.lerp(tween.fromLen, tween.toLen, e);

    camera.position.copy(controls.target).addScaledVector(dir, len);
    if (k >= 1) tween = null;
  }

  // 사용자가 직접 돌리기 시작하면 트윈을 포기한다. 안 그러면 조작과 싸운다.
  controls.addEventListener('start', () => {
    tween = null;
  });

  function tick() {
    stepTween();
    controls.update();
    for (const fn of frameHooks) fn(camera);
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }

  function start() {
    renderer.setAnimationLoop(tick);
  }

  return {
    scene, camera, renderer, labelRenderer, controls,
    onFrame, start, tick, frame, flyTo, fitDistance, resize,
    isTweening: () => tween !== null,
  };
}
