import { UI, FILTER, labelOf } from './config.js';

// 국가 · 정당 가족 · 연도 다중 선택 필터.
// 걸러진 점을 숨기는 대신 흐리게 남기는 것이 기본이다 — config.FILTER 주석 참조.

// 어떤 축으로 거를지. dict는 config.LABELS의 사전 이름이다.
const FACETS = [
  { key: 'country', title: () => UI.filterCountry, dict: 'country', of: (r) => r.country },
  { key: 'family', title: () => UI.filterFamily, dict: 'family', of: (r) => r.family },
  { key: 'year', title: () => UI.filterYear, dict: null, of: (r) => String(r.year) },
];

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = String(text);
  return n;
}

export function createFilters(host, parties, { onChange } = {}) {
  // 각 facet의 전체 값 목록. 연도는 숫자순, 나머지는 한국어 표시 기준 정렬.
  const domain = {};
  for (const f of FACETS) {
    const vals = [...new Set(parties.map(f.of))];
    vals.sort(f.key === 'year'
      ? (a, b) => Number(a) - Number(b)
      : (a, b) => labelOf(f.dict, a).localeCompare(labelOf(f.dict, b), 'ko'));
    domain[f.key] = vals;
  }

  // 선택 상태. 비어 있지 않은 Set만 조건으로 쓴다.
  const state = {};
  for (const f of FACETS) state[f.key] = new Set(domain[f.key]);
  let hide = FILTER.defaultHide;

  const boxes = {}; // key -> Map(value -> input)
  const countEl = el('p', 'filter-count');

  function matches(rec) {
    return FACETS.every((f) => state[f.key].has(f.of(rec)));
  }

  function emit() {
    onChange?.({ matches, hide });
  }

  function setCount(shown, total) {
    countEl.textContent = UI.filterCount(shown, total);
  }

  function buildFacet(f) {
    const sec = el('div', 'facet');

    const head = el('div', 'facet-head');
    head.append(el('span', 'facet-title', f.title()));

    const all = el('button', 'mini', UI.filterAll);
    all.addEventListener('click', () => setFacet(f.key, true));
    const none = el('button', 'mini', UI.filterNone);
    none.addEventListener('click', () => setFacet(f.key, false));
    head.append(all, none);
    sec.append(head);

    const list = el('div', 'facet-list');
    boxes[f.key] = new Map();

    for (const v of domain[f.key]) {
      const lab = el('label', 'chk');
      const input = el('input');
      input.type = 'checkbox';
      input.checked = true;
      input.addEventListener('change', () => {
        if (input.checked) state[f.key].add(v);
        else state[f.key].delete(v);
        emit();
      });
      boxes[f.key].set(v, input);
      lab.append(input, el('span', null, f.dict ? labelOf(f.dict, v) : v));
      list.append(lab);
    }
    sec.append(list);
    return sec;
  }

  function setFacet(key, on) {
    state[key] = on ? new Set(domain[key]) : new Set();
    for (const [v, input] of boxes[key]) input.checked = on;
    emit();
  }

  function build() {
    host.textContent = '';
    host.append(el('h2', null, UI.secFilter));
    for (const f of FACETS) host.append(buildFacet(f));

    // 체크박스 의미는 '흐리게 남기기'(= 숨김 해제)다. 내부 상태 hide와 반대 극성.
    const dimLab = el('label', 'chk hide-toggle');
    const dimInput = el('input');
    dimInput.type = 'checkbox';
    dimInput.checked = !hide;
    dimInput.addEventListener('change', () => {
      hide = !dimInput.checked;
      emit();
    });
    dimLab.append(dimInput, el('span', null, UI.filterDimLabel));
    host.append(dimLab);
    host.append(el('p', 'hint', UI.filterDimHint));
    host.append(countEl);

    // 리셋에서 되돌릴 수 있게 참조를 남긴다
    boxes.__dimInput = dimInput;
  }

  function reset() {
    for (const f of FACETS) {
      state[f.key] = new Set(domain[f.key]);
      for (const [, input] of boxes[f.key]) input.checked = true;
    }
    hide = FILTER.defaultHide;
    boxes.__dimInput.checked = !hide;
    emit();
  }

  build();
  return { matches, reset, setCount, isHiding: () => hide };
}
