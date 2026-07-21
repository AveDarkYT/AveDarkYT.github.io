'use strict';

const mongoose = require('mongoose');
const Inventory = require('../models/Inventory');
const Movement = require('../models/Movement');

exports.transferStock = async (req, res) => {
  const { product_id, source_location_id, dest_location_id, quantity, user_id } = req.body;

  if (!product_id || !source_location_id || !dest_location_id || !quantity) {
    return res.status(400).json({ success: false, message: 'Faltan parámetros requeridos' });
  }

  // Iniciar una sesión para transacción ACID
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Buscar inventario origen
    const sourceInventory = await Inventory.findOne({ 
      producto: product_id, 
      // location_id: source_location_id // (Asumiendo que Inventory tiene location_id)
    }).session(session);

    if (!sourceInventory || sourceInventory.cantidad_disponible < quantity) {
      throw new Error('Stock insuficiente en la ubicación de origen');
    }

    // 2. Buscar o crear inventario destino
    let destInventory = await Inventory.findOne({
      producto: product_id,
      // location_id: dest_location_id
    }).session(session);

    if (!destInventory) {
      destInventory = new Inventory({
        producto: product_id,
        cantidad_disponible: 0,
        // location_id: dest_location_id
      });
    }

    // 3. Registrar snapshots para el log de movimientos (inmutable)
    const sourceStockBefore = sourceInventory.cantidad_disponible;
    const destStockBefore = destInventory.cantidad_disponible;

    // 4. Actualizar cantidades
    sourceInventory.cantidad_disponible -= quantity;
    destInventory.cantidad_disponible += quantity;

    await sourceInventory.save({ session });
    await destInventory.save({ session });

    // 5. Registrar Movimientos (Salida de Origen y Entrada en Destino)
    const movementOut = new Movement({
      producto: product_id,
      tipo: 'Salida', // o 'Transferencia'
      cantidad: quantity,
      stock_anterior: sourceStockBefore,
      stock_nuevo: sourceInventory.cantidad_disponible,
      usuario: user_id || mongoose.Types.ObjectId(), // mockup user
      notas: `Transferencia a ubicación ${dest_location_id}`
    });

    const movementIn = new Movement({
      producto: product_id,
      tipo: 'Entrada', // o 'Transferencia'
      cantidad: quantity,
      stock_anterior: destStockBefore,
      stock_nuevo: destInventory.cantidad_disponible,
      usuario: user_id || mongoose.Types.ObjectId(),
      notas: `Transferencia desde ubicación ${source_location_id}`
    });

    await movementOut.save({ session });
    await movementIn.save({ session });

    // 6. Confirmar transacción
    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ success: true, message: 'Transferencia completada exitosamente' });

  } catch (error) {
    // Revertir transacción si algo falla
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ success: false, message: error.message });
  }
};
