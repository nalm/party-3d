import { VIEW2D, NORMS_BANDS, UI, labelOf, countryColor } from './config.js';
import { createView2D } from './view2d.js';
import { shortSourceList } from './panel-source.js';

// PNG 내보내기. 경고와 출처가 이미지 안에 들어가야 한다 — 이미지는 캡션 없이
// 단독 유통되므로 화면 배너에만 경고를 두면 아무 의미가 없다.

const CHART_W = 1020;
const CHART_H = 700;
const WARN_H = 36;
const TITLE_H = 32;
const PAD = 16;
const CAP_LINE_H = 14;

// 캡션 줄바꿈. 출처 목록은 데이터에서 생성되므로 데이터셋이 늘어나면 길어진다.
// 고정 높이로 두면 조용히 캔버스 밖으로 밀려나므로 폭에 맞춰 접는다.
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawLegendShape(ctx, shape, x, y, r) {
  ctx.beginPath();
  if (shape === 'sphere') {
    ctx.arc(x, y, r, 0, Math.PI * 2);
  } else if (shape === 'octahedron') {
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r, y);
    ctx.closePath();
  } else {
    const s = r * 1.25;
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s * 0.866, y + s * 0.5);
    ctx.lineTo(x - s * 0.866, y + s * 0.5);
    ctx.closePath();
  }
}

export function renderExportCanvas({ items, trajectories, dateText }) {
  const S = VIEW2D.exportScale;
  const W = CHART_W;
  const [lo, hi] = NORMS_BANDS.cut;

  const out = document.createElement('canvas');
  const ctx = out.getContext('2d');

  // 캡션 높이를 먼저 계산한다. 줄바꿈 결과에 따라 달라지므로 캔버스 크기를
  // 정하기 전에 재야 한다.
  const capFont = '10.5px "Pretendard","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif';
  ctx.font = capFont;
  // 국가는 색 견본 줄로 따로 그린다(아래) — 여기서는 텍스트 캡션만 접는다
  const capLines = [
    `${UI.pngSourcePrefix}: ${shortSourceList(items.map((i) => i.rec))}`,
    UI.pngScaleNote,
    UI.pngCutNote(lo, hi),
    UI.pngGenerated(dateText),
  ].flatMap((t) => wrapText(ctx, t, W - PAD * 2));

  // 규범 범례 18 + 국가 색 견본 17 + 캡션 첫 줄까지 18 + 줄 수 + 하단 여백
  const captionH = 18 + 17 + 18 + capLines.length * CAP_LINE_H + 10;
  const H = WARN_H + TITLE_H + CHART_H + captionH;

  out.width = Math.round(W * S);
  out.height = Math.round(H * S);
  ctx.setTransform(S, 0, 0, S, 0, 0);

  ctx.fillStyle = VIEW2D.bg;
  ctx.fillRect(0, 0, W, H);

  // ── 상단 경고 띠 ──
  ctx.fillStyle = '#a02a2a';
  ctx.fillRect(0, 0, W, WARN_H);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 14px "Pretendard","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(UI.pngWarning, PAD, WARN_H / 2);

  // ── 제목 ──
  ctx.fillStyle = '#e6eaf0';
  ctx.font = '700 15px "Pretendard","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif';
  ctx.fillText(UI.pngTitle, PAD, WARN_H + TITLE_H / 2);

  // ── 산점도 ──
  // 별도 캔버스에 그린 뒤 합성한다. view2d는 자기 캔버스 전체를 쓰도록 만들어져 있다.
  const chart = document.createElement('canvas');
  const view = createView2D(chart, { items, trajectories });
  view.setShowLabels(true); // 인쇄용이므로 라벨을 켠다
  view.setShowTicks(true); // 화면 설정과 무관하게 인쇄물에는 척도 숫자가 필요하다
  view.setShowCountry(true); // 국가 코드도 항상 — 하단에 해독 키를 함께 넣는다
  view.draw({ cssW: CHART_W, cssH: CHART_H, dpr: S });
  ctx.drawImage(chart, 0, WARN_H + TITLE_H, CHART_W, CHART_H);

  // ── 하단 캡션 ──
  let y = WARN_H + TITLE_H + CHART_H + 18;

  // 범례 — 색만으로 구분하지 않으므로 도형도 함께 그린다
  let x = PAD;
  ctx.font = '11.5px "Pretendard","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif';
  const ranges = { pluralist: [0, lo], borderline: [lo, hi], anti_pluralist: [hi, 1] };
  // 규범 구간 견본은 윤곽선 색 + 도형. 채움색은 국가를 뜻하므로 채우지 않는다.
  for (const key of NORMS_BANDS.order) {
    const m = NORMS_BANDS.meta[key];
    const [a, b] = ranges[key];
    ctx.strokeStyle = m.color;
    ctx.lineWidth = 2;
    drawLegendShape(ctx, m.shape, x + 6, y, 5.5);
    ctx.stroke();

    const text = `${m.label} ${a.toFixed(2)}–${b.toFixed(2)}`;
    ctx.fillStyle = '#c8d0dc';
    ctx.textAlign = 'left';
    ctx.fillText(text, x + 17, y);
    x += 17 + ctx.measureText(text).width + 20;
  }
  ctx.fillStyle = '#9aa4b3';
  ctx.fillText('윤곽선 색·도형 = 규범 구간 · 점선 = 추정치 · 채움색 = 국가', x, y);

  // 국가 색 견본 줄 — 코드만으로는 어느 색이 어느 나라인지 알 수 없다
  y += 17;
  x = PAD;
  ctx.font = '10.5px "Pretendard","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif';
  for (const code of [...new Set(items.map((i) => i.rec.country))].sort()) {
    ctx.beginPath();
    ctx.arc(x + 4, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = countryColor(code);
    ctx.fill();
    const t = `${code} ${labelOf('country', code)}`;
    ctx.fillStyle = '#9aa4b3';
    ctx.fillText(t, x + 12, y);
    x += 12 + ctx.measureText(t).width + 14;
  }

  // 출처·척도·절단점·생성일 — 위에서 이미 접어 둔 줄을 그린다
  ctx.font = capFont;
  ctx.fillStyle = '#9aa4b3';
  y += 18;
  for (const line of capLines) {
    ctx.fillText(line, PAD, y);
    y += CAP_LINE_H;
  }

  return out;
}

export function downloadPNG({ items, trajectories }) {
  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const canvas = renderExportCanvas({ items, trajectories, dateText: stamp });

  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `${UI.exportFilename}_${stamp}.png`;
  a.click();
  return canvas;
}
