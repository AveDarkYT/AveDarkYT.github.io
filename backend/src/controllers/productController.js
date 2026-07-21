'use strict';

const Product   = require('../models/Product');
const Category  = require('../models/Category');
const Inventory = require('../models/Inventory');

// GET /api/products
exports.obtenerTodos = async (req, res, next) => {
  try {
    const {
      page = 1, limit = 20,
      categoria, busqueda, activo = true
    } = req.query;

    const filtro = { activo: activo === 'false' ? false : true };
    if (categoria) filtro.categoria = categoria;
    if (busqueda)  filtro.$text = { $search: busqueda };

    const skip     = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = Math.min(parseInt(limit), 100);

    const [productos, total] = await Promise.all([
      Product.find(filtro)
        .populate('categoria', 'nombre codigo')
        .sort({ nombre: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Product.countDocuments(filtro)
    ]);

    // Enriquecer con datos de inventario
    const ids = productos.map(p => p._id);
    const inventarios = await Inventory.find({ producto: { $in: ids } })
      .select('producto cantidad_disponible punto_reorden')
      .lean();

    const invMap = inventarios.reduce((acc, inv) => {
      acc[inv.producto.toString()] = inv;
      return acc;
    }, {});

    const resultado = productos.map(p => ({
      ...p,
      inventario: invMap[p._id.toString()] || { cantidad_disponible: 0 },
      alerta_reorden: invMap[p._id.toString()]
        ? invMap[p._id.toString()].cantidad_disponible <= invMap[p._id.toString()].punto_reorden
        : false
    }));

    return res.json({
      success: true,
      data: resultado,
      paginacion: {
        total,
        pagina: parseInt(page),
        limite: limitNum,
        total_paginas: Math.ceil(total / limitNum)
      }
    });
  } catch (error) { next(error); }
};

// GET /api/products/:id
exports.obtenerPorId = async (req, res, next) => {
  try {
    const producto = await Product.findById(req.params.id)
      .populate('categoria', 'nombre codigo');
    if (!producto) return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    const inventario = await Inventory.findOne({ producto: producto._id });
    return res.json({ success: true, data: { producto, inventario } });
  } catch (error) { next(error); }
};

// POST /api/products
exports.crear = async (req, res, next) => {
  try {
    const producto = await Product.create(req.body);
    // Crear registro de inventario inicial
    await Inventory.create({
      producto:           producto._id,
      cantidad_disponible: req.body.stock_inicial || 0,
      punto_reorden:      req.body.punto_reorden  || 10,
      stock_maximo:       req.body.stock_maximo   || 1000
    });
    return res.status(201).json({
      success: true,
      message: 'Producto creado exitosamente',
      data: producto
    });
  } catch (error) { next(error); }
};

// PUT /api/products/:id
exports.actualizar = async (req, res, next) => {
  try {
    const { punto_reorden, stock_maximo, ...productoData } = req.body;
    const producto = await Product.findByIdAndUpdate(req.params.id, productoData, { new: true, runValidators: true });
    if (!producto) return res.status(404).json({ success: false, message: 'Producto no encontrado' });

    if (punto_reorden !== undefined || stock_maximo !== undefined) {
      const update = {};
      if (punto_reorden !== undefined) update.punto_reorden = punto_reorden;
      if (stock_maximo !== undefined)  update.stock_maximo  = stock_maximo;
      await Inventory.findOneAndUpdate({ producto: producto._id }, { $set: update });
    }

    return res.json({ success: true, message: 'Producto actualizado', data: producto });
  } catch (error) { next(error); }
};

// DELETE /api/products/:id  (soft delete)
exports.eliminar = async (req, res, next) => {
  try {
    await Product.findByIdAndUpdate(req.params.id, { activo: false });
    return res.json({ success: true, message: 'Producto desactivado correctamente' });
  } catch (error) { next(error); }
};

// GET /api/products/:id/historial-compras
exports.obtenerHistorialCompras = async (req, res, next) => {
  try {
    const mongoose = require('mongoose');
    const Order = require('../models/Order');
    const productId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: 'ID de producto inválido' });
    }

    const historial = await Order.aggregate([
      // 1. Filtrar solo Órdenes de 'Compra' completadas que contengan nuestro producto
      { $match: { 
          type: 'Compra', 
          status: 'Recibido', 
          'items.product_id': new mongoose.Types.ObjectId(productId) 
      } },
      
      // 2. Desglosar el array de items y quedarnos solo con el producto en cuestión
      { $unwind: '$items' },
      { $match: { 'items.product_id': new mongoose.Types.ObjectId(productId) } },

      // 3. Hacer un "SQL JOIN" (lookup) con la tabla de Entidades (Proveedores)
      {
        $lookup: {
          from: 'entities', // nombre de la colección en minúsculas y plural
          localField: 'entity_id',
          foreignField: '_id',
          as: 'proveedor'
        }
      },
      { $unwind: { path: '$proveedor', preserveNullAndEmptyArrays: true } },
      
      // 4. Ordenar cronológicamente (más reciente primero)
      { $sort: { createdAt: -1 } },
      
      // 5. Proyectar (Seleccionar) columnas
      {
        $project: {
          _id: 1,
          numero_documento: '$order_number',
          fecha_emision: '$expected_date',
          fecha_registro: '$createdAt',
          proveedor_nombre: { $ifNull: ['$proveedor.name', 'Proveedor Desconocido'] },
          proveedor_id: '$proveedor._id',
          cantidad: '$items.received_qty',
          costo_unitario: '$items.unit_cost',
          tipo: '$type'
        }
      }
    ]);

    // Calcular KPIs
    let ultima_compra = null;
    let proveedor_frecuente = null;
    let variacion_costo = 0;

    if (historial.length > 0) {
      ultima_compra = historial[0];
      
      if (historial.length > 1) {
        const penultima = historial[1];
        if (penultima.costo_unitario > 0) {
          variacion_costo = ((ultima_compra.costo_unitario - penultima.costo_unitario) / penultima.costo_unitario) * 100;
        }
      }

      // Frecuencia
      const freqMap = {};
      historial.forEach(h => {
        const pName = h.proveedor_nombre;
        freqMap[pName] = (freqMap[pName] || 0) + 1;
      });
      let maxFreq = 0;
      for (const [nombre, count] of Object.entries(freqMap)) {
        if (count > maxFreq) {
          maxFreq = count;
          proveedor_frecuente = { nombre, conteo: count };
        }
      }
    }

    return res.json({ 
      success: true, 
      data: {
        historial,
        kpis: {
          ultima_compra,
          variacion_costo,
          proveedor_frecuente
        }
      }
    });
  } catch (error) { next(error); }
};

