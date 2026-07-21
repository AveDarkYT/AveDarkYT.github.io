'use strict';

const mongoose = require('mongoose');
const { ALERT_TYPES } = require('../config/constants');

const alertSchema = new mongoose.Schema({
  producto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  tipo: {
    type: String,
    enum: Object.values(ALERT_TYPES),
    required: true
  },
  mensaje: {
    type: String,
    required: true,
    trim: true
  },
  stock_actual: {
    type: Number,
    required: true
  },
  punto_reorden: {
    type: Number,
    required: true
  },
  leida: {
    type: Boolean,
    default: false,
    index: true
  },
  resuelta: {
    type: Boolean,
    default: false
  },
  resuelta_por: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  resuelta_en: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  versionKey: false
});

alertSchema.index({ leida: 1, createdAt: -1 });
alertSchema.index({ producto: 1, resuelta: 1 });

module.exports = mongoose.model('Alert', alertSchema);
