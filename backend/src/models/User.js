'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../config/constants');

const userSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: [true, 'El nombre es requerido'],
    trim: true,
    maxlength: [100, 'El nombre no puede superar 100 caracteres']
  },
  email: {
    type: String,
    required: [true, 'El email es requerido'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'El email no es válido']
  },
  password: {
    type: String,
    required: [true, 'La contraseña es requerida'],
    minlength: [6, 'La contraseña debe tener al menos 6 caracteres'],
    select: false   // No incluir en queries por defecto
  },
  rol: {
    type: String,
    enum: {
      values: Object.values(ROLES),
      message: 'Rol inválido: {VALUE}'
    },
    default: ROLES.OPERADOR
  },
  activo: {
    type: Boolean,
    default: true
  },
  ultimo_acceso: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  versionKey: false
});

// ── Hash de contraseña antes de guardar ────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ── Método: verificar contraseña ──────────────────────────
userSchema.methods.verificarPassword = async function (passwordIngresado) {
  return await bcrypt.compare(passwordIngresado, this.password);
};

userSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema);
