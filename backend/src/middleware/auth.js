'use strict';

const jwt  = require('jsonwebtoken');
const User = require('../models/User');

// Middleware de autenticación JWT
exports.protect = async (req, res, next) => {
  try {
    let token;
    const auth = req.headers.authorization;

    if (auth && auth.startsWith('Bearer ')) {
      token = auth.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No estás autenticado. Por favor inicia sesión.'
      });
    }

    const secret = process.env.JWT_SECRET || 'clave-secreta-inventariopro-12345';
    const decoded = jwt.verify(token, secret);
    const usuario = await User.findById(decoded.id).select('-password');

    if (!usuario || !usuario.activo) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no encontrado o inactivo'
      });
    }

    req.user = usuario;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Token inválido' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expirado. Por favor inicia sesión nuevamente.' });
    }
    next(error);
  }
};

// Middleware de autorización por rol
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({
        success: false,
        message: `Acceso denegado. Se requiere rol: ${roles.join(' o ')}`
      });
    }
    next();
  };
};
