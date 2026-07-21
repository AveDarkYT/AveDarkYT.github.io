/**
 * app.js — Lógica principal del Dashboard
 * Carga KPIs, tabla de stock bajo, alertas, actividad reciente
 */
'use strict';

// ── Inicialización ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Mostrar modal de login si no hay token
  if (!Auth.isLoggedIn()) {
    showLoginModal();
    return;
  }
  initDashboard();
});

function initDashboard() {
  loadUserInfo();
  initSocket();
  setupQuickScan();
  setupUI();
  loadDashboardData();

  // Actualizar cada 60 segundos
  setInterval(loadDashboardData, 60000);

  document.getElementById('btn-refresh')?.addEventListener('click', () => {
    loadDashboardData();
    showToast('info', 'Actualizando', 'Cargando datos del almacén...');
  });
}

// ── Carga datos del dashboard ──────────────────────────────
async function loadDashboardData() {
  try {
    const [summary, lowStock, stats, alerts, movements] = await Promise.allSettled([
      API.getInventorySummary(),
      API.getLowStock(),
      API.getStats(),
      API.getAlerts('leida=false&resuelta=false&limit=5'),
      API.getMovements('limit=6')
    ]);

    if (summary.status === 'fulfilled') renderKPIs(summary.value.data, stats.value?.data);
    if (lowStock.status === 'fulfilled') renderLowStockTable(lowStock.value.data);
    if (alerts.status === 'fulfilled') renderAlerts(alerts.value.data);
    if (movements.status === 'fulfilled') renderActivity(movements.value.data);
    await updateAlertBadge();

  } catch (err) {
    showToast('error', 'Error', 'No se pudo conectar con el servidor');
    console.error('Dashboard error:', err);
  }
}

// ── KPI Cards ──────────────────────────────────────────────
function renderKPIs(summary, stats) {
  if (!summary) return;
  setEl('kpi-total-productos', summary.total_productos ?? '—');
  setEl('kpi-total-unidades',  (summary.total_unidades ?? 0).toLocaleString());
  setEl('kpi-bajo-reorden',   summary.bajo_reorden    ?? '—');
  setEl('kpi-sin-stock',      summary.sin_stock       ?? '—');
  setEl('kpi-criticos',       `${summary.stock_critico ?? 0} críticos`);
  setEl('kpi-productos-activos', `${summary.total_productos ?? 0} activos`);

  if (stats) {
    const total = (stats.salidas?.count || 0) + (stats.entradas?.count || 0);
    setEl('kpi-movimientos-hoy', total);
    setEl('kpi-salidas-hoy',
      `${stats.salidas?.count || 0} salidas / ${stats.entradas?.count || 0} entradas`
    );
  }
}

// ── Tabla de stock bajo ────────────────────────────────────
function renderLowStockTable(items) {
  const tbody = document.getElementById('low-stock-tbody');
  if (!tbody) return;

  if (!items || items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-muted)">
      ✅ Todos los productos tienen stock suficiente
    </td></tr>`;
    return;
  }

  tbody.innerHTML = items.slice(0, 10).map(item => {
    const prod = item.producto;
    const pct  = item.stock_maximo > 0
      ? Math.round((item.cantidad_disponible / item.stock_maximo) * 100)
      : 0;
    const cls  = getStockClass(item.cantidad_disponible, item.punto_reorden);
    const badge = item.urgencia === 'sin_stock' ? 'danger'
      : item.urgencia === 'critico' ? 'danger' : 'warning';
    const label = item.urgencia === 'sin_stock' ? '⛔ Sin Stock'
      : item.urgencia === 'critico' ? '🔴 Crítico' : '🟡 Bajo';

    return `<tr>
      <td>
        <div style="font-weight:600; font-size:14px">${prod.nombre}</div>
        <div style="font-size:11px; color:var(--text-muted); font-family:monospace">${prod.sku}</div>
      </td>
      <td style="font-size:12px; color:var(--text-secondary)">${prod.ubicacion?.descripcion_completa || '—'}</td>
      <td>
        <div class="stock-bar-wrap">
          <div style="font-size:13px; font-weight:600">${item.cantidad_disponible} / ${item.punto_reorden}</div>
          <div class="stock-bar-track">
            <div class="stock-bar-fill ${cls}" style="width:${Math.min(pct,100)}%"></div>
          </div>
          <div class="stock-bar-label">de ${item.stock_maximo}</div>
        </div>
      </td>
      <td><span class="badge badge-${badge}">${label}</span></td>
    </tr>`;
  }).join('');
}

// ── Alertas ────────────────────────────────────────────────
function renderAlerts(alertas) {
  const container = document.getElementById('alerts-list');
  if (!container) return;

  if (!alertas || alertas.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:13px">
      ✅ Sin alertas activas
    </div>`;
    return;
  }

  container.innerHTML = alertas.map(a => {
    const tipo = a.tipo;
    const dotCls = tipo === 'sin_stock' || tipo === 'stock_critico' ? 'dot-red' : 'dot-yellow';
    const alertCls = tipo === 'sin_stock' ? 'alert-sin'
      : tipo === 'stock_critico' ? 'alert-critico' : 'alert-bajo';
    return `<div class="alert-item ${alertCls}" data-alert-id="${a._id}">
      <div class="alert-dot ${dotCls}"></div>
      <div class="alert-content">
        <div class="alert-title">${a.producto?.nombre || 'Producto'}</div>
        <div style="font-size:12px; color:var(--text-secondary); margin:2px 0">${a.mensaje}</div>
        <div class="alert-time">${timeAgo(a.createdAt)}</div>
      </div>
    </div>`;
  }).join('');
}

function renderAlertItem(data) {
  const container = document.getElementById('alerts-list');
  if (!container) return;
  const emptyState = container.querySelector('[style*="Sin alertas"]');
  if (emptyState) emptyState.remove();

  const el = document.createElement('div');
  el.className = 'alert-item alert-critico';
  el.dataset.alertId = data.id;
  el.innerHTML = `
    <div class="alert-dot dot-red"></div>
    <div class="alert-content">
      <div class="alert-title">${data.producto_nombre}</div>
      <div style="font-size:12px; color:var(--text-secondary); margin:2px 0">${data.mensaje}</div>
      <div class="alert-time">ahora</div>
    </div>`;
  container.prepend(el);
}

// ── Actividad reciente ─────────────────────────────────────
function renderActivity(movimientos) {
  const container = document.getElementById('activity-list');
  if (!container) return;

  if (!movimientos || movimientos.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px">Sin actividad reciente</div>`;
    return;
  }

  const iconMap = { entrada: '📥', salida: '📤', ajuste: '🔧', devolucion: '↩️' };
  container.innerHTML = movimientos.map(m => `
    <div class="activity-item">
      <div class="activity-icon ${m.tipo}">
        ${iconMap[m.tipo] || '🔄'}
      </div>
      <div style="flex:1; min-width:0">
        <div style="font-size:13px; font-weight:600; truncate">${m.producto?.nombre || '—'}</div>
        <div style="font-size:11px; color:var(--text-muted)">${m.usuario?.nombre || '—'} · ${timeAgo(m.createdAt)}</div>
      </div>
      <div style="text-align:right; flex-shrink:0">
        <div style="font-size:13px; font-weight:700; color:${m.tipo === 'salida' ? 'var(--accent-red)' : 'var(--accent-green)'}">
          ${m.tipo === 'salida' ? '-' : '+'}${m.cantidad}
        </div>
        <div style="font-size:11px; color:var(--text-muted)">→ ${m.stock_nuevo}</div>
      </div>
    </div>
  `).join('');
}

// ── Escáner rápido del dashboard ──────────────────────────
function setupQuickScan() {
  const input = document.getElementById('quick-scan-input');
  const feedback = document.getElementById('scan-feedback');

  input?.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    const barcode = input.value.trim();
    if (!barcode) return;

    const tipo = document.getElementById('quick-scan-tipo')?.value || 'salida';
    if (feedback) feedback.textContent = '⏳ Procesando...';

    try {
      const result = await API.scan(barcode, tipo, 1);
      if (feedback) feedback.textContent = '✅ OK';
      showToast('success', `${tipo === 'salida' ? '📤 Salida' : '📥 Entrada'}`,
        `${result.data.producto.nombre} — Stock: ${result.data.movimiento.stock_nuevo}`
      );
      loadDashboardData(); // Refrescar KPIs
    } catch (err) {
      if (feedback) feedback.textContent = '❌ Error';
      showToast('error', 'Error de Escaneo', err.message);
    } finally {
      input.value = '';
      input.focus();
      setTimeout(() => { if (feedback) feedback.textContent = ''; }, 3000);
    }
  });
}

// ── UI / Auth ──────────────────────────────────────────────
function setupUI() {
  // Fecha actual
  const dateEl = document.getElementById('current-date');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  document.getElementById('btn-logout')?.addEventListener('click', logout);
  document.getElementById('login-form')?.addEventListener('submit', handleLogin);
}

function loadUserInfo() {
  const user = Auth.getUser();
  if (!user) return;
  setEl('user-name', user.nombre);
  setEl('user-rol',  user.rol);
  const av = document.getElementById('user-avatar');
  if (av) av.textContent = (user.nombre || 'U')[0].toUpperCase();
}

// ── Modal de Login ────────────────────────────────────────
function showLoginModal() {
  const overlay = document.getElementById('login-overlay');
  if (overlay) overlay.style.display = 'flex';
  setupUI();
}

async function handleLogin(e) {
  e.preventDefault();
  const email    = document.getElementById('login-email')?.value;
  const password = document.getElementById('login-password')?.value;
  const btn      = document.getElementById('login-btn');
  const errEl    = document.getElementById('login-error');

  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Ingresando...'; }
  if (errEl) errEl.style.display = 'none';

  try {
    const res = await API.login(email, password);
    Auth.setToken(res.data.token);
    Auth.setUser(res.data.usuario);

    const overlay = document.getElementById('login-overlay');
    if (overlay) overlay.style.display = 'none';

    initDashboard();
  } catch (err) {
    if (errEl) { errEl.textContent = err.message; errEl.style.display = 'block'; }
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa fa-sign-in-alt"></i> Iniciar Sesión'; }
  }
}

function logout() {
  Auth.removeToken();
  Auth.removeUser();
  window.location.reload();
}

// ── Inicializar gráficos ──────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (typeof initMovementsChart === 'function') {
    setTimeout(initMovementsChart, 500);
  }
});

// ── Helper ────────────────────────────────────────────────
function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
