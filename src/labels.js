import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// CSS2D 라벨 생성. 한글은 브라우저 폰트가 그대로 처리하므로 텍스처 방식보다 선명하다.
export function makeLabel(text, className, { color = null, offset = null } = {}) {
  const el = document.createElement('div');
  el.className = className;
  el.textContent = text;
  if (color) el.style.color = color;

  const obj = new CSS2DObject(el);
  if (offset) obj.position.set(...offset);
  return obj;
}
