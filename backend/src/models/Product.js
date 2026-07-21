'use strict';

const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  company_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    // Opcional temporalmente para compatibilidad con datos existentes
  },
  sku: {
    type: String,
    required: [true, 'El SKU es requerido'],
    unique: true,
    uppercase: true,
    trim: true,
    maxlength: [50, 'El SKU no puede superar 50 caracteres']
  },
  nombre: {
    type: String,
    required: [true, 'El nombre del producto es requerido'],
    trim: true,
    maxlength: [200, 'El nombre no puede superar 200 caracteres']
  },
  descripcion: {
    type: String,
    trim: true,
    maxlength: [1000, 'La descripción no puede superar 1000 caracteres']
  },
  categoria: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'La categoría es requerida']
  },
  // ── Ubicación física en el almacén ────────────
  ubicacion: {
    pasillo:    { type: String, uppercase: true, trim: true },
    estante:    { type: String, uppercase: true, trim: true },
    nivel:      { type: String, uppercase: true, trim: true },
    posicion:   { type: String, uppercase: true, trim: true },
    descripcion_completa: { type: String, trim: true }
  },
  // ── Identificación ────────────────────────────
  codigo_barras: {
    type: String,
    trim: true,
    index: true  // Índice para búsquedas rápidas del scanner
  },
  formato_barras: {
    type: String,
    enum: ['EAN-13', 'EAN-8', 'CODE-39', 'CODE-128', 'QR', 'UPC-A', 'UPC-E', 'OTRO'],
    default: 'EAN-13'
  },
  // ── Precios ───────────────────────────────────
  precio_costo: {
    type: Number,
    default: 0,
    min: [0, 'El precio no puede ser negativo']
  },
  precio_venta: {
    type: Number,
    default: 0,
    min: [0, 'El precio no puede ser negativo']
  },
  // ── Proveedor ─────────────────────────────────
  proveedor: {
    nombre:   { type: String, trim: true },
    contacto: { type: String, trim: true },
    codigo:   { type: String, trim: true }
  },
  // ── Imagen ────────────────────────────────────
  imagen_url: {
    type: String,
    trim: true
  },
  // ── Estado ───────────────────────────────────
  activo: {
    type: Boolean,
    default: true
  },
  unidad_medida: {
    type: String,
    default: 'unidad',
    trim: true
  }
}, {
  timestamps: true,
  versionKey: false
});

// ── Índices compuestos para búsquedas rápidas ──
productSchema.index({ sku: 1 }, { unique: true });
productSchema.index({ codigo_barras: 1 });
productSchema.index({ categoria: 1, activo: 1 });
productSchema.index({ nombre: 'text', descripcion: 'text', sku: 'text' });

module.exports = mongoose.model('Product', productSchema);
