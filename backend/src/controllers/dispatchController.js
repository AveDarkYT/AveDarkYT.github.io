'use strict';

const DispatchNote = require('../models/DispatchNote');

// Helper para generar número secuencial
const generateDispatchNumber = async () => {
  const count = await DispatchNote.countDocuments();
  return `C-${String(count + 1).padStart(4, '0')}`;
};

// GET /api/dispatch
exports.getAll = async (req, res, next) => {
  try {
    const notes = await DispatchNote.find()
      .populate('creado_por', 'nombre')
      .populate('items.producto', 'nombre sku precio_venta')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: notes });
  } catch (error) { next(error); }
};

// GET /api/dispatch/active
exports.getActive = async (req, res, next) => {
  try {
    const notes = await DispatchNote.find({ estado: 'Borrador' })
      .populate('creado_por', 'nombre')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: notes });
  } catch (error) { next(error); }
};

// POST /api/dispatch
exports.create = async (req, res, next) => {
  try {
    const { cliente, empleado, orden_servicio, direccion, brigada, placa, tipo_trabajo, notas } = req.body;
    if (!cliente) return res.status(400).json({ success: false, message: 'El nombre del cliente es obligatorio' });

    const numero_conduce = await generateDispatchNumber();

    const newNote = await DispatchNote.create({
      numero_conduce,
      cliente,
      empleado,
      orden_servicio,
      direccion,
      brigada,
      placa,
      tipo_trabajo,
      notas,
      creado_por: req.user.id
    });

    res.status(201).json({ success: true, data: newNote });
  } catch (error) { next(error); }
};

// GET /api/dispatch/:id
exports.getById = async (req, res, next) => {
  try {
    const note = await DispatchNote.findById(req.params.id)
      .populate('creado_por', 'nombre')
      .populate('items.producto', 'nombre sku precio_venta unidad_medida');
      
    if (!note) return res.status(404).json({ success: false, message: 'Conduce no encontrado' });
    res.json({ success: true, data: note });
  } catch (error) { next(error); }
};

// PUT /api/dispatch/:id/close
exports.closeNote = async (req, res, next) => {
  try {
    const note = await DispatchNote.findById(req.params.id);
    if (!note) return res.status(404).json({ success: false, message: 'Conduce no encontrado' });
    if (note.estado !== 'Borrador') return res.status(400).json({ success: false, message: 'El conduce ya está cerrado o cancelado' });

    note.estado = 'Completado';
    await note.save();

    res.json({ success: true, message: 'Conduce completado exitosamente', data: note });
  } catch (error) { next(error); }
};
