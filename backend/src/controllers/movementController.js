'use strict';

/**
 * ══════════════════════════════════════════════════════════════
 *  MOVEMENT CONTROLLER — Controlador Principal de Movimientos
 *  Gestiona: Salidas de equipos, Entradas, Ajustes de stock
 *  con auditoría completa y alertas automáticas de reorden.
 * ══════════════════════════════════════════════════════════════
 */

const mongoose = require('mongoose');
const Movement  = require('../models/Movement');
const Inventory = require('../models/Inventory');
const Product   = require('../models/Product');
const { checkAndGenerateAlerts } = require('../services/alertService');
const { MOVEMENT_TYPES } = require('../config/constants');

// ─────────────────────────────────────────────────────────────
// 📤  PROCESAR SALIDA DE EQUIPO DEL ALMACÉN
// POST /api/movements/salida
// ─────────────────────────────────────────────────────────────
/**
 * Registra una salida de equipo. Usa transacción MongoDB para garantizar
 * atomicidad: el descuento del stock y el registro del movimiento
 * siempre ocurren juntos o no ocurren.
 */
exports.procesarSalida = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      producto_id,
      cantidad,
      referencia,
      destinatario,
      notas,
      codigo_barras,
      via_scanner = false
    } = req.body;

    const usuario_id = req.user._id;

    // ── 1. Verificar que el producto existe ───────────────────
    const producto = await Product.findById(producto_id)
      .select('nombre sku activo')
      .session(session);

    if (!producto) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    if (!producto.activo) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `El producto "${producto.nombre}" está inactivo`
      });
    }

    // ── 2. Buscar inventario y bloquear el documento (con sesión) ─
    const inventario = await Inventory.findOne({ producto: producto_id }).session(session);

    if (!inventario) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Registro de inventario no encontrado para este producto'
      });
    }

    // ── 3. Validar stock disponible ───────────────────────────
    if (inventario.cantidad_disponible < cantidad) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: `Stock insuficiente. Disponible: ${inventario.cantidad_disponible}, Solicitado: ${cantidad}`,
        data: {
          disponible: inventario.cantidad_disponible,
          solicitado: cantidad,
          diferencia: cantidad - inventario.cantidad_disponible
        }
      });
    }

    const stockAnterior = inventario.cantidad_disponible;

    // ── 4. Descontar stock (operación atómica con $inc) ──────
    //       Nunca calculamos en memoria, dejamos MongoDB hacerlo
    const inventarioActualizado = await Inventory.findOneAndUpdate(
      {
        _id: inventario._id,
        cantidad_disponible: { $gte: cantidad } // Guard condition
      },
      {
        $inc: { cantidad_disponible: -cantidad },
        $set: { ultima_salida: new Date() }
      },
      {
        new: true,         // Retorna el documento actualizado
        session,
        runValidators: true
      }
    );

    // Si el guard falló (race condition), rechazar la transacción
    if (!inventarioActualizado) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: 'No se pudo procesar: stock insuficiente (conflicto de concurrencia)'
      });
    }

    // ── 5. Crear el registro del movimiento (auditoría) ──────
    const [movimiento] = await Movement.create([{
      producto:      producto_id,
      tipo:          MOVEMENT_TYPES.SALIDA,
      cantidad,
      stock_anterior: stockAnterior,
      stock_nuevo:   inventarioActualizado.cantidad_disponible,
      usuario:       usuario_id,
      codigo_barras: codigo_barras || null,
      via_scanner,
      referencia:    referencia || {},
      destinatario:  destinatario || {},
      notas:         notas || ''
    }], { session });

    // ── 6. Confirmar transacción ─────────────────────────────
    await session.commitTransaction();

    // ── 7. Verificar alertas de reorden (fuera de la transacción) ─
    //       Esto es no-bloqueante: si falla, no afecta la salida
    setImmediate(() => {
      checkAndGenerateAlerts(
        producto_id,
        producto.nombre,
        inventarioActualizado.cantidad_disponible,
        inventarioActualizado.punto_reorden
      ).catch(err => console.error('Error en verificación de alertas:', err));
    });

    // ── 8. Respuesta exitosa ─────────────────────────────────
    return res.status(201).json({
      success: true,
      message: `✅ Salida registrada: ${cantidad} unidad(es) de "${producto.nombre}"`,
      data: {
        movimiento: {
          id:            movimiento._id,
          tipo:          movimiento.tipo,
          cantidad,
          stock_anterior: stockAnterior,
          stock_nuevo:   inventarioActualizado.cantidad_disponible,
          timestamp:     movimiento.createdAt
        },
        alerta_reorden: inventarioActualizado.necesitaReorden()
      }
    });

  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

// ─────────────────────────────────────────────────────────────
// 📥  PROCESAR ENTRADA / RECEPCIÓN DE MERCANCÍA
// POST /api/movements/entrada
// ─────────────────────────────────────────────────────────────
exports.procesarEntrada = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      producto_id,
      cantidad,
      referencia,
      notas,
      codigo_barras,
      via_scanner = false
    } = req.body;

    const usuario_id = req.user._id;

    const producto = await Product.findById(producto_id)
      .select('nombre sku activo')
      .session(session);

    if (!producto || !producto.activo) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado o inactivo'
      });
    }

    // Crear inventario si no existe (primer ingreso del producto)
    let inventario = await Inventory.findOne({ producto: producto_id }).session(session);
    if (!inventario) {
      [inventario] = await Inventory.create(
        [{ producto: producto_id, cantidad_disponible: 0, punto_reorden: 10 }],
        { session }
      );
    }

    const stockAnterior = inventario.cantidad_disponible;

    const inventarioActualizado = await Inventory.findOneAndUpdate(
      { _id: inventario._id },
      {
        $inc: { cantidad_disponible: cantidad },
        $set: {
          ultima_entrada: new Date(),
          alerta_generada: false  // Reset: el reabastecimiento resuelve la alerta
        }
      },
      { new: true, session, runValidators: true }
    );

    const [movimiento] = await Movement.create([{
      producto: producto_id,
      tipo:     MOVEMENT_TYPES.ENTRADA,
      cantidad,
      stock_anterior: stockAnterior,
      stock_nuevo:   inventarioActualizado.cantidad_disponible,
      usuario:       usuario_id,
      codigo_barras: codigo_barras || null,
      via_scanner,
      referencia:    referencia || {},
      notas:         notas || ''
    }], { session });

    await session.commitTransaction();

    return res.status(201).json({
      success: true,
      message: `✅ Entrada registrada: ${cantidad} unidad(es) de "${producto.nombre}"`,
      data: {
        movimiento: {
          id:            movimiento._id,
          tipo:          movimiento.tipo,
          cantidad,
          stock_anterior: stockAnterior,
          stock_nuevo:   inventarioActualizado.cantidad_disponible,
          timestamp:     movimiento.createdAt
        }
      }
    });

  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

// ─────────────────────────────────────────────────────────────
// 📋  HISTORIAL DE MOVIMIENTOS
// GET /api/movements
// Query params: producto, tipo, usuario, desde, hasta, page, limit
// ─────────────────────────────────────────────────────────────
exports.obtenerHistorial = async (req, res, next) => {
  try {
    const {
      producto,
      tipo,
      usuario,
      desde,
      hasta,
      page  = 1,
      limit = 20
    } = req.query;

    // ── Construir filtro dinámico ─────────────────────────────
    const filtro = {};
    if (producto) filtro.producto = producto;
    if (tipo)     filtro.tipo     = tipo;
    if (usuario)  filtro.usuario  = usuario;

    if (desde || hasta) {
      filtro.createdAt = {};
      if (desde) filtro.createdAt.$gte = new Date(desde);
      if (hasta) filtro.createdAt.$lte = new Date(hasta);
    }

    const skip     = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = Math.min(parseInt(limit), 100); // Máx 100 por página

    const [movimientos, total] = await Promise.all([
      Movement.find(filtro)
        .populate('producto', 'nombre sku codigo_barras')
        .populate('usuario',  'nombre email rol')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Movement.countDocuments(filtro)
    ]);

    return res.json({
      success: true,
      data: movimientos,
      paginacion: {
        total,
        pagina:       parseInt(page),
        limite:       limitNum,
        total_paginas: Math.ceil(total / limitNum),
        tiene_mas:    skip + limitNum < total
      }
    });

  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// 🔧  AJUSTE MANUAL DE STOCK (solo admin)
// POST /api/movements/ajuste
// ─────────────────────────────────────────────────────────────
exports.ajustarStock = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { producto_id, nuevo_stock, notas } = req.body;
    const usuario_id = req.user._id;

    const inventario = await Inventory.findOne({ producto: producto_id }).session(session);
    if (!inventario) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Inventario no encontrado' });
    }

    const stockAnterior = inventario.cantidad_disponible;
    const diferencia    = nuevo_stock - stockAnterior;

    await Inventory.findOneAndUpdate(
      { _id: inventario._id },
      { $set: { cantidad_disponible: nuevo_stock } },
      { session }
    );

    await Movement.create([{
      producto:      producto_id,
      tipo:          MOVEMENT_TYPES.AJUSTE,
      cantidad:      Math.abs(diferencia),
      stock_anterior: stockAnterior,
      stock_nuevo:   nuevo_stock,
      usuario:       usuario_id,
      notas:         notas || `Ajuste manual: de ${stockAnterior} a ${nuevo_stock}`
    }], { session });

    await session.commitTransaction();

    return res.status(200).json({
      success: true,
      message: `Stock ajustado: ${stockAnterior} → ${nuevo_stock}`,
      data: { stock_anterior: stockAnterior, stock_nuevo: nuevo_stock, diferencia }
    });

  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

// ─────────────────────────────────────────────────────────────
// 📊  RESUMEN / ESTADÍSTICAS DEL DÍA
// GET /api/movements/stats
// ─────────────────────────────────────────────────────────────
exports.obtenerEstadisticas = async (req, res, next) => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    const stats = await Movement.aggregate([
      {
        $match: { createdAt: { $gte: hoy, $lt: manana } }
      },
      {
        $group: {
          _id:    '$tipo',
          count:  { $sum: 1 },
          total:  { $sum: '$cantidad' }
        }
      }
    ]);

    const resultado = {
      entradas:   { count: 0, total: 0 },
      salidas:    { count: 0, total: 0 },
      ajustes:    { count: 0, total: 0 },
      devoluciones: { count: 0, total: 0 }
    };

    stats.forEach(s => {
      if (resultado[s._id + 's']) {
        resultado[s._id + 's'] = { count: s.count, total: s.total };
      }
    });

    return res.json({
      success: true,
      data: { ...resultado, fecha: hoy }
    });

  } catch (error) {
    next(error);
  }
};
