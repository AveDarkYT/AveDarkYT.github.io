'use strict';

const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  producto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  cantidad: {
    type: Number,
    required: true,
    min: 1
  },
  // Opcional: Guardar el precio en el momento de la salida por si cambia después
  precio_unitario: {
    type: Number
  }
});

const dispatchNoteSchema = new mongoose.Schema({
  numero_conduce: {
    type: String,
    required: true,
    unique: true
  },
  cliente: {
    type: String,
    required: true,
    trim: true
  },
  estado: {
    type: String,
    enum: ['Borrador', 'Completado', 'Cancelado'],
    default: 'Borrador'
  },
  items: [itemSchema],
  creado_por: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  empleado: {
    type: String,
    trim: true
  },
  orden_servicio: {
    type: String,
    trim: true
  },
  direccion: {
    type: String,
    trim: true
  },
  brigada: {
    type: String,
    trim: true
  },
  placa: {
    type: String,
    trim: true
  },
  tipo_trabajo: {
    type: String,
    enum: ['Instalación', 'Avería', 'Equipo', 'Otro'],
    default: 'Otro'
  },
  notas: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Índice para búsquedas rápidas
dispatchNoteSchema.index({ numero_conduce: 1 });
dispatchNoteSchema.index({ cliente: 1 });
dispatchNoteSchema.index({ estado: 1 });

module.exports = mongoose.model('DispatchNote', dispatchNoteSchema);
