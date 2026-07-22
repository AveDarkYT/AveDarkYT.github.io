const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');

// GET /api/dashboard
router.get('/', protect, dashboardController.getDashboardStats);

module.exports = router;
