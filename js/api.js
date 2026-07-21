/**
 * api.js — Cliente API centralizado
 * Maneja autenticación JWT, base URL y métodos HTTP
 */
'use strict';

const API_BASE = 'https://avedarkyt-github-io.onrender.com/api';

// ── Token JWT ─────────────────────────────────────────────
const Auth = {
  getToken:    () => localStorage.getItem('inv_token'),
  setToken:    (t) => localStorage.setItem('inv_token', t),
  removeToken: () => localStorage.removeItem('inv_token'),
  getUser:     () => {
    try { return JSON.parse(localStorage.getItem('inv_user')); }
    catch { return null; }
  },
  setUser:     (u) => localStorage.setItem('inv_user', JSON.stringify(u)),
  removeUser:  () => localStorage.removeItem('inv_user'),
  isLoggedIn:  () => !!localStorage.getItem('inv_token')
};

// ── Fetch base con manejo de errores ──────────────────────
async function apiFetch(endpoint, options = {}) {
  const token = Auth.getToken();
  const defaultHeaders = { 'Content-Type': 'application/json' };
  if (token) defaultHeaders['Authorization'] = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: { ...defaultHeaders, ...(options.headers || {}) }
    });
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      showToast('warning', 'Conectando...', 'Conectando con el servidor, por favor espere unos segundos...', 10000);
      throw new Error('Servidor despertando o desconectado. Espere un momento.');
    }
    throw err;
  }

  const data = await response.json();

  if (!response.ok) {
    // Token expirado → logout automático
    if (response.status === 401) {
      Auth.removeToken();
      Auth.removeUser();
      
      const isPagesDir = window.location.pathname.includes('/pages/');
      const indexPath = isPagesDir ? '../index.html' : 'index.html';
      
      // Solo recargar si ya estamos en index.html, de lo contrario ir allá
      if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
        window.location.reload();
      } else {
        window.location.href = indexPath;
      }
    }
    throw new Error(data.message || `Error ${response.status}`);
  }

  return data;
}

// ── API Endpoints ─────────────────────────────────────────
const API = {
  // Auth
  login:    (email, password) =>
    apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  getMe: () => apiFetch('/auth/me'),

  // Inventario
  getInventorySummary: () => apiFetch('/inventory/summary'),
  getLowStock:         () => apiFetch('/inventory/low-stock'),
  getInventory:        (params = '') => apiFetch(`/inventory?${params}`),

  // Productos
  getProducts:  (params = '') => apiFetch(`/products?${params}`),
  getProduct:   (id) => apiFetch(`/products/${id}`),
  createProduct: (data) => apiFetch('/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id, data) => apiFetch(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProduct: (id) => apiFetch(`/products/${id}`, { method: 'DELETE' }),

  // Movimientos
  getMovements:   (params = '') => apiFetch(`/movements?${params}`),
  getStats:       () => apiFetch('/movements/stats'),
  procesarSalida: (data) => apiFetch('/movements/salida',  { method: 'POST', body: JSON.stringify(data) }),
  procesarEntrada:(data) => apiFetch('/movements/entrada', { method: 'POST', body: JSON.stringify(data) }),
  ajustarStock:   (data) => apiFetch('/movements/ajuste',  { method: 'POST', body: JSON.stringify(data) }),

  // Scanner ⚡
  scan:   (barcode, tipo, cantidad = 1) =>
    apiFetch('/scanner/scan', { method: 'POST', body: JSON.stringify({ barcode, tipo, cantidad }) }),
  lookup: (barcode) => apiFetch(`/scanner/lookup/${barcode}`),

  // Alertas
  getAlerts:    (params = '') => apiFetch(`/alerts?${params}`),
  getAlertCount:() => apiFetch('/alerts/count'),
  marcarLeida:  (id) => apiFetch(`/alerts/${id}/read`,    { method: 'PATCH' }),
  resolverAlerta:(id) => apiFetch(`/alerts/${id}/resolve`, { method: 'PATCH' })
};

// ── Toast / Notificaciones ────────────────────────────────
function showToast(tipo, titulo, mensaje, duracion = 5000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = { success: '✅', warning: '⚠️', error: '❌', info: 'ℹ️' };
  const toast  = document.createElement('div');
  toast.className = `toast toast-${tipo}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[tipo] || 'ℹ️'}</span>
    <div class="toast-msg">
      <div class="toast-title">${titulo}</div>
      <div>${mensaje || ''}</div>
    </div>
  `;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duracion);
}

// ── Utilidades de UI ──────────────────────────────────────
function formatDate(date) {
  return new Date(date).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'hace un momento';
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `hace ${hrs}h`;
  return `hace ${Math.floor(hrs / 24)}d`;
}

function getStockClass(stock, reorden) {
  if (stock === 0) return 'danger';
  if (stock <= reorden * 0.25) return 'danger';
  if (stock <= reorden) return 'warn';
  return 'ok';
}
