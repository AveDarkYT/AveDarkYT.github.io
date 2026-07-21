'use strict';

const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'El nombre de la empresa es requerido'],
    trim: true
  },
  tax_id: {
    type: String,
    required: [true, 'El RNC/NIT es requerido'],
    unique: true,
    trim: true
  },
  settings: {
    currency: { type: String, default: 'USD' },
    timezone: { type: String, default: 'UTC' }
  },
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  versionKey: false
});

module.exports = mongoose.model('Company', companySchema);
