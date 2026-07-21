'use strict';

const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const { scannerLimiter } = require('../middleware/rateLimiter');
const ctrl = require('../controllers/scannerController');

// ⚡ Endpoint principal del scanner — optimizado para HID
// Rate limiter exclusivo (permite alta velocidad de escaneo)
router.post('/scan',        protect, scannerLimiter, ctrl.scan);
router.get('/lookup/:barcode', protect, ctrl.lookup);

module.exports = router;
