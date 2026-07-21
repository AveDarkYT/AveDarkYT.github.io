'use strict';

const express = require('express');
const router  = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const ctrl = require('../controllers/movementController');

router.use(protect);

router.get('/',          ctrl.obtenerHistorial);
router.get('/stats',     ctrl.obtenerEstadisticas);
router.post('/salida',   ctrl.procesarSalida);
router.post('/entrada',  ctrl.procesarEntrada);
router.post('/ajuste',   restrictTo('admin'), ctrl.ajustarStock);

module.exports = router;
