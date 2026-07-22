'use strict';

const mongoose = require('mongoose');

const warehouseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    default: 'main', // main, secondary, storage, etc.
    trim: true
  },
  status: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  versionKey: false
});

warehouseSchema.index({ createdBy: 1 });

module.exports = mongoose.model('Warehouse', warehouseSchema);
