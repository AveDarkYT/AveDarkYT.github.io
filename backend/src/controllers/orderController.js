'use strict';

const Order = require('../models/Order');

exports.createOrder = async (req, res) => {
  try {
    const order = new Order(req.body);
    // order.created_by = req.user.id; // asumiendo auth middleware
    await order.save();
    res.status(201).json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.find().populate('entity_id').populate('items.product_id');
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
