'use strict';

const mongoose = require('mongoose');
const Order = require('../models/Order');
const Inventory = require('../models/Inventory');
const Product = require('../models/Product');
const Movement = require('../models/Movement');

exports.createOrder = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { tipo, entity_id, items, total, estado, reference } = req.body;
    
    // 1. Crear Orden
    const order = new Order({
      company_id: req.user?.company_id || '000000000000000000000000',
      tipo, // 'Compra' o 'Venta'
      estado: estado || 'Borrador',
      entity_id,
      items,
      total,
      created_by: req.user?._id
    });
    await order.save({ session });

    // Si está pagado/completado, actualizamos inventarios y costos
    if (order.estado === 'Pagado' || order.estado === 'Completado') {
      for (const item of items) {
        const inventory = await Inventory.findOne({ producto: item.product_id }).session(session);
        if (!inventory) {
          throw new Error(`Inventario no encontrado para el producto: ${item.product_id}`);
        }

        const product = await Product.findById(item.product_id).session(session);
        
        let stockAnterior = inventory.cantidad_disponible;
        let diff = 0;

        if (tipo === 'Compra') {
          // COMPRA: Aumenta stock, actualiza histórico de costo
          diff = item.quantity;
          inventory.cantidad_disponible += diff;
          inventory.ultima_entrada = new Date();
          
          // Actualizar costo del producto
          product.precio_costo = item.unit_price;
          await product.save({ session });

        } else if (tipo === 'Venta') {
          // VENTA: Disminuye stock
          diff = -item.quantity;
          if (inventory.cantidad_disponible < item.quantity) {
            throw new Error(`Stock insuficiente para el producto: ${product.nombre}`);
          }
          inventory.cantidad_disponible += diff;
          inventory.ultima_salida = new Date();
        }

        await inventory.save({ session });

        // Guardar registro inmutable de movimiento
        await Movement.create([{
          company_id: order.company_id,
          type: tipo === 'Compra' ? 'Entrada' : 'Salida',
          reference: reference || `Orden ${order._id}`,
          origin: tipo === 'Compra' ? 'Proveedor' : 'Almacén',
          destination: tipo === 'Compra' ? 'Almacén' : 'Cliente',
          status: 'Completado',
          items: [{
            product_id: item.product_id,
            quantity: Math.abs(diff)
          }],
          created_by: req.user?._id,
          notes: `${tipo} procesada. Anterior: ${stockAnterior}, Nuevo: ${inventory.cantidad_disponible}`
        }], { session });
      }
    }

    await session.commitTransaction();
    res.status(201).json({ success: true, data: order, message: `${tipo} registrada exitosamente` });
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
};

exports.getOrders = async (req, res, next) => {
  try {
    const { tipo } = req.query;
    const filter = {};
    if (tipo) filter.tipo = tipo;

    const orders = await Order.find(filter)
      .populate('entity_id', 'nombre tipo')
      .populate('items.product_id', 'nombre sku codigo_barras')
      .populate('created_by', 'nombre')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('entity_id', 'nombre contacto tipo email')
      .populate('items.product_id', 'nombre sku precio_venta')
      .populate('created_by', 'nombre email');
    
    if (!order) return res.status(404).json({ success: false, message: 'Orden no encontrada' });
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
