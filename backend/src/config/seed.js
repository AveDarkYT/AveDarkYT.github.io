'use strict';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

require('dotenv').config();
const mongoose  = require('mongoose');
const bcrypt    = require('bcryptjs');
const Category  = require('../models/Category');
const Product   = require('../models/Product');
const Inventory = require('../models/Inventory');
const User      = require('../models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/inventario_almacen';

async function seed() {
  await mongoose.connect(MONGODB_URI, { family: 4 });
  console.log('✅ MongoDB conectado para seed...');

  // Limpiar colecciones
  await Promise.all([
    Category.deleteMany({}),
    Product.deleteMany({}),
    Inventory.deleteMany({}),
    User.deleteMany({})
  ]);
  console.log('🧹 Colecciones limpiadas');

  // ── Categorías ────────────────────────────────────
  const categorias = await Category.insertMany([
    { nombre: 'Herramientas Eléctricas', codigo: 'HELEC', descripcion: 'Taladros, sierras, lijadoras' },
    { nombre: 'Equipos de Protección',  codigo: 'EPP',   descripcion: 'Cascos, guantes, arneses' },
    { nombre: 'Materiales de Oficina',  codigo: 'OFIC',  descripcion: 'Papelería, impresión' },
    { nombre: 'Electrónica',            codigo: 'ELEC',  descripcion: 'Cables, conectores, baterías' },
    { nombre: 'Limpieza Industrial',    codigo: 'LIMP',  descripcion: 'Detergentes, implementos de aseo' }
  ]);
  console.log(`✅ ${categorias.length} categorías creadas`);

  // ── Productos ─────────────────────────────────────
  const productos = await Product.insertMany([
    {
      sku: 'HELEC-001', nombre: 'Taladro Percutor 700W', codigo_barras: '7501234567890',
      formato_barras: 'EAN-13', categoria: categorias[0]._id,
      ubicacion: { pasillo: 'A', estante: '2', nivel: '3', descripcion_completa: 'Pasillo A, Estante 2, Nivel 3' },
      precio_costo: 45000, precio_venta: 78000, unidad_medida: 'unidad',
      descripcion: 'Taladro percutor de 700W con mandril de 13mm'
    },
    {
      sku: 'EPP-001', nombre: 'Casco de Seguridad Clase E', codigo_barras: '7501234567891',
      formato_barras: 'EAN-13', categoria: categorias[1]._id,
      ubicacion: { pasillo: 'B', estante: '1', nivel: '1', descripcion_completa: 'Pasillo B, Estante 1, Nivel 1' },
      precio_costo: 8500, precio_venta: 15000, unidad_medida: 'unidad',
      descripcion: 'Casco dieléctrico clase E, color blanco'
    },
    {
      sku: 'EPP-002', nombre: 'Guantes de Nitrilo Talla M', codigo_barras: '7501234567892',
      formato_barras: 'EAN-13', categoria: categorias[1]._id,
      ubicacion: { pasillo: 'B', estante: '1', nivel: '2', descripcion_completa: 'Pasillo B, Estante 1, Nivel 2' },
      precio_costo: 1200, precio_venta: 2500, unidad_medida: 'caja',
      descripcion: 'Caja de 100 guantes de nitrilo desechables'
    },
    {
      sku: 'ELEC-001', nombre: 'Cable USB Tipo C 1m', codigo_barras: '7501234567893',
      formato_barras: 'EAN-13', categoria: categorias[3]._id,
      ubicacion: { pasillo: 'C', estante: '3', nivel: '1', descripcion_completa: 'Pasillo C, Estante 3, Nivel 1' },
      precio_costo: 2500, precio_venta: 5500, unidad_medida: 'unidad'
    },
    {
      sku: 'OFIC-001', nombre: 'Resma Papel Carta 500 hojas', codigo_barras: '7501234567894',
      formato_barras: 'EAN-13', categoria: categorias[2]._id,
      ubicacion: { pasillo: 'D', estante: '1', nivel: '1', descripcion_completa: 'Pasillo D, Estante 1, Nivel 1' },
      precio_costo: 4800, precio_venta: 8000, unidad_medida: 'resma'
    }
  ]);
  console.log(`✅ ${productos.length} productos creados`);

  // ── Inventario ────────────────────────────────────
  const stocks = [120, 8, 45, 3, 25]; // El idx 1 (cascos) y 3 (cables) generarán alertas
  const reorden = [20, 10, 15, 10, 30];

  await Inventory.insertMany(productos.map((p, i) => ({
    producto:           p._id,
    cantidad_disponible: stocks[i],
    punto_reorden:      reorden[i],
    stock_maximo:       500
  })));
  console.log(`✅ Inventario creado (2 productos con stock bajo)`);

  // ── Usuarios ──────────────────────────────────────
  await User.insertMany([
    { nombre: 'Administrador',      email: 'admin@inventario.com',    password: 'admin1234',    rol: 'admin' },
    { nombre: 'Operador Almacén',   email: 'operador@inventario.com', password: 'oper1234',     rol: 'operador' },
    { nombre: 'Auditor Inventario', email: 'auditor@inventario.com',  password: 'audit1234',   rol: 'auditor' }
  ]);
  console.log('✅ 3 usuarios creados');
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('  🌱 SEED COMPLETADO EXITOSAMENTE');
  console.log('═══════════════════════════════════════');
  console.log('  📧 admin@inventario.com / admin1234');
  console.log('  📧 operador@inventario.com / oper1234');
  console.log('  📧 auditor@inventario.com / audit1234');
  console.log('');
  console.log('  🔢 Barcodes de prueba para el scanner:');
  productos.forEach(p => console.log(`     ${p.codigo_barras}  → ${p.nombre}`));
  console.log('═══════════════════════════════════════');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Error en seed:', err);
  process.exit(1);
});
