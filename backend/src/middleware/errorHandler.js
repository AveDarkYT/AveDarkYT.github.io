'use strict';

// Manejador de errores global de Express
exports.errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message    = err.message   || 'Error interno del servidor';

  // Errores de validación de Mongoose
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map(e => e.message).join('. ');
  }

  // Clave duplicada de MongoDB
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue)[0];
    message = `Ya existe un registro con ese ${field}: "${err.keyValue[field]}"`;
  }

  // ID de MongoDB inválido
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `ID inválido: ${err.value}`;
  }

  if (process.env.NODE_ENV === 'development') {
    console.error('❌ Error:', err);
  }

  return res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};
