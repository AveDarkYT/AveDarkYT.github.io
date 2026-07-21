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
