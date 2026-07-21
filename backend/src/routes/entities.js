'use strict';

const express = require('express');
const router = express.Router();
const entityController = require('../controllers/entityController');

router.route('/')
  .post(entityController.createEntity)
  .get(entityController.getEntities);

module.exports = router;
