/**
 * scanner.js — Lógica del escáner de códigos de barras
 *
 * Características:
 * - Captura eventos de lectores HID (teclado-like)
 * - Detección de scanner vs. escritura manual (threshold 200ms)
 * - Auto-retorno al campo de escaneo después de cada lectura
 * - Historial de sesión con feedback visual
 */
'use strict';

// ── Estado global del escáner ──────────────────────────────
const ScannerState = {
  tipoActivo: 'salida',
  scanHistory: [],
  isScanning: false,
  barcodeBuffer: '',
  lastKeyTime: 0,
  SCAN_THRESHOLD_MS: 200  // Umbral para distinguir scanner (rápido) vs teclado (lento)
};

// ── Inicializar después de autenticación ──────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Verificar autenticación
  if (!Auth.isLoggedIn()) {
    window.location.href = '../index.html';
    return;
  }

  loadUserInfo();
  initSocket();
  await updateAlertBadge();

  // Inicializar UI del escáner
  setupTipoToggle();
  setupScanInput();
  setupGlobalBarcodeListener();
  focusScanInput();

  // Botones
  document.getElementById('btn-clear-history')?.addEventListener('click', clearHistory);
  document.getElementById('btn-logout')?.addEventListener('click', logout);
  
  // Conduce preseleccionado
  const urlParams = new URLSearchParams(window.location.search);
  const selectedConduce = urlParams.get('conduce');
  if (selectedConduce) {
    setTipo('salida');
    await loadActiveConduces(selectedConduce);
  } else {
    loadActiveConduces();
  }
});

// ── Info de usuario ────────────────────────────────────────
function loadUserInfo() {
  const user = Auth.getUser();
  if (!user) return;
  document.getElementById('user-name').textContent = user.nombre || '-';
  document.getElementById('user-rol').textContent  = user.rol    || '-';
  document.getElementById('user-avatar').textContent = (user.nombre || 'U')[0].toUpperCase();
}

// ── Toggle Salida / Entrada ────────────────────────────────
function setupTipoToggle() {
  document.getElementById('btn-tipo-salida')?.addEventListener('click', () => setTipo('salida'));
  document.getElementById('btn-tipo-entrada')?.addEventListener('click', () => setTipo('entrada'));
}

function setTipo(tipo) {
  ScannerState.tipoActivo = tipo;
  document.getElementById('btn-tipo-salida')?.classList.toggle('active', tipo === 'salida');
  document.getElementById('btn-tipo-salida')?.classList.toggle('salida', tipo === 'salida');
  document.getElementById('btn-tipo-entrada')?.classList.toggle('active', tipo === 'entrada');
  document.getElementById('btn-tipo-entrada')?.classList.toggle('entrada', tipo === 'entrada');
  
  const conduceContainer = document.getElementById('conduce-selector-container');
  if (conduceContainer) {
    conduceContainer.style.display = tipo === 'salida' ? 'block' : 'none';
  }
}

async function loadActiveConduces(selectedId = null) {
  try {
    const res = await apiFetch('/dispatch/active');
    const select = document.getElementById('conduce-select');
    if (!select || !res.data) return;
    
    // Mantener la opción vacía
    select.innerHTML = '<option value="">-- Salida Libre (Sin Conduce) --</option>';
    
    res.data.forEach(c => {
      const option = document.createElement('option');
      option.value = c._id;
      option.textContent = `[${c.numero_conduce}] - Cliente: ${c.cliente}`;
      select.appendChild(option);
    });
    
    if (selectedId) {
      select.value = selectedId;
    }
  } catch(err) {
    console.error('Error loading conduces:', err);
  }
}

// ── Campo de entrada principal ─────────────────────────────
function setupScanInput() {
  const input = document.getElementById('barcode-input-main');
  if (!input) return;

  // Enter → procesar escaneo
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const barcode = input.value.trim();
      if (barcode) processScan(barcode);
    }
  });

  // Botón manual
  document.getElementById('btn-scan-manual')?.addEventListener('click', () => {
    const barcode = input.value.trim();
    if (barcode) processScan(barcode);
    else focusScanInput();
  });
}

/**
 * Listener global en el documento para capturar el scanner HID
 * cuando el input no está enfocado. Detecta velocidad de ingreso
 * de caracteres para distinguir scanner de teclado manual.
 */
function setupGlobalBarcodeListener() {
  document.addEventListener('keypress', (e) => {
    const now = Date.now();
    const input = document.getElementById('barcode-input-main');
    const isInputFocused = document.activeElement === input;

    // Si el foco NO está en el input, capturar teclas del scanner HID
    if (!isInputFocused && e.key !== 'Enter' && e.key.length === 1) {
      const timeDiff = now - ScannerState.lastKeyTime;

      // Caracteres que llegan muy rápido = scanner (no humano)
      if (timeDiff < ScannerState.SCAN_THRESHOLD_MS || ScannerState.barcodeBuffer.length === 0) {
        ScannerState.barcodeBuffer += e.key;
        ScannerState.lastKeyTime = now;
      } else {
        // Demasiado lento → era escritura manual, limpiar buffer
        ScannerState.barcodeBuffer = e.key;
      }
    }

    // Enter recibido = el scanner terminó de emitir el código
    if (!isInputFocused && e.key === 'Enter' && ScannerState.barcodeBuffer.length > 0) {
      const barcode = ScannerState.barcodeBuffer.trim();
      ScannerState.barcodeBuffer = '';
      if (barcode.length >= 3) processScan(barcode);
    }
  });
}

// ── Procesar escaneo principal ─────────────────────────────
async function processScan(barcode) {
  if (ScannerState.isScanning) return; // Prevenir doble-escaneo
  ScannerState.isScanning = true;

  const input    = document.getElementById('barcode-input-main');
  const stage    = document.getElementById('scan-stage');
  const cantidad = parseInt(document.getElementById('cantidad-input')?.value) || 1;

  // Feedback visual: scanning
  stage?.classList.remove('active-scan', 'error-scan');

  const conduceSelect = document.getElementById('conduce-select');
  const conduce_id = ScannerState.tipoActivo === 'salida' && conduceSelect ? conduceSelect.value : null;

  try {
    const bodyPayload = {
      barcode,
      tipo: ScannerState.tipoActivo,
      cantidad
    };
    if (conduce_id) bodyPayload.conduce_id = conduce_id;

    // Use global apiFetch instead of manual fetch
    const result = await apiFetch(`/scanner/scan`, {
      method: 'POST',
      body: JSON.stringify(bodyPayload)
    });
    
    const { producto, movimiento } = result.data;

    // ── Éxito ────────────────────────────────────────────
    stage?.classList.add('active-scan');
    showScanResult(true, producto, movimiento, result.data.alerta_reorden, result.latency_ms);
    addToHistory(true, barcode, producto, movimiento);

    if (result.data.alerta_reorden) {
      showToast('warning', '⚠️ Stock Bajo', `"${producto.nombre}" ha alcanzado su punto de reorden.`);
    } else {
      showToast('success',
        ScannerState.tipoActivo === 'salida' ? '📤 Salida Registrada' : '📥 Entrada Registrada',
        `${producto.nombre} — ${movimiento.cantidad} unidad(es)`
      );
    }

  } catch (err) {
    // ── Error ────────────────────────────────────────────
    stage?.classList.add('error-scan');
    showToast('error', 'Error de Escaneo', err.message);
    addToHistory(false, barcode, null, null);
  } finally {
    // ── CRÍTICO: Siempre retornar el foco al campo de escaneo ──
    //    Esto garantiza que el lector HID siempre tenga dónde escribir
    if (input) {
      input.value = '';
      input.focus();
      input.select();
    }
    ScannerState.isScanning = false;

    // Quitar clases de estado después de 1.5s
    setTimeout(() => {
      stage?.classList.remove('active-scan', 'error-scan');
    }, 1500);
  }
}

// ── Mostrar resultado del último escaneo ──────────────────
function showScanResult(success, producto, movimiento, alertaReorden, latency) {
  const panel = document.getElementById('scan-result');
  if (!panel) return;

  panel.className = `scan-result visible ${success ? 'result-ok' : 'result-error'}`;

  if (success && producto) {
    document.getElementById('result-icon').textContent = success ? '✅' : '❌';
    document.getElementById('result-name').textContent = producto.nombre;
    document.getElementById('result-sku').textContent  = `SKU: ${producto.sku} | Código: ${movimiento ? movimiento.id : ''}`;

    const tipoBadge = document.getElementById('result-tipo-badge');
    if (tipoBadge) {
      tipoBadge.textContent  = ScannerState.tipoActivo === 'salida' ? '📤 SALIDA' : '📥 ENTRADA';
      tipoBadge.className    = `badge ${ScannerState.tipoActivo === 'salida' ? 'badge-danger' : 'badge-success'}`;
    }

    if (movimiento) {
      document.getElementById('result-stock-ant').textContent = movimiento.stock_anterior;
      document.getElementById('result-stock-new').textContent = movimiento.stock_nuevo;
      const newStockEl = document.getElementById('result-stock-new');
      if (newStockEl) {
        newStockEl.style.color = movimiento.stock_nuevo === 0 ? 'var(--accent-red)' :
          movimiento.stock_nuevo <= 10 ? 'var(--accent-yellow)' : 'var(--accent-green)';
      }
    }

    const ub = producto.ubicacion;
    document.getElementById('result-ubicacion').textContent = ub
      ? ub.descripcion_completa || `${ub.pasillo || ''}-${ub.estante || ''}-${ub.nivel || ''}`
      : 'No especificada';

    document.getElementById('result-latency').textContent = latency ? `${latency}ms` : '-';

    const alertEl = document.getElementById('result-alert');
    if (alertEl) alertEl.style.display = alertaReorden ? 'block' : 'none';
  }
}

// ── Agregar al historial de sesión ────────────────────────
function addToHistory(success, barcode, producto, movimiento) {
  const entry = { success, barcode, producto, movimiento, time: new Date() };
  ScannerState.scanHistory.unshift(entry);

  renderHistory();
  const badge = document.getElementById('scan-count-badge');
  if (badge) badge.textContent = `${ScannerState.scanHistory.length} escaneos`;
}

function renderHistory() {
  const container = document.getElementById('scan-history');
  if (!container) return;

  if (ScannerState.scanHistory.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📡</div><p>Aún no hay escaneos en esta sesión.</p></div>`;
    return;
  }

  container.innerHTML = ScannerState.scanHistory.map(entry => {
    const stockClass = entry.success && entry.movimiento
      ? getStockClass(entry.movimiento.stock_nuevo, 10)
      : 'error';
    return `
      <div class="scan-history-item">
        <span class="sh-icon">${entry.success ? (ScannerState.tipoActivo === 'salida' ? '📤' : '📥') : '❌'}</span>
        <div>
          <div class="sh-product">${entry.producto ? entry.producto.nombre : 'Código no encontrado'}</div>
          <div class="sh-barcode">${entry.barcode} · ${timeAgo(entry.time)}</div>
        </div>
        ${entry.success && entry.movimiento
          ? `<span class="sh-stock ${stockClass}">Stock: ${entry.movimiento.stock_nuevo}</span>`
          : `<span class="sh-stock error">Error</span>`
        }
      </div>
    `;
  }).join('');
}

function clearHistory() {
  ScannerState.scanHistory = [];
  renderHistory();
  const badge = document.getElementById('scan-count-badge');
  if (badge) badge.textContent = '0 escaneos';
}

function focusScanInput() {
  document.getElementById('barcode-input-main')?.focus();
}

function logout() {
  Auth.removeToken();
  Auth.removeUser();
  window.location.href = '../index.html';
}
