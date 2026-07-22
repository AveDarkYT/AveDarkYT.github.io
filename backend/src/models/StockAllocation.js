'use strict';

const mongoose = require('mongoose');

const stockAllocationSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Product',
    required: true
  },
  warehouseId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Warehouse',
    required: true
  },
  quantity: {
    type: Number,
    default: 0
  },
  reservedQuantity: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  versionKey: false
});

stockAllocationSchema.index({ productId: 1, warehouseId: 1 }, { unique: true });
stockAllocationSchema.index({ productId: 1 });
stockAllocationSchema.index({ warehouseId: 1 });

module.exports = mongoose.model('StockAllocation', stockAllocationSchema);
