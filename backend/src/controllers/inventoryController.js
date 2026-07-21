'use strict';

const Inventory = require('../models/Inventory');
const Category = require('../models/Category');
const Product   = require('../models/Product');

// GET /api/inventory — Lista inventario completo con datos de producto
exports.obtenerInventario = async (req, res, next) => {
  try {
    const { alerta, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let pipeline = [
      {
        $lookup: {
          from: 'products',
          localField: 'producto',
          foreignField: '_id',
          as: 'producto_data'
        }
      },
      { $unwind: '$producto_data' },
      { $match: { 'producto_data.activo': true } }
    ];

    // Filtrar solo productos con alerta de reorden
    if (alerta === 'true') {
      pipeline.push({
        $match: {
          $expr: { $lte: ['$cantidad_disponible', '$punto_reorden'] }
        }
      });
    }

    pipeline.push(
      { $sort: { cantidad_disponible: 1 } },
      { $skip: skip },
      { $limit: parseInt(limit) },
      {
        $project: {
          producto:           '$producto_data',
          cantidad_disponible: 1,
          cantidad_reservada:  1,
          punto_reorden:       1,
          stock_maximo:        1,
          ultima_entrada:      1,
          ultima_salida:       1,
          alerta_reorden: {
            $lte: ['$cantidad_disponible', '$punto_reorden']
          }
        }
      }
    );

    const inventario = await Inventory.aggregate(pipeline);
    const total = await Inventory.countDocuments();

    return res.json({
      success: true,
      data: inventario,
      paginacion: { total, pagina: parseInt(page), limite: parseInt(limit) }
    });
  } catch (error) { next(error); }
};

// GET /api/inventory/low-stock — Productos bajo el punto de reorden
exports.stockBajo = async (req, res, next) => {
  try {
    const resultado = await Inventory.aggregate([
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
          as: 'producto'
        }
      },
      { $unwind: '$producto' },
      { $match: { 'producto.activo': true } },
      {
        $addFields: {
          urgencia: {
            $cond: {
              if: { $eq: ['$cantidad_disponible', 0] },
              then: 'sin_stock',
              else: {
                $cond: {
                  if: { $lte: ['$cantidad_disponible', { $multiply: ['$punto_reorden', 0.25] }] },
                  then: 'critico',
                  else: 'bajo'
                }
              }
            }
          }
        }
      },
      { $sort: { cantidad_disponible: 1 } }
    ]);

    return res.json({ success: true, data: resultado, total: resultado.length });
  } catch (error) { next(error); }
};

// GET /api/inventory/summary — Resumen general del almacén
exports.resumen = async (req, res, next) => {
  try {
    const [resumen] = await Inventory.aggregate([
      {
        $group: {
          _id: null,
          total_productos: { $sum: 1 },
          total_unidades:  { $sum: '$cantidad_disponible' },
          sin_stock:       { $sum: { $cond: [{ $eq: ['$cantidad_disponible', 0] }, 1, 0] } },
          stock_critico:   {
            $sum: {
              $cond: [
                { $and: [
                  { $gt: ['$cantidad_disponible', 0] },
                  { $lte: ['$cantidad_disponible', { $multiply: ['$punto_reorden', 0.25] }] }
                ]},
                1, 0
              ]
            }
          },
          bajo_reorden: {
            $sum: {
              $cond: [{ $lte: ['$cantidad_disponible', '$punto_reorden'] }, 1, 0]
            }
          }
        }
      }
    ]);

    return res.json({ success: true, data: resumen || {} });
  } catch (error) { next(error); }
};

// POST /api/inventory/ajuste ?" Ajuste manual de inventario
exports.ajuste = async (req, res, next) => {
  try {
    const { producto_id, nueva_cantidad, ubicacion, motivo } = req.body;
    
    if (nueva_cantidad === undefined || nueva_cantidad < 0) {
      return res.status(400).json({ success: false, message: 'La nueva cantidad es inválida' });
    }
    if (!motivo) {
      return res.status(400).json({ success: false, message: 'Se requiere un motivo para el ajuste' });
    }

    const inventory = await Inventory.findOne({ producto: producto_id });
    if (!inventory) {
      return res.status(404).json({ success: false, message: 'Registro de inventario no encontrado' });
    }

    const cantidadAnterior = inventory.cantidad_disponible;
    const diferencia = nueva_cantidad - cantidadAnterior;

    // Actualizar inventario
    inventory.cantidad_disponible = nueva_cantidad;
    if (diferencia > 0) inventory.ultima_entrada = new Date();
    if (diferencia < 0) inventory.ultima_salida = new Date();
    await inventory.save();

    // Registrar en el historial inmutable (Movement)
    const Movement = require('../models/Movement');
    const movimiento = await Movement.create({
      company_id: req.user.company_id || '000000000000000000000000',
      type: 'Ajuste',
      reference: `Ajuste: ${motivo}`,
      origin: ubicacion || 'Almacén Principal',
      destination: ubicacion || 'Almacén Principal',
      status: 'Completado',
      items: [{
        product_id: producto_id,
        quantity: Math.abs(diferencia)
      }],
      created_by: req.user._id,
      notes: `Ajuste de inventario. Anterior: ${cantidadAnterior}, Nuevo: ${nueva_cantidad}, Diferencia: ${diferencia}`
    });

    return res.json({ 
      success: true, 
      message: 'Ajuste de inventario registrado correctamente', 
      data: { inventory, movimiento } 
    });
  } catch (error) { next(error); }
};
