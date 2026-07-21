'use strict';

const express = require('express');
const router  = express.Router();
const dispatchCtrl = require('../controllers/dispatchController');
const { protect }  = require('../middleware/auth');

router.use(protect);

router.get('/', dispatchCtrl.getAll);
router.get('/active', dispatchCtrl.getActive);
router.post('/', dispatchCtrl.create);
router.get('/:id', dispatchCtrl.getById);
router.put('/:id/close', dispatchCtrl.closeNote);

module.exports = router;
