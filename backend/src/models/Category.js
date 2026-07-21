'use strict';

const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: [true, 'El nombre de la categoría es requerido'],
    trim: true,
    maxlength: [100, 'El nombre no puede superar 100 caracteres']
  },
  codigo: {
    type: String,
    required: [true, 'El código de categoría es requerido'],
    unique: true,
    uppercase: true,
    trim: true,
    maxlength: [10, 'El código no puede superar 10 caracteres']
  },
  descripcion: {
    type: String,
    trim: true,
    maxlength: [500, 'La descripción no puede superar 500 caracteres']
  },
  activo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  versionKey: false
});

categorySchema.index({ codigo: 1 }, { unique: true });

module.exports = mongoose.model('Category', categorySchema);
