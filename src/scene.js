import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { SPACE, CAMERA, CONTROLS } from './config.js';

// 씬 · 카메라 · 렌더러 · 컨트롤을 조립하고 프레임 루프를 돌린다.
// 라벨은 CSS2DRenderer로 처리한다. 텍스처·SDF 방식은 한글 글리프 때문에 번거롭다 — CLAUDE.md「기술 주의사항」.
export function createScene(viewEl, labelEl) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SPACE.bgColor);

  const camera = new THREE.PerspectiveCamera(
    CAMERA.fov,
    window.innerWidth / window.innerHeight,
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
  renderer.setSize(window.innerWidth, window.innerHeight);
  viewEl.appendChild(renderer.domElement);

  const labelRenderer = new CSS2DRenderer({ element: labelEl });
  labelRenderer.setSize(window.innerWidth, window.innerHeight);

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
    const w = window.innerWidth;
    const h = window.innerHeight;
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
  window.addEventListener('resize', resize);

  const frameHooks = [];
  function onFrame(fn) {
    frameHooks.push(fn);
  }

  function start() {
    renderer.setAnimationLoop(() => {
      controls.update();
      for (const fn of frameHooks) fn(camera);
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    });
  }

  return { scene, camera, renderer, labelRenderer, controls, onFrame, start, frame, fitDistance, resize };
}
