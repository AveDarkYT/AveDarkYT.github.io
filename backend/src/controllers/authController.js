'use strict';

const User = require('../models/User');
const jwt  = require('jsonwebtoken');

const signToken = (id) => jwt.sign(
  { id },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
);

// POST /api/auth/register
exports.register = async (req, res, next) => {
  try {
    const { nombre, email, password, rol } = req.body;
    const usuario = await User.create({ nombre, email, password, rol });
    const token   = signToken(usuario._id);
    return res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      data: { token, usuario: { id: usuario._id, nombre, email, rol: usuario.rol } }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'El email ya está registrado' });
    }
    next(error);
  }
};

// POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email y contraseña son requeridos' });
    }

    const usuario = await User.findOne({ email, activo: true }).select('+password');
    if (!usuario || !(await usuario.verificarPassword(password))) {
      return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }

    await User.findByIdAndUpdate(usuario._id, { ultimo_acceso: new Date() });
    const token = signToken(usuario._id);

    return res.json({
      success: true,
      message: '¡Bienvenido!',
      data: {
        token,
        usuario: {
          id:    usuario._id,
          nombre: usuario.nombre,
          email:  usuario.email,
          rol:    usuario.rol
        }
      }
    });
  } catch (error) { next(error); }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  return res.json({ success: true, data: req.user });
};
