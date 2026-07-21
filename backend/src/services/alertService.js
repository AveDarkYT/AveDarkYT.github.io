'use strict';

/**
 * ══════════════════════════════════════════════════════════════
 *  ALERT SERVICE — Sistema de Alertas Automáticas de Reorden
 *
 *  Este servicio se ejecuta en dos modos:
 *  1. Puntual: invocado después de cada movimiento de salida
 *  2. Periódico: cron job cada 5 minutos para revisión completa
 * ══════════════════════════════════════════════════════════════
 */

const cron     = require('node-cron');
const Alert    = require('../models/Alert');
const Inventory = require('../models/Inventory');
const { emitToAll } = require('./socketService');
const { ALERT_TYPES } = require('../config/constants');

// ─────────────────────────────────────────────────────────────
// 🔔  VERIFICAR Y GENERAR ALERTA PARA UN PRODUCTO ESPECÍFICO
// Llamado después de cada salida (no bloqueante)
// ─────────────────────────────────────────────────────────────
async function checkAndGenerateAlerts(productoId, productoNombre, stockActual, puntoReorden) {
  try {
    // Determinar el tipo de alerta según la gravedad
    let tipoAlerta  = null;
    let mensaje     = '';

    if (stockActual === 0) {
      tipoAlerta = ALERT_TYPES.SIN_STOCK;
      mensaje    = `⛔ SIN STOCK: "${productoNombre}" (SKU) está completamente agotado. Requiere reabastecimiento urgente.`;
    } else if (stockActual <= puntoReorden * 0.25) {
      tipoAlerta = ALERT_TYPES.STOCK_CRITICO;
      mensaje    = `🔴 STOCK CRÍTICO: "${productoNombre}" tiene solo ${stockActual} unidades (punto de reorden: ${puntoReorden}).`;
    } else if (stockActual <= puntoReorden) {
      tipoAlerta = ALERT_TYPES.STOCK_BAJO;
      mensaje    = `🟡 STOCK BAJO: "${productoNombre}" alcanzó su punto de reorden (${stockActual}/${puntoReorden} unidades).`;
    }

    // Si no hay alerta necesaria, no hacer nada
    if (!tipoAlerta) return null;

    // Verificar si ya existe una alerta activa del mismo tipo para evitar duplicados
    const alertaExistente = await Alert.findOne({
      producto:  productoId,
      tipo:      tipoAlerta,
      resuelta:  false,
      // Solo duplicar si el stock cambió (es un problema diferente)
      createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) } // Última hora
    });

    if (alertaExistente) return null;

    // Crear la nueva alerta
    const nuevaAlerta = await Alert.create({
      producto:      productoId,
      tipo:          tipoAlerta,
      mensaje,
      stock_actual:  stockActual,
      punto_reorden: puntoReorden
    });

    // Marcar el inventario para evitar re-procesar
    await Inventory.findOneAndUpdate(
      { producto: productoId },
      { $set: { alerta_generada: true } }
    );

    // 📡 Emitir evento en tiempo real vía Socket.IO
    emitToAll('alert:new', {
      id:           nuevaAlerta._id,
      tipo:         tipoAlerta,
      mensaje,
      producto_id:  productoId,
      producto_nombre: productoNombre,
      stock_actual: stockActual,
      punto_reorden: puntoReorden,
      timestamp:    nuevaAlerta.createdAt
    });

    console.log(`🔔 Alerta generada [${tipoAlerta}]: ${productoNombre} - Stock: ${stockActual}`);
    return nuevaAlerta;

  } catch (error) {
    console.error('❌ Error en checkAndGenerateAlerts:', error.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// ⏰  CRON JOB — Revisión completa del inventario (cada 5 min)
// Detecta productos que llegaron a punto de reorden sin que
// haya habido un movimiento reciente (por ejemplo, ajustes manuales)
// ─────────────────────────────────────────────────────────────
async function revisarInventarioCompleto() {
  try {
    console.log('⏰ Cron: Revisando inventario completo...');

    // Traer todos los registros donde stock ≤ punto_reorden
    // y que no tengan alerta activa reciente
    const inventariosCriticos = await Inventory.aggregate([
      {
        $match: {
          $expr: { $lte: ['$cantidad_disponible', '$punto_reorden'] }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: 'producto',
          foreignField: '_id',
          as: 'producto_data'
        }
      },
      { $unwind: '$producto_data' },
      { $match: { 'producto_data.activo': true } },
      {
        $project: {
          producto:          '$producto_data._id',
          nombre:            '$producto_data.nombre',
          cantidad_disponible: 1,
          punto_reorden:     1
        }
      }
    ]);

    let alertasGeneradas = 0;

    for (const item of inventariosCriticos) {
      const alerta = await checkAndGenerateAlerts(
        item.producto,
        item.nombre,
        item.cantidad_disponible,
        item.punto_reorden
      );
      if (alerta) alertasGeneradas++;
    }

    if (alertasGeneradas > 0) {
      console.log(`✅ Cron: ${alertasGeneradas} alerta(s) nueva(s) generadas.`);
      // Emitir resumen del cron a todos los dashboards
      emitToAll('inventory:cron_complete', {
        alertas_nuevas: alertasGeneradas,
        timestamp: new Date()
      });
    } else {
      console.log('✅ Cron: Sin nuevas alertas. Inventario en buen estado.');
    }

  } catch (error) {
    console.error('❌ Error en cron de inventario:', error.message);
  }
}

// ─────────────────────────────────────────────────────────────
// ▶️  INICIAR EL CRON JOB
// ─────────────────────────────────────────────────────────────
function startAlertCronJob() {
  // Ejecutar cada 5 minutos
  cron.schedule('*/5 * * * *', revisarInventarioCompleto, {
    scheduled: true,
    timezone: 'America/Santiago'  // Ajustar a tu zona horaria
  });

  console.log('⏰ Cron de alertas de inventario iniciado (cada 5 minutos)');
}

module.exports = {
  checkAndGenerateAlerts,
  revisarInventarioCompleto,
  startAlertCronJob
};
