'use strict';

const express = require('express');
const router  = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const ctrl = require('../controllers/productController');

router.use(protect);

router.get('/',    ctrl.obtenerTodos);
router.get('/:id', ctrl.obtenerPorId);
router.get('/:id/historial-compras', ctrl.obtenerHistorialCompras);
router.post('/',   restrictTo('admin', 'operador'), ctrl.crear);
router.put('/:id', restrictTo('admin', 'operador'), ctrl.actualizar);
router.delete('/:id', restrictTo('admin'),          ctrl.eliminar);

module.exports = router;
