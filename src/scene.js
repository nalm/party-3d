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
  camera.position.set(...CAMERA.initial);

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
  controls.maxDistance = CONTROLS.maxDistance;
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
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    labelRenderer.setSize(w, h);
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

  return { scene, camera, renderer, labelRenderer, controls, onFrame, start };
}
