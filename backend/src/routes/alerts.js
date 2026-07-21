'use strict';

const express = require('express');
const router  = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const ctrl = require('../controllers/alertController');

router.use(protect);
router.get('/',              ctrl.obtenerAlertas);
router.get('/count',         ctrl.contarNoLeidas);
router.patch('/:id/read',    ctrl.marcarLeida);
router.patch('/:id/resolve', restrictTo('admin', 'operador'), ctrl.resolverAlerta);

module.exports = router;
