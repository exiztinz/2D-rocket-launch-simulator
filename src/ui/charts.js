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
          ctxRef.save();
          ctxRef.fillStyle = '#ffdca1';
          ctxRef.font = '11px Sora';
          markerDataset.data.forEach((point, index) => {
            const element = meta.data[index];
            if (!element) return;
            ctxRef.fillText(point.label, element.x + 6, element.y - 7);
          });
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
    const time = Number(sample.tSec.toFixed(1));

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
