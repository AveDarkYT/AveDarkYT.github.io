'use strict';

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/inventario_almacen';

const options = {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4
};

async function connectDB() {
  try {
    const conn = await mongoose.connect(MONGODB_URI, options);

    console.log(`✅ MongoDB conectado: ${conn.connection.host}`);
    console.log(`   📂 Base de datos: ${conn.connection.name}`);

    // Eventos de conexión
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB desconectado. Intentando reconectar...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconectado exitosamente.');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ Error de MongoDB:', err.message);
    });

    return conn;
  } catch (error) {
    console.error('❌ No se pudo conectar a MongoDB:', error.message);
    console.error('   Asegúrate de que MongoDB esté corriendo en: ' + MONGODB_URI);
    throw error;
  }
}

module.exports = connectDB;
