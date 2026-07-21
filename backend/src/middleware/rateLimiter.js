'use strict';

const rateLimit = require('express-rate-limit');

// Rate limiter general para la API
exports.apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 500,
  message: { success: false, message: 'Demasiadas solicitudes. Intenta en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter para el endpoint del scanner (más permisivo, es HID)
// Un operador puede escanear hasta 120 items/min = 1800/15min
exports.scannerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  message: { success: false, message: 'Límite de escaneos excedido.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter estricto para autenticación (anti-brute force)
exports.authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { success: false, message: 'Demasiados intentos de login. Intenta en 15 minutos.' }
});
