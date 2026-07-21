'use strict';

/**
 * ══════════════════════════════════════════════════════════════
 *  SCANNER CONTROLLER — Endpoint Optimizado para Escáneres
 *  Objetivo: Tiempo de respuesta < 50ms por escaneo.
 *
 *  Soporta:
 *  - Lectores HID (tipo teclado, emulación Enter)
 *  - EAN-13, EAN-8, CODE-39, CODE-128, UPC-A, QR
 *  - Procesamiento de entrada O salida en un solo request
 * ══════════════════════════════════════════════════════════════
 */

const mongoose = require('mongoose');
const Product   = require('../models/Product');
const Inventory = require('../models/Inventory');
const Movement  = require('../models/Movement');
const DispatchNote = require('../models/DispatchNote');
const { validateBarcode } = require('../services/barcodeService');
const { checkAndGenerateAlerts } = require('../services/alertService');
const { MOVEMENT_TYPES } = require('../config/constants');

// ─────────────────────────────────────────────────────────────
// ⚡  ESCANEO PRINCIPAL — Búsqueda + Movimiento en un solo paso
// POST /api/scanner/scan
//
// Body: {
//   barcode: "7501234567892",
//   tipo: "salida" | "entrada",
//   cantidad: 1,                       // Opcional, default 1
//   destinatario: { nombre, area }     // Opcional, para salidas
// }
// ─────────────────────────────────────────────────────────────
exports.scan = async (req, res, next) => {
  // Capturar tiempo de inicio para métricas
  const t0 = Date.now();
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      barcode,
      tipo      = MOVEMENT_TYPES.SALIDA,
      cantidad  = 1,
      destinatario,
      conduce_id
    } = req.body;

    const usuario_id = req.user._id;

    // ── 1. Validar formato del código de barras ───────────────
    const formatoValido = validateBarcode(barcode);
    if (!formatoValido.valid) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Código de barras inválido: ${formatoValido.reason}`,
        latency_ms: Date.now() - t0
      });
    }

    // ── 2. Buscar producto por código de barras (índice) ─────
    //    El índice en codigo_barras garantiza O(log n) lookup
    const producto = await Product
      .findOne({ codigo_barras: barcode, activo: true })
      .select('_id nombre sku codigo_barras ubicacion')
      .lean()          // .lean() es significativamente más rápido que documentos Mongoose
      .session(session);

    if (!producto) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: `Producto no encontrado para el código: ${barcode}`,
        barcode,
        latency_ms: Date.now() - t0
      });
    }

    // ── 3. Obtener inventario (con bloqueo de sesión) ─────────
    const inventario = await Inventory
      .findOne({ producto: producto._id })
      .session(session);

    if (!inventario) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'No se encontró registro de inventario para este producto'
      });
    }

    // ── 4. Aplicar movimiento según tipo ─────────────────────
    let inventarioActualizado;
    const stockAnterior = inventario.cantidad_disponible;

    if (tipo === MOVEMENT_TYPES.SALIDA) {
      // ── SALIDA: Verificar stock y descontar atómicamente ───
      if (inventario.cantidad_disponible < cantidad) {
        await session.abortTransaction();
        return res.status(409).json({
          success: false,
          message: '⚠️ Stock insuficiente',
          data: {
            producto: producto.nombre,
            disponible: inventario.cantidad_disponible,
            solicitado: cantidad
          },
          latency_ms: Date.now() - t0
        });
      }

      inventarioActualizado = await Inventory.findOneAndUpdate(
        { _id: inventario._id, cantidad_disponible: { $gte: cantidad } },
        {
          $inc: { cantidad_disponible: -cantidad },
          $set: { ultima_salida: new Date() }
        },
        { new: true, session }
      );

    } else if (tipo === MOVEMENT_TYPES.ENTRADA) {
      // ── ENTRADA: Sumar al stock ────────────────────────────
      inventarioActualizado = await Inventory.findOneAndUpdate(
        { _id: inventario._id },
        {
          $inc: { cantidad_disponible: cantidad },
          $set: { ultima_entrada: new Date(), alerta_generada: false }
        },
        { new: true, session }
      );

    } else {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Tipo de movimiento inválido: "${tipo}". Use "entrada" o "salida".`
      });
    }

    // Guard: si el update falló (race condition)
    if (!inventarioActualizado) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: 'Conflicto de concurrencia. Intente nuevamente.'
      });
    }

    // ── 4.5. Actualizar Conduce (si aplica) ──────────────────
    if (conduce_id && tipo === MOVEMENT_TYPES.SALIDA) {
      const conduce = await DispatchNote.findById(conduce_id).session(session);
      if (!conduce || conduce.estado !== 'Borrador') {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: 'El conduce no es válido o ya está completado' });
      }
      
      const itemIndex = conduce.items.findIndex(i => i.producto.toString() === producto._id.toString());
      if (itemIndex > -1) {
        conduce.items[itemIndex].cantidad += cantidad;
      } else {
        conduce.items.push({ producto: producto._id, cantidad, precio_unitario: producto.precio_venta });
      }
      await conduce.save({ session });
    }

    // ── 5. Registrar movimiento en auditoría ─────────────────
    const [movimiento] = await Movement.create([{
      producto:      producto._id,
      tipo,
      cantidad,
      stock_anterior: stockAnterior,
      stock_nuevo:   inventarioActualizado.cantidad_disponible,
      usuario:       usuario_id,
      codigo_barras: barcode,
      via_scanner:   true,              // Marcado explícitamente como scanner
      destinatario:  destinatario || {},
      referencia: conduce_id ? { conduce_id } : {}
    }], { session });

    // ── 6. Confirmar transacción ──────────────────────────────
    await session.commitTransaction();

    const latency = Date.now() - t0;

    // ── 7. Alertas asíncronas (no bloquean la respuesta) ─────
    if (tipo === MOVEMENT_TYPES.SALIDA) {
      setImmediate(() => {
        checkAndGenerateAlerts(
          producto._id,
          producto.nombre,
          inventarioActualizado.cantidad_disponible,
          inventarioActualizado.punto_reorden
        ).catch(console.error);
      });
    }

    // ── 8. Respuesta ultra-rápida optimizada para UI de scanner ─
    return res.status(200).json({
      success: true,
      message: `✅ ${tipo === 'salida' ? '📤 SALIDA' : '📥 ENTRADA'} registrada`,
      data: {
        producto: {
          id:     producto._id,
          nombre: producto.nombre,
          sku:    producto.sku,
          ubicacion: producto.ubicacion
        },
        movimiento: {
          id:            movimiento._id,
          tipo,
          cantidad,
          stock_anterior: stockAnterior,
          stock_nuevo:   inventarioActualizado.cantidad_disponible
        },
        alerta_reorden: inventarioActualizado.necesitaReorden
          ? inventarioActualizado.cantidad_disponible <= inventarioActualizado.punto_reorden
          : false
      },
      latency_ms: latency   // Métrica de rendimiento en cada respuesta
    });

  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

// ─────────────────────────────────────────────────────────────
// 🔍  BUSCAR PRODUCTO POR CÓDIGO DE BARRAS (solo consulta)
// GET /api/scanner/lookup/:barcode
// ─────────────────────────────────────────────────────────────
exports.lookup = async (req, res, next) => {
  const t0 = Date.now();
  try {
    const { barcode } = req.params;

    const producto = await Product
      .findOne({ codigo_barras: barcode, activo: true })
      .populate('categoria', 'nombre codigo')
      .lean();

    if (!producto) {
      return res.status(404).json({
        success: false,
        message: `No se encontró ningún producto con el código: ${barcode}`,
        latency_ms: Date.now() - t0
      });
    }

    const inventario = await Inventory
      .findOne({ producto: producto._id })
      .select('cantidad_disponible punto_reorden stock_maximo ultima_entrada ultima_salida')
      .lean();

    return res.json({
      success: true,
      data: {
        producto,
        inventario: inventario || { cantidad_disponible: 0, punto_reorden: 0 },
        alerta_reorden: inventario
          ? inventario.cantidad_disponible <= inventario.punto_reorden
          : false
      },
      latency_ms: Date.now() - t0
    });

  } catch (error) {
    next(error);
  }
};

// GET /api/scanner/next-barcode
exports.nextBarcode = async (req, res, next) => {
  try {
    // Buscar el producto con el código de barras que empiece con P seguido de números
    const Product = require('../models/Product');
    const lastProduct = await Product.findOne({
      codigo_barras: { $regex: /^P\d{4}$/ }
    })
    .sort({ codigo_barras: -1 })
    .select('codigo_barras')
    .lean();

    let nextCode = 'P0001';
    if (lastProduct && lastProduct.codigo_barras) {
      const lastNumber = parseInt(lastProduct.codigo_barras.substring(1), 10);
      if (!isNaN(lastNumber)) {
        const newNumber = lastNumber + 1;
        // Padding con 4 ceros (ej: P0056)
        nextCode = `P${newNumber.toString().padStart(4, '0')}`;
      }
    }

    return res.json({ success: true, next_barcode: nextCode });
  } catch (error) {
    next(error);
  }
};
