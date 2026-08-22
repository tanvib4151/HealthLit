/**
 * Chart rendering for printed reports.
 *
 * Turns a ChartSpec into inline SVG plus its data table. Pure string
 * building with no React Native imports, deliberately: it lives in
 * utils rather than services so it can be rendered and inspected
 * without a device, and so the print output can be tested directly.
 *
 * Renders from the SAME ChartSpec the app draws on screen, so a
 * printed chart and an on-screen chart cannot disagree. Two separate
 * implementations would drift the first time either was edited.
 *
 * Inline SVG rather than a rasterised image: it prints at the
 * printer's resolution instead of a phone screen's, needs no file
 * handling, and survives being emailed as a PDF.
 */

import { ChartSpec } from './storyCharts';
import { escapeHtml } from './html';

/**
 * Renders a chart spec as inline SVG for the printed report.
 *
 * Deliberately the same ChartSpec the app renders, so a printed chart
 * and an on-screen chart can never disagree — the alternative is two
 * implementations that drift the first time either is edited.
 *
 * Inline SVG rather than an image: it prints at the printer's
 * resolution instead of a phone screen's, needs no file handling, and
 * survives being emailed as a PDF. Every chart is followed by its
 * data table, because a report may be photocopied to grey and colour
 * is then the only thing distinguishing two lines.
 */
export function renderChartSvg(chart: ChartSpec): string {
  const W = 660;
  const H = 200;
  const PAD = { top: 14, right: 14, bottom: 26, left: 34 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const parts: string[] = [];

  if (chart.kind === 'coverageCalendar') {
    // One square per day, wrapped — same idea as the app's grid.
    const cell = 18;
    const gap = 4;
    const perRow = Math.floor(W / (cell + gap));
    const values = chart.series[0].values;
    const rows = Math.ceil(values.length / perRow);
    const height = rows * (cell + gap) + 8;
    const squares = values
      .map((value, index) => {
        const x = (index % perRow) * (cell + gap);
        const y = Math.floor(index / perRow) * (cell + gap);
        const fill = value === null ? '#F2EFF8' : severityPrintColor(value);
        const stroke = value === null ? ' stroke="#DDD8E8"' : '';
        return `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="4" fill="${fill}"${stroke} />`;
      })
      .join('');
    return `<svg width="100%" viewBox="0 0 ${W} ${height}" xmlns="http://www.w3.org/2000/svg">${squares}</svg>`;
  }

  if (chart.kind === 'factorContrast') {
    const values = chart.series[0].values;
    const rowH = 30;
    const height = values.length * rowH + 16;
    const centre = W / 2;
    const scale = (W / 2 - 90) / Math.max(chart.yMax, 1);
    const bars = values
      .map((value, index) => {
        if (value === null) return '';
        const len = Math.max(Math.abs(value) * scale, 2);
        const improving = value < 0;
        const x = improving ? centre - len : centre;
        const y = index * rowH + 8;
        const fill = improving ? '#3FAF8C' : '#DE9A36';
        const label = escapeHtml(chart.labels[index] ?? '');
        const labelX = improving ? centre + 8 : centre - 8;
        const anchor = improving ? 'start' : 'end';
        return (
          `<rect x="${x}" y="${y}" width="${len}" height="${rowH - 14}" rx="3" fill="${fill}" />` +
          `<text x="${labelX}" y="${y + 12}" font-size="11" fill="#555" text-anchor="${anchor}">${label}</text>`
        );
      })
      .join('');
    return (
      `<svg width="100%" viewBox="0 0 ${W} ${height}" xmlns="http://www.w3.org/2000/svg">` +
      `<line x1="${centre}" y1="4" x2="${centre}" y2="${height - 4}" stroke="#CCC" stroke-width="1.5" />` +
      `${bars}</svg>`
    );
  }

  if (chart.kind === 'severityDistribution' || chart.kind === 'symptomFrequency') {
    const values = chart.series[0].values;
    const slot = innerW / Math.max(values.length, 1);
    const barW = Math.max(4, slot * 0.62);
    const yMax = Math.max(chart.yMax, 1);
    // Track only where there is an actual value. Drawing a
    // full-height track on a zero-count column reads as "there is
    // something here", which on a severity histogram is a false
    // statement about the patient's data — the empty levels are
    // precisely the severities they never recorded.
    values.forEach((value, index) => {
      if (value === null || value === 0) return;
      const x = PAD.left + slot * index + (slot - barW) / 2;
      parts.push(
        `<rect x="${x}" y="${PAD.top}" width="${barW}" height="${innerH}" rx="4" fill="#F4F0FB" />`,
      );
    });
    parts.push(
      `<line x1="${PAD.left}" y1="${PAD.top + innerH}" x2="${W - PAD.right}" y2="${PAD.top + innerH}" stroke="#DDD" />`,
    );
    values.forEach((value, index) => {
      if (value === null || value === 0) return;
      const h = innerH * (value / yMax);
      const x = PAD.left + slot * index + (slot - barW) / 2;
      const fill =
        chart.kind === 'severityDistribution' ? severityPrintColor(index) : '#7C6BD6';
      parts.push(
        `<rect x="${x}" y="${PAD.top + innerH - h}" width="${barW}" height="${h}" rx="4" fill="${fill}" />`,
        `<text x="${x + barW / 2}" y="${PAD.top + innerH - h - 5}" font-size="10" fill="#6E6887" text-anchor="middle">${value}</text>`,
        `<text x="${x + barW / 2}" y="${H - 8}" font-size="10" fill="#777" text-anchor="middle">${escapeHtml(chart.labels[index] ?? '')}</text>`,
      );
    });
    return `<svg width="100%" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`;
  }

  // Line chart (severity over time).
  const count = chart.labels.length;
  const xAt = (index: number) =>
    count <= 1 ? PAD.left + innerW / 2 : PAD.left + (innerW * index) / (count - 1);
  const yAt = (value: number) => PAD.top + innerH * (1 - value / Math.max(chart.yMax, 1));

  // Gradient defs, one per series — mirrors the in-app chart so a
  // printed report and the on-screen version look like the same
  // document rather than two different products.
  const baselineY = PAD.top + innerH;
  const defs = chart.series
    .map(
      (series, index) =>
        `<linearGradient id="fill-${index}" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${series.color}" stop-opacity="0.22" />` +
        `<stop offset="1" stop-color="${series.color}" stop-opacity="0.01" />` +
        `</linearGradient>`,
    )
    .join('');
  parts.push(`<defs>${defs}</defs>`);

  for (const gridValue of [0, 5, 10]) {
    parts.push(
      `<line x1="${PAD.left}" y1="${yAt(gridValue)}" x2="${W - PAD.right}" y2="${yAt(gridValue)}" stroke="#E8E4F0" stroke-width="1" />`,
      `<text x="${PAD.left - 8}" y="${yAt(gridValue) + 3.5}" font-size="10" fill="#8A8694" text-anchor="end">${gridValue}</text>`,
    );
  }

  chart.series.forEach((series, seriesIndex) => {
    // Runs of consecutive non-null values; gaps stay gaps.
    let run: string[] = [];
    const flush = () => {
      if (run.length > 1) {
        const firstX = run[0].split(',')[0];
        const lastPoint = run[run.length - 1].split(',');
        parts.push(
          `<polygon points="${firstX},${baselineY} ${run.join(' ')} ${lastPoint[0]},${baselineY}" fill="url(#fill-${seriesIndex})" />`,
          `<polyline points="${run.join(' ')}" fill="none" stroke="${series.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />`,
          `<circle cx="${lastPoint[0]}" cy="${lastPoint[1]}" r="3.5" fill="#FFFFFF" stroke="${series.color}" stroke-width="2.5" />`,
        );
      } else if (run.length === 1) {
        const [x, y] = run[0].split(',');
        parts.push(`<circle cx="${x}" cy="${y}" r="3.5" fill="${series.color}" />`);
      }
      run = [];
    };
    series.values.forEach((value, index) => {
      if (value === null) flush();
      else run.push(`${xAt(index)},${yAt(value)}`);
    });
    flush();
  });

  chart.labels.forEach((label, index) => {
    if (label === '') return;
    parts.push(
      `<text x="${xAt(index)}" y="${H - 8}" font-size="10" fill="#777" text-anchor="middle">${escapeHtml(label)}</text>`,
    );
  });

  return `<svg width="100%" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`;
}

/** Print-safe severity colours, independent of the app theme. */
export function severityPrintColor(value: number): string {
  if (value <= 2) return '#8FCFB6';
  if (value <= 4) return '#A8C8E8';
  if (value <= 6) return '#E8C88A';
  if (value <= 8) return '#E0A07C';
  return '#D0768C';
}

/** A chart plus its data table, as one non-breaking block. */
export function renderChartBlock(chart: ChartSpec): string {
  const headers = chart.table.headers
    .map((header) => `<th>${escapeHtml(header)}</th>`)
    .join('');
  const rows = chart.table.rows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`,
    )
    .join('');

  return `
  <section class="chart-block">
    <h3>${escapeHtml(chart.title)}</h3>
    <p class="chart-caption">${escapeHtml(chart.caption)}</p>
    ${renderChartSvg(chart)}
    <table class="chart-table">
      <thead><tr>${headers}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${chart.table.note !== undefined ? `<p class="chart-note">${escapeHtml(chart.table.note)}</p>` : ''}
  </section>`;
}
