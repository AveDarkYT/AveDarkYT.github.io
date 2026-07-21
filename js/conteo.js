'use strict';

let allInventory = [];
let modifications = {}; // { product_id: new_stock }

document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.isLoggedIn()) {
    window.location.href = '../index.html';
    return;
  }
  
  const user = Auth.getUser();
  if (user) {
    document.getElementById('user-name').textContent = user.nombre || '-';
    document.getElementById('user-rol').textContent  = user.rol    || '-';
    document.getElementById('user-avatar').textContent = (user.nombre || 'U')[0].toUpperCase();
  }

  loadInventory();

  document.getElementById('search-input').addEventListener('input', (e) => {
    filterTable(e.target.value);
  });

  document.getElementById('btn-aplicar-ajustes').addEventListener('click', applyAdjustments);
  document.getElementById('btn-logout').addEventListener('click', () => {
    Auth.removeToken();
    Auth.removeUser();
    window.location.href = '../index.html';
  });
});

async function loadInventory() {
  try {
    const res = await apiFetch('/inventory?limit=1000');
    if (res.success) {
      allInventory = res.data;
      renderTable(allInventory);
    }
  } catch (err) {
    console.error('Error cargando inventario:', err);
    showToast('error', 'Error', 'No se pudo cargar el inventario.');
  }
}

function renderTable(items) {
  const tbody = document.getElementById('conteo-body');
  tbody.innerHTML = '';

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center">No se encontraron productos.</td></tr>`;
    return;
  }

  items.forEach(item => {
    const p = item.producto;
    const cat = p.categoria?.nombre || '-';
    const sysStock = item.cantidad_disponible;
    
    // Si ya hay una modificación no guardada, mostrarla
    const physicalValue = modifications[p._id] !== undefined ? modifications[p._id] : '';
    const diff = physicalValue !== '' ? physicalValue - sysStock : 0;
    
    let diffHtml = '<span class="difference-zero">-</span>';
    if (diff > 0) diffHtml = `<span class="difference-positive">+${diff}</span>`;
    if (diff < 0) diffHtml = `<span class="difference-negative">${diff}</span>`;

    const isChanged = physicalValue !== '' && diff !== 0;

    const tr = document.createElement('tr');
    if (isChanged) tr.className = 'row-changed';
    
    tr.innerHTML = `
      <td style="font-family:monospace; color:var(--text-secondary);">${p.sku}</td>
      <td><strong>${p.nombre}</strong></td>
      <td>${cat}</td>
      <td style="text-align:center; font-size:1.1rem;">${sysStock}</td>
      <td style="text-align:center;">
        <input type="number" class="input-fisico" data-id="${p._id}" data-sys="${sysStock}" value="${physicalValue}" min="0">
      </td>
      <td style="text-align:center;" class="diff-cell">${diffHtml}</td>
    `;
    tbody.appendChild(tr);
  });

  // Attach event listeners to inputs
  document.querySelectorAll('.input-fisico').forEach(input => {
    input.addEventListener('input', handleInput);
  });
}

function handleInput(e) {
  const input = e.target;
  const prodId = input.getAttribute('data-id');
  const sysStock = parseInt(input.getAttribute('data-sys'), 10);
  const val = input.value.trim();

  const tr = input.closest('tr');
  const diffCell = tr.querySelector('.diff-cell');

  if (val === '') {
    delete modifications[prodId];
    diffCell.innerHTML = '<span class="difference-zero">-</span>';
    tr.classList.remove('row-changed');
    return;
  }

  const physical = parseInt(val, 10);
  if (isNaN(physical) || physical < 0) return;

  modifications[prodId] = physical;
  const diff = physical - sysStock;

  if (diff > 0) {
    diffCell.innerHTML = `<span class="difference-positive">+${diff}</span>`;
    tr.classList.add('row-changed');
  } else if (diff < 0) {
    diffCell.innerHTML = `<span class="difference-negative">${diff}</span>`;
    tr.classList.add('row-changed');
  } else {
    diffCell.innerHTML = '<span class="difference-zero">0</span>';
    tr.classList.remove('row-changed');
    delete modifications[prodId]; // No hay ajuste que hacer
  }
}

function filterTable(query) {
  query = query.toLowerCase();
  const filtered = allInventory.filter(item => {
    const name = item.producto.nombre.toLowerCase();
    const sku = item.producto.sku.toLowerCase();
    return name.includes(query) || sku.includes(query);
  });
  renderTable(filtered);
}

async function applyAdjustments() {
  const keys = Object.keys(modifications);
  if (keys.length === 0) {
    showToast('info', 'Sin cambios', 'No hay diferencias de stock para ajustar.');
    return;
  }

  if (!confirm(`Se ajustarán ${keys.length} productos en la base de datos. ¿Estás seguro?`)) return;

  const btn = document.getElementById('btn-aplicar-ajustes');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

  let successCount = 0;
  let errorCount = 0;

  // Enviar los ajustes 1 por 1 al endpoint existente
  // (Para inventories enormes sería mejor un endpoint bulk, pero esto funciona bien para la mayoría de casos)
  for (const prodId of keys) {
    const nuevoStock = modifications[prodId];
    try {
      const res = await apiFetch('/movements/ajuste', {
        method: 'POST',
        body: JSON.stringify({
          producto_id: prodId,
          nuevo_stock: nuevoStock,
          notas: 'Ajuste por Conteo Físico (Auditoría)'
        })
      });
      if (res.success) successCount++;
      else errorCount++;
    } catch (err) {
      console.error(err);
      errorCount++;
    }
  }

  showToast(errorCount === 0 ? 'success' : 'warning', 'Ajustes Completados', 
    `Éxito: ${successCount} | Errores: ${errorCount}`);
  
  // Limpiar modificaciones y recargar
  modifications = {};
  await loadInventory();

  btn.disabled = false;
  btn.innerHTML = '<i class="fas fa-save"></i> Aplicar Ajustes';
}
