'use strict';

const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
// const { protect } = require('../middleware/auth'); // Opcional por ahora

router.route('/')
  .post(orderController.createOrder)
  .get(orderController.getOrders);

module.exports = router;
