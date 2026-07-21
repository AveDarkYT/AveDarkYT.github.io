'use strict';

const { Server } = require('socket.io');

let io = null;

// Inicializar Socket.IO con el servidor HTTP
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: [
        process.env.FRONTEND_URL || 'http://localhost:5500',
        'http://127.0.0.1:5500',
        'null'
      ],
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Cliente conectado: ${socket.id}`);

    socket.on('join:dashboard', () => {
      socket.join('dashboard');
      console.log(`📊 ${socket.id} se unió al dashboard`);
    });

    socket.on('join:scanner', () => {
      socket.join('scanner');
      console.log(`📡 ${socket.id} se unió al canal scanner`);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Cliente desconectado: ${socket.id}`);
    });
  });

  console.log('🔌 Socket.IO inicializado');
  return io;
}

// Emitir evento a todos los clientes conectados
function emitToAll(event, data) {
  if (io) {
    io.emit(event, data);
  }
}

// Emitir evento a la sala del dashboard
function emitToDashboard(event, data) {
  if (io) {
    io.to('dashboard').emit(event, data);
  }
}

function getIO() {
  if (!io) throw new Error('Socket.IO no ha sido inicializado');
  return io;
}

module.exports = { initSocket, emitToAll, emitToDashboard, getIO };
