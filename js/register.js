document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const nombre = document.getElementById('nombre').value;
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const errorMsg = document.getElementById('errorMsg');
  
  try {
    // Usamos el archivo js/api.js si ya está incluido, o definimos la base
    const baseURL = typeof API_BASE !== 'undefined' ? API_BASE : 'https://avedarkyt-github-io.onrender.com/api';
    
    const res = await fetch(`${baseURL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, email, password, rol: 'admin' })
    });
    
    const data = await res.json();
    
    if (data.success) {
      localStorage.setItem('inv_token', data.data.token);
      localStorage.setItem('inv_user', JSON.stringify(data.data.usuario));
      window.location.href = 'index.html';
    } else {
      errorMsg.textContent = data.message || 'Error en el registro';
    }
  } catch (error) {
    errorMsg.textContent = 'No se pudo conectar con el servidor';
  }
});
