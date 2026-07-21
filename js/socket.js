/**
 * socket.js — Cliente Socket.IO para actualizaciones en tiempo real
 * Maneja: alertas nuevas, movimientos, reconexión automática
 */
'use strict';

let socket = null;

function initSocket() {
  socket = io('http://localhost:3000', {
    auth: { token: Auth.getToken() },
    reconnectionAttempts: 10,
    reconnectionDelay: 2000
  });

  // ── Eventos de conexión ────────────────────────────────
  socket.on('connect', () => {
    console.log('🔌 Socket.IO conectado:', socket.id);
    socket.emit('join:dashboard');
    updateConnectionStatus(true);
  });

  socket.on('disconnect', () => {
    console.warn('⚠️ Socket.IO desconectado');
    updateConnectionStatus(false);
  });

  socket.on('connect_error', (err) => {
    console.warn('⚠️ Error de conexión Socket.IO:', err.message);
    updateConnectionStatus(false);
  });

  // ── Alerta nueva de reorden ────────────────────────────
  socket.on('alert:new', (data) => {
    console.log('🔔 Nueva alerta:', data);

    showToast('warning', '⚠️ Alerta de Stock', data.mensaje, 8000);

    // Actualizar badge de alertas en sidebar
    updateAlertBadge();

    // Actualizar lista de alertas si está visible
    if (typeof renderAlertItem === 'function') {
      renderAlertItem(data);
    }
  });

  // ── Alerta resuelta ────────────────────────────────────
  socket.on('alert:resolved', (data) => {
    const el = document.querySelector(`[data-alert-id="${data.alertId}"]`);
    if (el) {
      el.style.opacity = '0.4';
      el.querySelector('.alert-dot')?.classList.remove('dot-red', 'dot-yellow');
      el.querySelector('.alert-dot')?.classList.add('dot-gray');
    }
  });

  // ── Cron completado ────────────────────────────────────
  socket.on('inventory:cron_complete', (data) => {
    if (data.alertas_nuevas > 0) {
      showToast('info', 'Revisión de Inventario',
        `Se generaron ${data.alertas_nuevas} nueva(s) alerta(s) de stock.`
      );
      updateAlertBadge();
    }
  });

  return socket;
}

function updateConnectionStatus(connected) {
  const dot  = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  if (dot)  dot.classList.toggle('offline', !connected);
  if (text) text.textContent = connected ? 'Conectado' : 'Sin conexión';
}

async function updateAlertBadge() {
  try {
    const res = await API.getAlertCount();
    const count = res.data.count;
    const badges = document.querySelectorAll('#alert-badge');
    badges.forEach(b => {
      if (count > 0) {
        b.textContent = count;
        b.style.display = 'inline-flex';
      } else {
        b.style.display = 'none';
      }
    });
  } catch (err) { /* silencioso */ }
}

function getSocket() { return socket; }
