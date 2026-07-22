'use strict';

require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { errorHandler } = require('./middleware/errorHandler');

// ── Rutas ─────────────────────────────────────
const authRoutes      = require('./routes/auth');
const productRoutes   = require('./routes/products');
const inventoryRoutes = require('./routes/inventory');
const movementRoutes  = require('./routes/movements');
const scannerRoutes   = require('./routes/scanner');
const alertRoutes     = require('./routes/alerts');
const dispatchRoutes  = require('./routes/dispatch');
const orderRoutes     = require('./routes/orders');
const entityRoutes    = require('./routes/entities');
const categoryRoutes  = require('./routes/categories');
const brandRoutes     = require('./routes/brands');
const unitRoutes      = require('./routes/units');
const dashboardRoutes = require('./routes/dashboard');

const app = express();

// ── Seguridad y CORS ──────────────────────────
app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost:3001',
    'https://avedarkyt.github.io', // Permitir GitHub Pages
    'null' // Para abrir archivos locales directamente
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ── Parsers ───────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Logger ────────────────────────────────────
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ── Health check ──────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    app: 'Sistema de Inventario de Almacén',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ── Rutas de la API ───────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/products',  productRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/movements', movementRoutes);
app.use('/api/scanner',   scannerRoutes);   // ⚡ Endpoint optimizado
app.use('/api/alerts',    alertRoutes);
app.use('/api/dispatch',  dispatchRoutes);
app.use('/api/orders',    orderRoutes);
app.use('/api/entities',  entityRoutes);
app.use('/api/categories',categoryRoutes);
app.use('/api/brands',    brandRoutes);
app.use('/api/units',     unitRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/imports',   require('./routes/imports'));
app.use('/api/transfers', require('./routes/transfers'));

// ── Frontend ────────────────────────────────────
app.use(express.static(path.join(__dirname, '../../frontend')));

// ── Ruta 404 ──────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta no encontrada: ${req.originalUrl}`
  });
});

// ── Manejador de errores global ───────────────
app.use(errorHandler);

module.exports = app;
