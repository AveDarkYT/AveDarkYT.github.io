const API_URL = 'http://localhost:3000/api';
const token = localStorage.getItem('token');

if (!token) window.location.href = '../index.html';

document.addEventListener('DOMContentLoaded', loadConduces);

async function loadConduces() {
  try {
    const res = await fetch(`${API_URL}/dispatch`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    
    if (data.success) {
      renderTable(data.data);
    }
  } catch (error) {
    console.error('Error cargando conduces:', error);
  }
}

function renderTable(conduces) {
  const tbody = document.getElementById('conducesTableBody');
  tbody.innerHTML = '';

  conduces.forEach(c => {
    const totalItems = c.items.reduce((sum, item) => sum + item.cantidad, 0);
    const date = new Date(c.createdAt).toLocaleString();
    const badge = c.estado === 'Borrador' ? 'badge-borrador' : 'badge-completado';
    
    // Si está completado, puede imprimir. Si es borrador, puede cerrarlo o seguir escaneando.
    let actions = `<button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.8rem;" onclick="imprimirConduce('${c._id}')"><i class="fas fa-print"></i></button>`;
    
    if (c.estado === 'Borrador') {
      actions += ` <button class="btn btn-primary" style="padding: 4px 8px; font-size: 0.8rem; background:var(--success-color);" onclick="cerrarConduce('${c._id}')"><i class="fas fa-check"></i> Cerrar</button>`;
    }

    tbody.innerHTML += `
      <tr>
        <td style="font-weight:bold; color:var(--primary-color)">${c.numero_conduce}</td>
        <td>${c.cliente}</td>
        <td>${date}</td>
        <td>${totalItems} unids.</td>
        <td><span class="${badge}">${c.estado}</span></td>
        <td>${c.creado_por?.nombre || 'N/A'}</td>
        <td>${actions}</td>
      </tr>
    `;
  });
}

// Modal Logic
function openModal() {
  document.getElementById('newNoteModal').classList.add('active');
}
function closeModal() {
  document.getElementById('newNoteModal').classList.remove('active');
}

document.getElementById('newNoteForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const cliente = document.getElementById('clienteName').value;
  const empleado = document.getElementById('empleadoName').value;
  const orden_servicio = document.getElementById('ordenServicio').value;
  const direccion = document.getElementById('direccion').value;
  const brigada = document.getElementById('brigada').value;
  const placa = document.getElementById('placa').value;
  const tipo_trabajo = document.getElementById('tipoTrabajo').value;
  const notas = document.getElementById('notasConduce').value;

  try {
    const res = await fetch(`${API_URL}/dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        cliente, empleado, orden_servicio, direccion, brigada, placa, tipo_trabajo, notas 
      })
    });
    const data = await res.json();
    
    if (data.success) {
      // Redirigir al escaner y pasarle el ID del conduce
      window.location.href = `scanner.html?conduce=${data.data._id}`;
    } else {
      alert('Error creando conduce: ' + data.message);
    }
  } catch (err) {
    console.error(err);
    alert('Error de conexión');
  }
});

async function cerrarConduce(id) {
  if(!confirm('¿Estás seguro de cerrar este conduce? Ya no se podrán agregar más productos.')) return;
  try {
    const res = await fetch(`${API_URL}/dispatch/${id}/close`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if(data.success) {
      loadConduces(); // Recargar tabla
    } else {
      alert(data.message);
    }
  } catch(err) {
    console.error(err);
  }
}

function imprimirConduce(id) {
  window.open(`print-conduce.html?id=${id}`, '_blank');
}

document.getElementById('btnLogout').addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '../index.html';
});
