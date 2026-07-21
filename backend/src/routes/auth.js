'use strict';

const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const authCtrl = require('../controllers/authController');

router.post('/register', authLimiter, authCtrl.register);
router.post('/login',    authLimiter, authCtrl.login);
router.get('/me',        protect,     authCtrl.getMe);

module.exports = router;
