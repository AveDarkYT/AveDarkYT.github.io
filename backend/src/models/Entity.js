'use strict';

const mongoose = require('mongoose');

const entitySchema = new mongoose.Schema({
  company_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['Cliente', 'Proveedor', 'Ambos'],
    required: true
  },
  name: {
    type: String,
    required: [true, 'El nombre es requerido'],
    trim: true
  },
  tax_id: {
    type: String,
    trim: true
  },
  contact: {
    email: { type: String, trim: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true }
  },
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  versionKey: false
});

// Indice compuesto para evitar duplicados por compañía
entitySchema.index({ company_id: 1, tax_id: 1 }, { unique: true, partialFilterExpression: { tax_id: { $type: "string" } } });

module.exports = mongoose.model('Entity', entitySchema);
