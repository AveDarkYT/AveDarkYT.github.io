const Order = require('../models/Order');
const Product = require('../models/Product');
const Entity = require('../models/Entity');
const Inventory = require('../models/Inventory');

exports.getDashboardStats = async (req, res) => {
  try {
    // Ingresos Totales: Sum of total_amount from orders of type 'sale' that are completed
    const ingresosAggr = await Order.aggregate([
      { $match: { type: 'sale', status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$total_amount' } } }
    ]);
    const totalIngresos = ingresosAggr.length > 0 ? ingresosAggr[0].total : 0;

    // Productos en Stock: Count unique products in inventory that have physical_quantity > 0
    const stockAggr = await Inventory.aggregate([
      { $group: { _id: '$product_id', totalStock: { $sum: '$physical_quantity' } } },
      { $match: { totalStock: { $gt: 0 } } },
      { $count: 'inStock' }
    ]);
    const productosEnStock = stockAggr.length > 0 ? stockAggr[0].inStock : 0;

    // Órdenes Pendientes: Count orders of type 'sale' that are pending
    const ordenesPendientes = await Order.countDocuments({ type: 'sale', status: 'pending' });

    // Proveedores Activos
    const proveedoresActivos = await Entity.countDocuments({ type: { $in: ['Proveedor', 'Ambos'] }, active: true });

    // Recent Products
    const recentProducts = await Product.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('category_id brand_id');

    // Mapear el inventario para recent products
    const recentProductsWithStock = await Promise.all(recentProducts.map(async (prod) => {
      const invs = await Inventory.find({ product_id: prod._id });
      const totalStock = invs.reduce((sum, i) => sum + i.physical_quantity, 0);
      return {
        _id: prod._id,
        name: prod.name,
        sku: prod.sku,
        stock: totalStock,
        status: totalStock > 10 ? 'In Stock' : totalStock > 0 ? 'Low Stock' : 'Out of Stock'
      };
    }));

    // Recent Suppliers
    const recentSuppliers = await Entity.find({ type: { $in: ['Proveedor', 'Ambos'] } })
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      success: true,
      data: {
        kpis: {
          totalIngresos,
          productosEnStock,
          ordenesPendientes,
          proveedoresActivos
        },
        recentProducts: recentProductsWithStock,
        recentSuppliers
      }
    });

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ success: false, message: 'Error fetching dashboard stats', error: error.message });
  }
};
