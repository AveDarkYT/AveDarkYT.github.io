'use strict';

const mongoose = require('mongoose');
const { MOVEMENT_TYPES } = require('../config/constants');

const movementSchema = new mongoose.Schema({
  producto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'El producto es requerido'],
    index: true
  },
  tipo: {
    type: String,
    required: [true, 'El tipo de movimiento es requerido'],
    enum: {
      values: Object.values(MOVEMENT_TYPES),
      message: 'Tipo de movimiento inválido: {VALUE}'
    },
    index: true
  },
  cantidad: {
    type: Number,
    required: [true, 'La cantidad es requerida'],
    min: [1, 'La cantidad debe ser mayor a 0']
  },
  // ── Snapshot del stock antes/después del movimiento ──
  stock_anterior: {
    type: Number,
    required: true
  },
  stock_nuevo: {
    type: Number,
    required: true
  },
  // ── Trazabilidad ──────────────────────────────────────
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El usuario es requerido'],
    index: true
  },
  codigo_barras: {
    type: String,
    trim: true      // Si el movimiento fue iniciado por un scanner
  },
  via_scanner: {
    type: Boolean,
    default: false  // Indica si fue capturado mediante scanner físico
  },
  // ── Referencia del documento (orden, guía, etc.) ──────
  referencia: {
    numero:    { type: String, trim: true },
    tipo:      { type: String, trim: true },  // 'orden_compra', 'guia_despacho', etc.
    proveedor: { type: String, trim: true },
    conduce_id: { type: mongoose.Schema.Types.ObjectId, ref: 'DispatchNote' }
  },
  // ── Datos del destinatario (para salidas) ────────────
  destinatario: {
    nombre:    { type: String, trim: true },
    area:      { type: String, trim: true },
    cargo:     { type: String, trim: true },
    firma:     { type: String, trim: true }  // URL de firma o iniciales
  },
  notas: {
    type: String,
    trim: true,
    maxlength: [500, 'Las notas no pueden superar 500 caracteres']
  }
}, {
  timestamps: true,
  versionKey: false
});

// ── Índices compuestos para reportes y auditoría ──────────
movementSchema.index({ producto: 1, createdAt: -1 });
movementSchema.index({ usuario: 1, createdAt: -1 });
movementSchema.index({ tipo: 1, createdAt: -1 });
movementSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Movement', movementSchema);
