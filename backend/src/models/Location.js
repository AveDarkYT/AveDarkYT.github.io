'use strict';

const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  company_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'El nombre del almacén/ubicación es requerido'],
    trim: true
  },
  type: {
    type: String,
    enum: ['Bodega Principal', 'Sucursal', 'Punto de Venta'],
    default: 'Bodega Principal'
  },
  address: {
    type: String,
    trim: true
  },
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  versionKey: false
});

module.exports = mongoose.model('Location', locationSchema);
