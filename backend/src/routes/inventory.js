'use strict';

const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/inventoryController');

router.use(protect);
router.get('/',          ctrl.obtenerInventario);
router.get('/summary',   ctrl.resumen);
router.get('/low-stock', ctrl.stockBajo);

module.exports = router;
