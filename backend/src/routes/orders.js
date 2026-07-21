'use strict';

const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .post(orderController.createOrder)
  .get(orderController.getOrders);

router.route('/:id')
  .get(orderController.getOrderById);

module.exports = router;
