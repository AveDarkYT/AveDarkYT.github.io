document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const nombre = document.getElementById('nombre').value;
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const errorMsg = document.getElementById('errorMsg');
  
  try {
    const res = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, email, password, rol: 'admin' })
    });
    
    const data = await res.json();
    
    if (data.success) {
      localStorage.setItem('token', data.data.token);
      localStorage.setItem('user', JSON.stringify(data.data.usuario));
      window.location.href = 'index.html';
    } else {
      errorMsg.textContent = data.message || 'Error en el registro';
    }
  } catch (error) {
    errorMsg.textContent = 'No se pudo conectar con el servidor';
  }
});
