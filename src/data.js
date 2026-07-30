import raw from '../data/parties.json';
import { UI } from './config.js';

// parties.json을 번들에 인라인한다. fetch를 쓰면 GitHub Pages의 base 경로에서
// 404가 나기 쉽고, 문서화된 위치(data/parties.json)를 옮기지 않아도 된다.

const AXIS_KEYS = ['econ', 'cultural', 'norms'];

// 검증은 _meta.norms_bands의 절단점으로 한다. UI 슬라이더가 조절하는 런타임
// 절단점(config.NORMS_BANDS.cut)이 아니다 — 저장된 band는 시드가 선언한 절단점 기준이다.
function seedBandOf(v, bands) {
  if (v < bands.pluralist[1]) return 'pluralist';
  if (v < bands.borderline[1]) return 'borderline';
  return 'anti_pluralist';
}

function validate(meta, parties) {
  const problems = [];
  const seenKeyYear = new Set();

  for (const rec of parties) {
    const id = rec.id ?? '(id 없음)';

    for (const f of ['id', 'party_key', 'country', 'name_ko', 'label_short', 'family', 'year']) {
      if (rec[f] === undefined || rec[f] === null) problems.push(`${id}: 필수 필드 ${f} 누락`);
    }

    for (const key of AXIS_KEYS) {
      const ax = rec[key];
      if (!ax) {
        problems.push(`${id}: ${key} 축 누락`);
        continue;
      }
      for (const f of ['v', 'scale', 'src', 'estimated']) {
        if (ax[f] === undefined) problems.push(`${id}.${key}: 필수 필드 ${f} 누락`);
      }
      if (typeof ax.v === 'number' && Array.isArray(ax.scale)) {
        const [lo, hi] = ax.scale;
        if (ax.v < lo || ax.v > hi) {
          problems.push(`${id}.${key}: v=${ax.v}가 척도 범위 [${lo}, ${hi}] 밖이다`);
        }
      }
    }

    if (rec.norms && typeof rec.norms.v === 'number') {
      const expected = seedBandOf(rec.norms.v, meta.norms_bands);
      if (rec.norms.band !== expected) {
        problems.push(
          `${id}.norms: band="${rec.norms.band}"인데 v=${rec.norms.v}는 "${expected}" 구간이다`,
        );
      }
    }

    const k = `${rec.party_key}@${rec.year}`;
    if (seenKeyYear.has(k)) problems.push(`party_key 중복 연도: ${k}`);
    seenKeyYear.add(k);
  }

  if (meta.record_count !== parties.length) {
    problems.push(`_meta.record_count=${meta.record_count}인데 실제 레코드는 ${parties.length}개다`);
  }
  const uniq = new Set(parties.map((p) => p.party_key)).size;
  if (meta.unique_party_count !== uniq) {
    problems.push(`_meta.unique_party_count=${meta.unique_party_count}인데 실제 party_key는 ${uniq}개다`);
  }

  return problems;
}

export function loadParties() {
  const meta = raw._meta;
  const all = raw.parties ?? [];

  const problems = validate(meta, all);
  for (const p of problems) console.warn(`${UI.validationPrefix} ${p}`);
  if (problems.length === 0) console.info(`${UI.validationPrefix} 통과 — ${all.length}개 레코드`);

  // 연도 없는 좌표는 렌더링하지 않는다 — CLAUDE.md 절대규칙 7.
  const renderable = all.filter((rec) => {
    if (!rec.year) {
      console.warn(`${UI.validationPrefix} ${rec.id}: year가 없어 렌더링에서 제외했다`);
      return false;
    }
    return true;
  });

  return { meta, parties: renderable, problems };
}
