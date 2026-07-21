'use strict';

const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  requested_qty: {
    type: Number,
    required: true,
    min: 1
  },
  received_qty: {
    type: Number,
    default: 0,
    min: 0
  },
  unit_cost: {
    type: Number,
    required: true,
    min: 0
  }
});

const orderSchema = new mongoose.Schema({
  company_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  location_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location'
  },
  entity_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Entity',
    required: true
  },
  type: {
    type: String,
    enum: ['Compra', 'Venta'],
    required: true
  },
  status: {
    type: String,
    enum: ['Borrador', 'Aprobado', 'En Tránsito', 'Recibido', 'Cancelado'],
    default: 'Borrador'
  },
  order_number: {
    type: String,
    required: true,
    trim: true
  },
  items: [orderItemSchema],
  expected_date: {
    type: Date
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  versionKey: false
});

orderSchema.index({ company_id: 1, order_number: 1 }, { unique: true });

module.exports = mongoose.model('Order', orderSchema);
