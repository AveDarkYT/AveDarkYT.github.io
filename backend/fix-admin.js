'use strict';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

async function fixAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Conectado');
    
    let admin = await User.findOne({ email: 'admin@inventario.com' });
    if (!admin) {
      console.log('No se encontró el admin, creándolo...');
      admin = new User({
        nombre: 'Administrador',
        email: 'admin@inventario.com',
        password: 'admin1234',
        rol: 'admin'
      });
    } else {
      console.log('Admin encontrado, actualizando contraseña para forzar el hash...');
      admin.password = 'admin1234'; // Esto disparará el middleware pre('save') en Mongoose que hashea la contraseña
    }
    
    await admin.save();
    console.log('¡Cuenta de admin actualizada y contraseña encriptada correctamente!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixAdmin();
