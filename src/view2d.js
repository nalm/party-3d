import { AXES, NORMS_BANDS, VIEW2D, UI, bandOf } from './config.js';

// 2D 대체 뷰. X-Y 산점도 + 규범을 색·도형으로 이중 인코딩 — 명세 13.2절.
// Canvas 2D를 쓰는 이유: PNG 내보내기가 목적이고, 인쇄 배율로 다시 그리기가 쉽다.

const ECON = AXES.find((a) => a.key === 'econ');
const CULT = AXES.find((a) => a.key === 'cultural');

// 규범 구간 → 2D 도형. 3D의 구·8면체·4면체에 대응한다.
function drawShape(ctx, shape, x, y, r) {
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
    // 정삼각형. 무게중심을 (x,y)에 맞춰 시각적 크기를 원과 비슷하게 둔다.
    const s = r * 1.25;
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s * 0.866, y + s * 0.5);
    ctx.lineTo(x - s * 0.866, y + s * 0.5);
    ctx.closePath();
  }
}

function ticksOf(axis) {
  const [lo, hi] = axis.scale;
  const out = [];
  for (let v = lo; v <= hi + 1e-9; v += axis.tickStep) out.push(Math.round(v * 1000) / 1000);
  return out;
}

export function createView2D(canvas, { items, trajectories }) {
  const ctx = canvas.getContext('2d');
  let plot = { x: 0, y: 0, w: 1, h: 1 };
  let showLabels = true;

  // 히트 테스트를 위해 마지막으로 그린 화면 좌표를 기억한다
  const screen = new Map();

  function layout(cssW, cssH) {
    const m = VIEW2D.margin;
    plot = {
      x: m.left,
      y: m.top,
      w: Math.max(1, cssW - m.left - m.right),
      h: Math.max(1, cssH - m.top - m.bottom),
    };
  }

  const sx = (v) => plot.x + ((v - ECON.scale[0]) / (ECON.scale[1] - ECON.scale[0])) * plot.w;
  // 문화축 세로 방향은 3D와 같은 invertScreen 플래그를 따른다 (현재: GAL이 위).
  const sy = (v) => {
    const t = (v - CULT.scale[0]) / (CULT.scale[1] - CULT.scale[0]);
    return plot.y + (CULT.invertScreen ? t : 1 - t) * plot.h;
  };

  function drawFrame() {
    ctx.save();
    ctx.strokeStyle = VIEW2D.grid;
    ctx.lineWidth = 1;
    for (const v of ticksOf(ECON)) {
      const x = Math.round(sx(v)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, plot.y);
      ctx.lineTo(x, plot.y + plot.h);
      ctx.stroke();
    }
    for (const v of ticksOf(CULT)) {
      const y = Math.round(sy(v)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(plot.x, y);
      ctx.lineTo(plot.x + plot.w, y);
      ctx.stroke();
    }

    ctx.strokeStyle = VIEW2D.frame;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(plot.x + 0.5, plot.y + 0.5, plot.w, plot.h);

    // 눈금 값
    ctx.fillStyle = VIEW2D.tickText;
    ctx.font = VIEW2D.tickFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const v of ticksOf(ECON)) ctx.fillText(String(v), sx(v), plot.y + plot.h + 6);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const v of ticksOf(CULT)) ctx.fillText(String(v), plot.x - 7, sy(v));

    // 축 양극 라벨. 각 축은 스펙트럼이므로 양쪽 모두 표기한다.
    ctx.font = VIEW2D.poleFont;
    ctx.fillStyle = ECON.color;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillText(`← ${ECON.poleLow}`, plot.x, plot.y + plot.h + 32);
    ctx.textAlign = 'right';
    ctx.fillText(`${ECON.poleHigh} →`, plot.x + plot.w, plot.y + plot.h + 32);

    // 세로 극 라벨. 회전 후 텍스트는 화면 위 방향으로 흐르므로,
    // 위 모서리 라벨의 ←는 아래쪽 극을, 아래 모서리 라벨의 →는 위쪽 극을 가리킨다.
    const poleTop = CULT.invertScreen ? CULT.poleLow : CULT.poleHigh;
    const poleBottom = CULT.invertScreen ? CULT.poleHigh : CULT.poleLow;
    ctx.fillStyle = CULT.color;
    ctx.save();
    ctx.translate(plot.x - 34, plot.y);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'right';
    ctx.fillText(`← ${poleBottom}`, 0, 0);
    ctx.restore();
    ctx.save();
    ctx.translate(plot.x - 34, plot.y + plot.h);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'left';
    ctx.fillText(`${poleTop} →`, 0, 0);
    ctx.restore();
    ctx.restore();
  }

  function drawTrajectories() {
    if (!trajectories) return;
    ctx.save();
    ctx.strokeStyle = VIEW2D.trajColor;
    ctx.fillStyle = VIEW2D.trajColor;
    ctx.lineWidth = VIEW2D.trajWidth;

    for (const recs of trajectories.values()) {
      for (let i = 0; i < recs.length - 1; i++) {
        const a = recs[i];
        const b = recs[i + 1];
        const ax = sx(a.econ.v);
        const ay = sy(a.cultural.v);
        const bx = sx(b.econ.v);
        const by = sy(b.cultural.v);

        const dx = bx - ax;
        const dy = by - ay;
        const len = Math.hypot(dx, dy);
        if (len < VIEW2D.pointRadius * 2 + VIEW2D.trajHeadLen) continue;

        const ux = dx / len;
        const uy = dy / len;
        const gap = VIEW2D.pointRadius + 2;
        const x0 = ax + ux * gap;
        const y0 = ay + uy * gap;
        const x1 = bx - ux * gap;
        const y1 = by - uy * gap;

        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1 - ux * VIEW2D.trajHeadLen * 0.8, y1 - uy * VIEW2D.trajHeadLen * 0.8);
        ctx.stroke();

        // 화살촉 — 과거 → 최근 방향
        const hw = VIEW2D.trajHeadHalfWidth;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 - ux * VIEW2D.trajHeadLen - uy * hw, y1 - uy * VIEW2D.trajHeadLen + ux * hw);
        ctx.lineTo(x1 - ux * VIEW2D.trajHeadLen + uy * hw, y1 - uy * VIEW2D.trajHeadLen - ux * hw);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawPoints(selectedId, hoveredId) {
    screen.clear();
    for (const item of items) {
      const rec = item.rec;
      const band = bandOf(rec.norms.v);
      const meta = NORMS_BANDS.meta[band];
      const x = sx(rec.econ.v);
      const y = sy(rec.cultural.v);
      screen.set(rec.id, { x, y, item });

      const r = rec.id === selectedId ? VIEW2D.selectRadius
        : rec.id === hoveredId ? VIEW2D.hoverRadius
        : VIEW2D.pointRadius;

      ctx.save();
      ctx.globalAlpha = item.matched ? 1 : VIEW2D.dimAlpha;

      drawShape(ctx, meta.shape, x, y, r);
      ctx.fillStyle = meta.color;
      ctx.fill();

      // 추정치는 점선 윤곽으로 구분한다 — CLAUDE.md 절대규칙 5
      const estimated = rec.econ.estimated || rec.cultural.estimated || rec.norms.estimated;
      ctx.lineWidth = VIEW2D.strokeWidth;
      ctx.strokeStyle = rec.id === selectedId ? '#ffffff' : 'rgba(255,255,255,.65)';
      if (estimated) ctx.setLineDash(VIEW2D.estimatedDash);
      drawShape(ctx, meta.shape, x, y, r);
      ctx.stroke();
      ctx.restore();
    }
  }

  // 라벨 겹침 회피. 네 방향을 순서대로 시도하고 다 막히면 생략한다.
  function drawLabels(selectedId, hoveredId) {
    ctx.save();
    ctx.font = VIEW2D.labelFont;
    ctx.textBaseline = 'middle';

    const placed = [];
    const hits = (r) => placed.some((p) =>
      r.x < p.x + p.w && r.x + r.w > p.x && r.y < p.y + p.h && r.y + r.h > p.y);

    // 선택·호버·궤적 끝점을 먼저 배치해 우선권을 준다
    const trajIds = new Set();
    if (trajectories) {
      for (const recs of trajectories.values()) {
        trajIds.add(recs[0].id);
        trajIds.add(recs[recs.length - 1].id);
      }
    }
    const priority = (it) =>
      it.rec.id === selectedId ? 0 : it.rec.id === hoveredId ? 1 : trajIds.has(it.rec.id) ? 2 : 3;
    const ordered = [...items].filter((i) => i.matched).sort((a, b) => priority(a) - priority(b));

    let skipped = 0;
    for (const item of ordered) {
      const isFocus = item.rec.id === selectedId || item.rec.id === hoveredId;
      if (!showLabels && !isFocus && !trajIds.has(item.rec.id)) continue;

      const pos = screen.get(item.rec.id);
      if (!pos) continue;

      // 궤적 끝점은 연도를 함께 적는다
      const text = trajIds.has(item.rec.id)
        ? `${item.rec.label_short.replace(/\s*['’]\d{2}\s*$/, '')} ${item.rec.year}`
        : item.rec.label_short;

      const w = ctx.measureText(text).width;
      const h = 13;
      const pad = VIEW2D.pointRadius + 5;
      const cands = [
        { x: pos.x + pad, y: pos.y - h / 2, align: 'left' },
        { x: pos.x - pad - w, y: pos.y - h / 2, align: 'left' },
        { x: pos.x - w / 2, y: pos.y - pad - h, align: 'left' },
        { x: pos.x - w / 2, y: pos.y + pad, align: 'left' },
      ];

      const spot = cands.find((c) => {
        const r = { x: c.x, y: c.y, w, h };
        return !hits(r) && r.x >= plot.x - VIEW2D.margin.left && r.x + r.w <= plot.x + plot.w + VIEW2D.margin.right;
      });
      if (!spot) {
        skipped++;
        continue;
      }
      placed.push({ x: spot.x, y: spot.y, w, h });

      ctx.fillStyle = item.rec.id === selectedId ? '#ffffff' : VIEW2D.labelColor;
      ctx.textAlign = 'left';
      // 어두운 배경 위 가독성 확보
      ctx.strokeStyle = 'rgba(14,17,22,.9)';
      ctx.lineWidth = 3;
      ctx.strokeText(text, spot.x, spot.y + h / 2);
      ctx.fillText(text, spot.x, spot.y + h / 2);
    }
    ctx.restore();
    return skipped;
  }

  let lastSkipped = 0;

  function draw({ selectedId = null, hoveredId = null, cssW, cssH, dpr = 1, background = true } = {}) {
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (background) {
      ctx.fillStyle = VIEW2D.bg;
      ctx.fillRect(0, 0, cssW, cssH);
    } else {
      ctx.clearRect(0, 0, cssW, cssH);
    }

    layout(cssW, cssH);
    drawFrame();
    drawTrajectories();
    drawPoints(selectedId, hoveredId);
    lastSkipped = drawLabels(selectedId, hoveredId);
  }

  function hitTest(cssX, cssY) {
    let best = null;
    for (const { x, y, item } of screen.values()) {
      if (!item.matched) continue;
      const d = Math.hypot(cssX - x, cssY - y);
      if (d <= VIEW2D.hoverRadius + 2 && (!best || d < best.d)) best = { d, item };
    }
    return best?.item ?? null;
  }

  return {
    draw,
    hitTest,
    setShowLabels(v) { showLabels = v; },
    getShowLabels: () => showLabels,
    skippedLabels: () => lastSkipped,
    plotRect: () => ({ ...plot }),
  };
}
