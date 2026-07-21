/**
 * charts.js — Gráficos con Chart.js
 * Gráfico de movimientos de los últimos 7 días
 */
'use strict';

let movementsChartInstance = null;

async function initMovementsChart() {
  const canvas = document.getElementById('movements-chart');
  if (!canvas || typeof Chart === 'undefined') return;

  // Generar últimos 7 días
  const labels = [];
  const fechas = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    labels.push(d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }));
    fechas.push(d.toISOString().split('T')[0]);
  }

  // Datos simulados (en producción, hacer llamada a /api/movements con rango de fechas)
  const salidasData  = [12, 8, 15, 7, 20, 11, 9];
  const entradasData = [5,  3,  8, 2,  6,  4, 7];

  try {
    const data = await API.getMovements(`limit=200&desde=${fechas[0]}&hasta=${fechas[6]}`);
    // Se podría procesar data.data para calcular por día
  } catch (err) { /* usar datos simulados */ }

  if (movementsChartInstance) {
    movementsChartInstance.destroy();
  }

  movementsChartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Salidas',
          data: salidasData,
          backgroundColor: 'rgba(239,68,68,0.6)',
          borderColor: 'rgba(239,68,68,0.9)',
          borderWidth: 1,
          borderRadius: 6,
          borderSkipped: false
        },
        {
          label: 'Entradas',
          data: entradasData,
          backgroundColor: 'rgba(16,185,129,0.6)',
          borderColor: 'rgba(16,185,129,0.9)',
          borderWidth: 1,
          borderRadius: 6,
          borderSkipped: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 } }
        },
        tooltip: {
          backgroundColor: 'rgba(17,24,39,0.95)',
          titleColor: '#f1f5f9',
          bodyColor: '#94a3b8',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#64748b', font: { size: 11 } }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#64748b', font: { size: 11 }, stepSize: 5 },
          beginAtZero: true
        }
      }
    }
  });
}
