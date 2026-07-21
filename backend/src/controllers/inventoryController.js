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
