import { UI, CAMERA, NORMS_BANDS, TRAJECTORY, COUNTRY_TAG } from './config.js';

// 카메라 프리셋 · 규범 구간 절단점 슬라이더 · 리셋.
// 절단점은 명세의 제안값일 뿐이므로 UI에서 조절 가능해야 한다 — CLAUDE.md「구간 절단점은 하드코딩 금지」.

const MIN_GAP = 0.02; // 두 절단점이 겹치면 '경계' 구간이 사라진다

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = String(text);
  return n;
}

// 2D/3D 전환 · 전체 라벨 토글 · PNG 내보내기. 사이드바 맨 위에 둔다.
export function createViewUI(host, {
  onMode, onLabels, onTicks, onCountry, onNames, onExport, initialMode = '3d',
}) {
  host.append(el('h2', null, UI.secView));

  const seg = el('div', 'seg');
  const b3 = el('button', 'preset-mode', UI.view3d);
  const b2 = el('button', 'preset-mode', UI.view2d);
  seg.append(b3, b2);
  host.append(seg);

  const note = el('p', 'hint');

  // 축 눈금 숫자. 기본 숨김 — 3D·2D 공통이며 PNG에는 항상 포함된다.
  const ticksWrap = el('label', 'chk');
  const ticksInput = el('input');
  ticksInput.type = 'checkbox';
  ticksInput.checked = false;
  ticksInput.addEventListener('change', () => onTicks?.(ticksInput.checked));
  ticksWrap.append(ticksInput, el('span', null, UI.showTicks));
  const ticksNote = el('p', 'hint', UI.showTicksNote);

  // 국가 코드. 기본 켬 — 3D·2D 공통이며 PNG에는 해독 키와 함께 항상 포함된다.
  const countryWrap = el('label', 'chk');
  const countryInput = el('input');
  countryInput.type = 'checkbox';
  countryInput.checked = COUNTRY_TAG.defaultVisible;
  countryInput.addEventListener('change', () => onCountry?.(countryInput.checked));
  countryWrap.append(countryInput, el('span', null, UI.showCountry));
  const countryNote = el('p', 'hint', UI.showCountryNote);

  // 상시 정당명. 3D는 겹치는 이름을 프레임마다 컬링한다.
  const namesWrap = el('label', 'chk');
  const namesInput = el('input');
  namesInput.type = 'checkbox';
  namesInput.checked = true;
  namesInput.addEventListener('change', () => onNames?.(namesInput.checked));
  namesWrap.append(namesInput, el('span', null, UI.showPartyNames));
  const namesNote = el('p', 'hint', UI.showPartyNamesNote);
  const namesCount = el('p', 'hint');
  const labelsWrap = el('label', 'chk');
  const labelsInput = el('input');
  labelsInput.type = 'checkbox';
  labelsInput.checked = true;
  labelsInput.addEventListener('change', () => onLabels?.(labelsInput.checked));
  labelsWrap.append(labelsInput, el('span', null, UI.view2dLabels));
  const labelsNote = el('p', 'hint', UI.view2dLabelsNote);

  let mode = initialMode;

  function paint() {
    b3.classList.toggle('on', mode === '3d');
    b2.classList.toggle('on', mode === '2d');
    note.textContent = mode === '2d' ? UI.viewNote2d : UI.viewNote3d;
    // 전체 라벨 토글은 2D에서만 의미가 있다 — 3D는 상시 라벨을 금지한다
    labelsWrap.style.display = mode === '2d' ? '' : 'none';
    labelsNote.style.display = mode === '2d' ? '' : 'none';
  }

  function set(next) {
    mode = next;
    paint();
    onMode?.(mode);
  }

  b3.addEventListener('click', () => set('3d'));
  b2.addEventListener('click', () => set('2d'));

  host.append(
    note,
    namesWrap, namesNote, namesCount,
    countryWrap, countryNote,
    ticksWrap, ticksNote,
    labelsWrap, labelsNote,
  );

  const exportBtn = el('button', 'export-btn', UI.exportPng);
  exportBtn.addEventListener('click', () => onExport?.());
  host.append(exportBtn, el('p', 'hint', UI.exportNote));

  paint();
  return {
    getMode: () => mode,
    set,
    // 프레임마다 갱신되는 컬링 개수 표시 (3D에서만 의미 있다)
    setCulledCount(n) {
      namesCount.textContent = mode === '3d' && namesInput.checked
        ? UI.partyNamesHidden(n)
        : '';
    },
  };
}

export function createControlsUI(host, { flyTo, onCutChange, onReset, trajectory, onTrajFilter }) {
  const sliders = {};
  const readouts = {};
  const trajInputs = {};

  function cameraSection() {
    // 2D에서는 의미가 없으므로 CSS로 숨긴다
    const sec = el('section', 'ctl-sec ctl-sec--camera');
    sec.append(el('h2', null, UI.secCamera));

    const row = el('div', 'btn-row');
    for (const [key, preset] of Object.entries(CAMERA.presets)) {
      const b = el('button', 'preset', preset.label);
      b.dataset.preset = key;
      b.addEventListener('click', () => flyTo(preset.dir));
      row.append(b);
    }
    sec.append(row);
    sec.append(el('p', 'hint', UI.cameraNote));
    return sec;
  }

  function cutRow(idx, labelText) {
    const wrap = el('div', 'cut-row');

    const head = el('div', 'cut-head');
    head.append(el('span', 'cut-label', labelText));
    const out = el('span', 'cut-val', NORMS_BANDS.cut[idx].toFixed(2));
    head.append(out);
    readouts[idx] = out;
    wrap.append(head);

    const input = el('input');
    input.type = 'range';
    input.min = '0.01';
    input.max = '0.99';
    input.step = '0.01';
    input.value = String(NORMS_BANDS.cut[idx]);
    input.addEventListener('input', () => {
      let v = Number(input.value);
      // 순서를 강제한다. 아래 절단점이 위를 넘으면 구간 정의가 무너진다.
      const other = NORMS_BANDS.cut[idx === 0 ? 1 : 0];
      if (idx === 0) v = Math.min(v, other - MIN_GAP);
      else v = Math.max(v, other + MIN_GAP);
      v = Math.round(v * 100) / 100;

      NORMS_BANDS.cut[idx] = v;
      input.value = String(v);
      syncReadouts();
      onCutChange?.();
    });
    sliders[idx] = input;
    wrap.append(input);
    return wrap;
  }

  function syncReadouts() {
    for (const i of [0, 1]) {
      readouts[i].textContent = NORMS_BANDS.cut[i].toFixed(2);
      sliders[i].value = String(NORMS_BANDS.cut[i]);
    }
  }

  function cutSection() {
    const sec = el('section', 'ctl-sec');
    sec.append(el('h2', null, UI.secCut));
    sec.append(cutRow(0, UI.cutLower));
    sec.append(cutRow(1, UI.cutUpper));
    sec.append(el('p', 'hint warn-hint', UI.cutProposalNote));
    sec.append(el('p', 'hint', UI.cutExample));
    return sec;
  }

  function checkbox(labelText, checked, onToggle) {
    const lab = el('label', 'chk');
    const input = el('input');
    input.type = 'checkbox';
    input.checked = checked;
    input.addEventListener('change', () => onToggle(input.checked));
    lab.append(input, el('span', null, labelText));
    return { lab, input };
  }

  function trajectorySection() {
    const sec = el('section', 'ctl-sec');
    sec.append(el('h2', null, UI.secTrajectory));

    const show = checkbox(UI.trajShow, trajectory.isVisible(), (on) => {
      trajectory.setVisible(on);
      // 궤적을 끄면 "궤적만 보기"도 의미가 없으므로 함께 해제한다
      if (!on && trajInputs.only.checked) {
        trajInputs.only.checked = false;
        onTrajFilter?.(false);
      }
      trajInputs.only.disabled = !on;
    });
    trajInputs.show = show.input;
    sec.append(show.lab);

    const only = checkbox(UI.trajOnly, false, (on) => onTrajFilter?.(on));
    only.input.disabled = !trajectory.isVisible();
    trajInputs.only = only.input;
    sec.append(only.lab);

    sec.append(el('p', 'filter-count', UI.trajCount(trajectory.count)));
    sec.append(el('p', 'hint', UI.trajNote));
    return sec;
  }

  function resetSection() {
    const sec = el('section', 'ctl-sec');
    const b = el('button', 'reset-btn', UI.reset);
    b.addEventListener('click', () => onReset?.());
    sec.append(b);
    return sec;
  }

  host.append(cameraSection(), trajectorySection(), cutSection(), resetSection());

  // 리셋 시 슬라이더·체크박스 표시를 되돌리기 위해 노출한다
  return {
    syncReadouts,
    resetTrajectory() {
      trajInputs.show.checked = TRAJECTORY.defaultVisible;
      trajInputs.only.checked = false;
      trajInputs.only.disabled = !TRAJECTORY.defaultVisible;
    },
  };
}
