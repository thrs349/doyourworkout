// lineChart.js
// 외부 차트 라이브러리 없이 아주 단순한 SVG 라인 차트를 그립니다.
// points: [{ date: "YYYY-MM-DD", weight: number }] (오름차순 정렬되어 있어야 함)

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

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xOf(new Date(p.date).getTime()).toFixed(1)} ${yOf(p.weight).toFixed(1)}`)
    .join(" ");
  svg.appendChild(svgEl("path", { d: pathD, fill: "none", stroke: "var(--color-primary)", "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }));

  points.forEach((p) => {
    svg.appendChild(
      svgEl("circle", {
        cx: xOf(new Date(p.date).getTime()).toFixed(1),
        cy: yOf(p.weight).toFixed(1),
        r: points.length === 1 ? 3 : 2.5,
        fill: "var(--color-primary)",
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

  // X축: 모든 날짜를 나열하지 않고, 시간축을 균등 3분할한 지점(최근/중간/과거)의 날짜만 표시
  const fractions = tRange === 0 ? [0] : [0, 0.5, 1];
  const seenX = new Set();
  fractions.forEach((f) => {
    const t = minT + tRange * f;
    const x = xOf(t);
    const anchor = f === 0 ? "start" : f === 1 ? "end" : "middle";
    const key = anchor + Math.round(x);
    if (seenX.has(key)) return;
    seenX.add(key);
    const label = svgEl("text", {
      x: Math.min(Math.max(x, padding.left), width - padding.right).toFixed(1),
      y: height - 4,
      "font-size": 9,
      fill: "var(--color-text-muted)",
      "font-family": "var(--font-mono)",
      "text-anchor": anchor,
    });
    label.textContent = fmtMD(t);
    svg.appendChild(label);
  });

  return svg;
}
