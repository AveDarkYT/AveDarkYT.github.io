const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  active: { type: Boolean, default: true }
}, { timestamps: true, versionKey: false });
module.exports = mongoose.model('Brand', schema);
