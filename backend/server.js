'use strict';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const connectDB = require('./src/config/database');
const { initSocket } = require('./src/services/socketService');
const { startAlertCronJob } = require('./src/services/alertService');

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // 1. Conectar a MongoDB
    await connectDB();

    // 2. Crear servidor HTTP
    const server = http.createServer(app);

    // 3. Inicializar Socket.IO
    initSocket(server);

    // 4. Iniciar cron job de alertas (cada 5 minutos)
    startAlertCronJob();

    // 5. Escuchar en el puerto configurado
    server.listen(PORT, () => {
      console.log('╔══════════════════════════════════════════════╗');
      console.log('║   🏭  SISTEMA DE INVENTARIO DE ALMACÉN       ║');
      console.log('╠══════════════════════════════════════════════╣');
      console.log(`║  🚀 Servidor corriendo en puerto: ${PORT}        ║`);
      console.log(`║  📦 Base de datos: MongoDB Local             ║`);
      console.log(`║  ⚡ Scanner API:  /api/scanner/scan          ║`);
      console.log(`║  🔔 Alertas:      Activadas (cron 5 min)     ║`);
      console.log('╚══════════════════════════════════════════════╝');
    });

    // 6. Manejo de errores no capturados
    process.on('unhandledRejection', (err) => {
      console.error('❌ Error no capturado:', err.message);
      server.close(() => process.exit(1));
    });

  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error.message);
    process.exit(1);
  }
}

startServer();
