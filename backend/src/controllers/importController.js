'use strict';

const fs = require('fs');
const csv = require('csv-parser');
const Product = require('../models/Product');
const Inventory = require('../models/Inventory');

exports.importProductsCSV = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No se subió ningún archivo' });
  }

  const results = [];
  const errors = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      let successCount = 0;
      
      // Proceso secuencial para evitar sobrecargar la DB y manejar errores individuales
      for (const row of results) {
        try {
          // Asume que el CSV tiene columnas: sku, nombre, precio_venta, cantidad
          if (!row.sku || !row.nombre) continue;

          // 1. Crear o actualizar producto
          let product = await Product.findOne({ sku: row.sku });
          if (!product) {
            product = new Product({
              sku: row.sku,
              nombre: row.nombre,
              precio_venta: row.precio_venta || 0,
              // company_id: req.user.company_id // En un entorno multi-tenant real
            });
            await product.save();
          }

          // 2. Si hay cantidad, actualizar inventario principal
          if (row.cantidad) {
            let inventory = await Inventory.findOne({ producto: product._id });
            if (!inventory) {
              inventory = new Inventory({
                producto: product._id,
                cantidad_disponible: parseInt(row.cantidad, 10),
                // location_id: req.body.location_id
              });
            } else {
              inventory.cantidad_disponible += parseInt(row.cantidad, 10);
            }
            await inventory.save();
          }
          
          successCount++;
        } catch (error) {
          errors.push(`Error en SKU ${row.sku}: ${error.message}`);
        }
      }

      // Eliminar archivo temporal
      fs.unlinkSync(req.file.path);

      res.status(200).json({
        success: true,
        message: `Importación completada. Procesados: ${successCount}`,
        errors: errors.length > 0 ? errors : undefined
      });
    });
};
