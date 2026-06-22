function createChart(ctx, label, color, timelineMarkers) {
  return new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        {
          label,
          data: [],
          borderColor: color,
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.24,
          fill: true,
          backgroundColor: `${color}33`
        },
        {
          label: 'Events',
          data: [],
          pointRadius: 4,
          pointHoverRadius: 5,
          pointBackgroundColor: '#ffd073',
          pointBorderColor: '#1b2234',
          showLine: false
        }
      ]
    },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      resizeDelay: 120,
      plugins: {
        legend: {
          labels: { color: '#d8ebf9', font: { family: 'Sora' } }
        },
        tooltip: {
          backgroundColor: 'rgba(7, 16, 31, 0.94)',
          titleColor: '#eaf4ff',
          bodyColor: '#dcefff'
        }
      },
      scales: {
        x: {
          type: 'linear',
          ticks: { color: '#a3bfd7', maxTicksLimit: 5 },
          grid: { color: 'rgba(140, 172, 209, 0.16)' }
        },
        y: {
          ticks: { color: '#a3bfd7' },
          grid: { color: 'rgba(140, 172, 209, 0.16)' }
        }
      }
    },
    plugins: [
      {
        id: 'timelineMarkers',
        afterDatasetsDraw(chart) {
          const markerDataset = chart.data.datasets[1];
          const meta = chart.getDatasetMeta(1);
          const ctxRef = chart.ctx;
          const area = chart.chartArea;

          ctxRef.save();
          ctxRef.font = '11px Sora';

          // --- Build label layout descriptors ---
          const FONT_HEIGHT = 12;
          const PAD_X = 5;   // horizontal gap between dot and label start
          const PAD_Y = 4;   // minimum vertical gap between label baselines
          const LEADER_OFFSET = 14; // px from dot to label baseline when staggered

          const labels = [];
          markerDataset.data.forEach((point, index) => {
            const element = meta.data[index];
            if (!element) return;
            const textWidth = ctxRef.measureText(point.label).width;
            labels.push({
              label: point.label,
              dotX: element.x,
              dotY: element.y,
              textWidth,
              // Initial preferred position: just above and to the right of the dot.
              labelX: element.x + PAD_X,
              labelY: element.y - LEADER_OFFSET
            });
          });

          // Sort by dotX so we stagger left-to-right predictably.
          labels.sort((a, b) => a.dotX - b.dotX);

          // --- Collision resolution: push overlapping labels upward ---
          // Two labels overlap when their x ranges intersect AND y baselines are within FONT_HEIGHT.
          const MIN_STEP = FONT_HEIGHT + PAD_Y;
          for (let i = 1; i < labels.length; i += 1) {
            const curr = labels[i];
            for (let j = 0; j < i; j += 1) {
              const prev = labels[j];
              const xOverlap =
                curr.labelX < prev.labelX + prev.textWidth + PAD_X &&
                curr.labelX + curr.textWidth + PAD_X > prev.labelX;
              const yOverlap = Math.abs(curr.labelY - prev.labelY) < MIN_STEP;
              if (xOverlap && yOverlap) {
                // Push current label up by the gap needed to clear the previous one.
                curr.labelY = prev.labelY - MIN_STEP;
              }
            }
          }

          // --- Clamp to canvas bounds ---
          for (const item of labels) {
            // Left boundary.
            if (item.labelX < area.left) {
              item.labelX = area.left;
            }
            // Right boundary.
            if (item.labelX + item.textWidth > area.right) {
              item.labelX = area.right - item.textWidth;
            }
            // Top boundary: never clip above the chart area.
            if (item.labelY - FONT_HEIGHT < area.top) {
              item.labelY = area.top + FONT_HEIGHT;
            }
          }

          // --- Draw leader lines then labels ---
          for (const item of labels) {
            const staggered = Math.abs(item.labelY - (item.dotY - LEADER_OFFSET)) > 2;

            if (staggered) {
              // Line from dot upward to a small tick, then horizontal to label.
              ctxRef.beginPath();
              ctxRef.strokeStyle = 'rgba(255, 220, 161, 0.45)';
              ctxRef.lineWidth = 1;
              ctxRef.moveTo(item.dotX, item.dotY - 5);
              ctxRef.lineTo(item.dotX, item.labelY - 2);
              ctxRef.lineTo(item.labelX - 2, item.labelY - 2);
              ctxRef.stroke();
            }

            ctxRef.fillStyle = '#ffdca1';
            ctxRef.fillText(item.label, item.labelX, item.labelY);
          }

          ctxRef.restore();
        }
      }
    ]
  });
}

function toEventPoints(samples, events, valueSelector) {
  return events
    .map((event) => {
      const sample = samples.find((entry) => Math.abs(entry.tSec - event.timeSec) < 0.06);
      if (!sample) return null;
      return {
        x: Number(sample.tSec.toFixed(1)),
        y: valueSelector(sample),
        label: event.label
      };
    })
    .filter(Boolean);
}

export class TelemetryCharts {
  constructor(config) {
    const altitudeCtx = document.getElementById(config.altitudeCanvasId).getContext('2d');
    const velocityCtx = document.getElementById(config.velocityCanvasId).getContext('2d');
    const accelCtx = document.getElementById(config.accelCanvasId).getContext('2d');

    this.altitudeChart = createChart(altitudeCtx, 'Altitude (m)', '#61d2ff');
    this.velocityChart = createChart(velocityCtx, 'Velocity (m/s)', '#88f2a8');
    this.accelChart = createChart(accelCtx, 'Total Acceleration (m/s²)', '#ffc27a');
  }

  reset() {
    [this.altitudeChart, this.velocityChart, this.accelChart].forEach((chart) => {
      chart.data.datasets[0].data = [];
      chart.data.datasets[1].data = [];
      chart.update('none');
    });
  }

  pushSample(sample) {
    const time = Number(sample.tSec.toFixed(2));

    this.altitudeChart.data.datasets[0].data.push({ x: time, y: sample.altitudeM });

    this.velocityChart.data.datasets[0].data.push({ x: time, y: sample.velocityMps });

    this.accelChart.data.datasets[0].data.push({ x: time, y: sample.totalAccelerationMps2 });
  }

  applyEvents(samples, events) {
    this.altitudeChart.data.datasets[1].data = toEventPoints(samples, events, (sample) => sample.altitudeM);
    this.velocityChart.data.datasets[1].data = toEventPoints(samples, events, (sample) => sample.velocityMps);
    this.accelChart.data.datasets[1].data = toEventPoints(samples, events, (sample) => sample.totalAccelerationMps2);

    this.altitudeChart.update('none');
    this.velocityChart.update('none');
    this.accelChart.update('none');
  }

  render() {
    this.altitudeChart.update('none');
    this.velocityChart.update('none');
    this.accelChart.update('none');
  }
}
