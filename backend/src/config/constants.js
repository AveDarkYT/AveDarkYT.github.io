'use strict';

module.exports = {
  // Tipos de movimiento
  MOVEMENT_TYPES: {
    ENTRADA:  'entrada',
    SALIDA:   'salida',
    AJUSTE:   'ajuste',
    DEVOLUCION: 'devolucion',
    TRANSFERENCIA: 'transferencia'
  },

  // Roles de usuario
  ROLES: {
    ADMIN:    'admin',
    OPERADOR: 'operador',
    AUDITOR:  'auditor'
  },

  // Tipos de alerta
  ALERT_TYPES: {
    STOCK_BAJO:    'stock_bajo',
    STOCK_CRITICO: 'stock_critico',
    SIN_STOCK:     'sin_stock',
    SOBRESTOCK:    'sobrestock'
  },

  // Formatos de código de barras soportados
  BARCODE_FORMATS: ['EAN-13', 'EAN-8', 'CODE-39', 'CODE-128', 'QR', 'UPC-A', 'UPC-E'],

  // Umbrales de alerta
  THRESHOLDS: {
    CRITICO: 0.25,  // 25% del punto de reorden = crítico
    BAJO:    1.0    // En el punto de reorden = bajo
  }
};
