export class ChartRenderer {
  constructor() {
    this.canvas = null;
    this.ctx = null;
  }

  init(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext("2d");
  }

  drawLineChart(data, options = {}) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const padding = { top: 20, right: 15, bottom: 30, left: 55 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    // Clear
    ctx.fillStyle = "#1a1710";
    ctx.fillRect(0, 0, w, h);

    if (!data.length) {
      ctx.fillStyle = "#a09080";
      ctx.font = "12px 'Noto Sans JP'";
      ctx.textAlign = "center";
      ctx.fillText("データがありません", w / 2, h / 2);
      return;
    }

    const series = options.series || [{ key: "value", color: "#d4a843", label: "値" }];

    // Calculate bounds
    let allVals = [];
    for (const s of series) {
      allVals.push(...data.map(d => d[s.key] || 0));
    }
    const minVal = Math.min(0, ...allVals);
    const maxVal = Math.max(1, ...allVals);
    const range = maxVal - minVal || 1;

    // Grid
    ctx.strokeStyle = "#3a3020";
    ctx.lineWidth = 0.5;
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (i / gridLines) * chartH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();

      const val = maxVal - (i / gridLines) * range;
      ctx.fillStyle = "#a09080";
      ctx.font = "9px 'Space Mono'";
      ctx.textAlign = "right";
      ctx.fillText(this._formatNumber(val), padding.left - 5, y + 3);
    }

    // Zero line
    if (minVal < 0) {
      const zeroY = padding.top + ((maxVal - 0) / range) * chartH;
      ctx.strokeStyle = "#505050";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding.left, zeroY);
      ctx.lineTo(w - padding.right, zeroY);
      ctx.stroke();
    }

    // X labels
    const step = Math.max(1, Math.floor(data.length / 8));
    ctx.fillStyle = "#a09080";
    ctx.font = "8px 'Space Mono'";
    ctx.textAlign = "center";
    for (let i = 0; i < data.length; i += step) {
      const x = padding.left + (i / (data.length - 1 || 1)) * chartW;
      const label = data[i].label || `${i + 1}`;
      ctx.fillText(label, x, h - 8);
    }

    // Draw each series
    for (const s of series) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < data.length; i++) {
        const x = padding.left + (i / (data.length - 1 || 1)) * chartW;
        const val = data[i][s.key] || 0;
        const y = padding.top + ((maxVal - val) / range) * chartH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Dots on last point
      if (data.length > 0) {
        const lastI = data.length - 1;
        const x = padding.left + (lastI / (data.length - 1 || 1)) * chartW;
        const val = data[lastI][s.key] || 0;
        const y = padding.top + ((maxVal - val) / range) * chartH;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Legend
    ctx.font = "9px 'Noto Sans JP'";
    let lx = padding.left;
    for (const s of series) {
      ctx.fillStyle = s.color;
      ctx.fillRect(lx, 4, 12, 8);
      ctx.fillStyle = "#e8e0d0";
      ctx.textAlign = "left";
      ctx.fillText(s.label, lx + 15, 11);
      lx += ctx.measureText(s.label).width + 30;
    }
  }

  _formatNumber(n) {
    if (Math.abs(n) >= 10000) return `${Math.round(n / 1000)}k`;
    return Math.round(n).toString();
  }

  drawBarChart(data, options = {}) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const padding = { top: 20, right: 15, bottom: 40, left: 55 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    ctx.fillStyle = "#1a1710";
    ctx.fillRect(0, 0, w, h);

    if (!data.length) return;

    const maxVal = Math.max(1, ...data.map(d => d.value));
    const barW = Math.min(30, (chartW / data.length) * 0.7);
    const gap = (chartW - barW * data.length) / (data.length + 1);

    for (let i = 0; i < data.length; i++) {
      const x = padding.left + gap + i * (barW + gap);
      const barH = (data[i].value / maxVal) * chartH;
      const y = padding.top + chartH - barH;

      ctx.fillStyle = data[i].color || "#d4a843";
      ctx.fillRect(x, y, barW, barH);

      // Label
      ctx.fillStyle = "#a09080";
      ctx.font = "8px 'Noto Sans JP'";
      ctx.textAlign = "center";
      ctx.save();
      ctx.translate(x + barW / 2, h - 5);
      ctx.rotate(-0.4);
      ctx.fillText(data[i].label || "", 0, 0);
      ctx.restore();

      // Value
      ctx.fillStyle = "#e8e0d0";
      ctx.font = "8px 'Space Mono'";
      ctx.textAlign = "center";
      ctx.fillText(this._formatNumber(data[i].value), x + barW / 2, y - 4);
    }
  }
}
