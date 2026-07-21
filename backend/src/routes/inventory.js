'use strict';

const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/inventoryController');

router.use(protect);
router.get('/',          ctrl.obtenerInventario);
router.get('/summary',   ctrl.resumen);
router.get('/low-stock', ctrl.stockBajo);

const { restrictTo } = require('../middleware/auth');
router.post('/ajuste', restrictTo('admin', 'operador'), ctrl.ajuste);

module.exports = router;
