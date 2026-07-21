'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');
const importController = require('../controllers/importController');

// Configuración de multer temporal
const upload = multer({ dest: 'uploads/' });

router.post('/csv', upload.single('file'), importController.importProductsCSV);

module.exports = router;
