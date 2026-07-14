// lineChart.js
// 외부 차트 라이브러리 없이 아주 단순한 SVG 라인 차트를 그립니다.
// points: [{ date: "YYYY-MM-DD", weight: number, generation? }] (오름차순 정렬되어 있어야 함)
// v2.3.0: generation 필드가 있으면 "가장 큰 generation 값"만 기존 색상(현재 Generation)으로, 나머지는
// 전부 회색(이전 Generation, 몇 세대 전이든 구분 없이 2색만 사용)으로 그리고, 색이 바뀌는 지점 1곳만
// 회색 점선으로 연결합니다. generation 필드가 없는 점(과거 호출부와의 호환)은 항상 1로 취급됩니다.

const NS = "http://www.w3.org/2000/svg";

function svgEl(tag, attrs = {}) {
  const node = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  return node;
}

function fmtMD(ts) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function renderLineChart(points, { width = 280, height = 96 } = {}) {
  if (!points || points.length === 0) {
    const empty = document.createElement("div");
    empty.className = "chart-empty";
    empty.textContent = "최근 3개월 내 달성 기록이 없습니다.";
    return empty;
  }

  const padding = { top: 10, right: 8, bottom: 18, left: 22 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const weights = points.map((p) => p.weight);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const range = maxW - minW || 1;

  const times = points.map((p) => new Date(p.date).getTime());
  const minT = Math.min(...times);
  const maxT = Math.max(...times);
  const tRange = maxT - minT || 1;

  const xOf = (t) => padding.left + ((t - minT) / tRange) * innerW;
  const yOf = (w) => padding.top + innerH - ((w - minW) / range) * innerH;

  const svg = svgEl("svg", { width, height, viewBox: `0 0 ${width} ${height}`, class: "trend-chart" });

  // 기준선(최저/최고)
  svg.appendChild(svgEl("line", { x1: padding.left, y1: padding.top + innerH, x2: width - padding.right, y2: padding.top + innerH, stroke: "var(--color-border)", "stroke-width": 1 }));

  // v2.3.0: 점마다 x/y 좌표와 함께 색상(자신의 generation 기준)을 미리 계산해둡니다.
  const maxGen = Math.max(...points.map((p) => p.generation || 1));
  const colorOf = (gen) => ((gen || 1) === maxGen ? "var(--color-primary)" : "var(--color-text-muted)");
  const pts = points.map((p) => ({
    x: xOf(new Date(p.date).getTime()),
    y: yOf(p.weight),
    color: colorOf(p.generation),
  }));

  // 점과 점 사이를 구간별로 나눠 그립니다: 같은 색끼리는 실선, 이전 Generation -> 현재 Generation으로
  // 바뀌는 경계 구간 1곳만 회색 점선으로 연결합니다(여러 Generation이 있어도 항상 2색만 사용).
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const isBoundary = a.color !== b.color;
    svg.appendChild(
      svgEl("line", {
        x1: a.x.toFixed(1),
        y1: a.y.toFixed(1),
        x2: b.x.toFixed(1),
        y2: b.y.toFixed(1),
        stroke: isBoundary ? "var(--color-text-muted)" : b.color,
        "stroke-width": 2,
        "stroke-linecap": "round",
        ...(isBoundary ? { "stroke-dasharray": "3 3" } : {}),
      })
    );
  }

  pts.forEach((p) => {
    svg.appendChild(
      svgEl("circle", {
        cx: p.x.toFixed(1),
        cy: p.y.toFixed(1),
        r: pts.length === 1 ? 3 : 2.5,
        fill: p.color,
      })
    );
  });

  // Y축: 단위(kg) 없이 숫자만 표시 (단위는 카드 제목 쪽에서 별도로 안내)
  const maxLabel = svgEl("text", { x: padding.left, y: padding.top, "font-size": 9, fill: "var(--color-text-muted)", "font-family": "var(--font-mono)" });
  maxLabel.textContent = String(maxW);
  svg.appendChild(maxLabel);

  const minLabel = svgEl("text", { x: padding.left, y: padding.top + innerH, "font-size": 9, fill: "var(--color-text-muted)", "font-family": "var(--font-mono)" });
  minLabel.textContent = String(minW);
  svg.appendChild(minLabel);

  // X축: 시간을 계산해 만들어낸 날짜가 아니라, 실제 기록이 있는 포인트 중에서만 인덱스로 선택합니다.
  // 1개 -> 그 1개, 2개 -> 그 2개, 3개 이상 -> 첫/중간/마지막 인덱스(항상 실제 운동 기록 날짜).
  const n = points.length;
  const labelIndices = n <= 2 ? points.map((_, i) => i) : [0, Math.floor((n - 1) / 2), n - 1];
  const seenIdx = new Set();
  labelIndices.forEach((idx) => {
    if (seenIdx.has(idx)) return; // n=3일 때 중간 인덱스가 양끝과 겹치는 경우는 없지만 방어적으로 dedupe
    seenIdx.add(idx);
    const p = pts[idx];
    const anchor = idx === 0 ? "start" : idx === n - 1 ? "end" : "middle";
    const label = svgEl("text", {
      x: Math.min(Math.max(p.x, padding.left), width - padding.right).toFixed(1),
      y: height - 4,
      "font-size": 9,
      fill: "var(--color-text-muted)",
      "font-family": "var(--font-mono)",
      "text-anchor": anchor,
    });
    label.textContent = fmtMD(new Date(points[idx].date).getTime());
    svg.appendChild(label);
  });

  return svg;
}
