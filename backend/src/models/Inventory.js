'use strict';

const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  producto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    unique: true   // 1 registro de inventario por producto
  },
  // ── Stock (separado para evitar condiciones de carrera) ─
  cantidad_disponible: {
    type: Number,
    required: true,
    default: 0,
    min: [0, 'La cantidad disponible no puede ser negativa']
  },
  cantidad_reservada: {
    type: Number,
    default: 0,
    min: [0, 'La cantidad reservada no puede ser negativa']
  },
  // ── Puntos de control de stock ─────────────────────────
  punto_reorden: {
    type: Number,
    required: [true, 'El punto de reorden es requerido'],
    default: 10,
    min: [0, 'El punto de reorden no puede ser negativo']
  },
  stock_maximo: {
    type: Number,
    default: 1000,
    min: [0, 'El stock máximo no puede ser negativo']
  },
  // ── Última actualización y auditoría ───────────────────
  ultima_entrada: {
    type: Date,
    default: null
  },
  ultima_salida: {
    type: Date,
    default: null
  },
  alerta_generada: {
    type: Boolean,
    default: false    // Evita duplicar alertas ya emitidas
  }
}, {
  timestamps: true,
  versionKey: false
});

// ── Índice para consultas de stock bajo ────────────────────
inventorySchema.index({ producto: 1 }, { unique: true });
inventorySchema.index({ cantidad_disponible: 1, punto_reorden: 1 });

// ── Virtual: stock total (disponible + reservado) ──────────
inventorySchema.virtual('stock_total').get(function () {
  return this.cantidad_disponible + this.cantidad_reservada;
});

// ── Virtual: porcentaje respecto al stock máximo ───────────
inventorySchema.virtual('porcentaje_stock').get(function () {
  if (this.stock_maximo === 0) return 0;
  return Math.round((this.cantidad_disponible / this.stock_maximo) * 100);
});

// ── Método: verificar si necesita reorden ─────────────────
inventorySchema.methods.necesitaReorden = function () {
  return this.cantidad_disponible <= this.punto_reorden;
};

inventorySchema.set('toJSON', { virtuals: true });
inventorySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Inventory', inventorySchema);
