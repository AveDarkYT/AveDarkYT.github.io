'use strict';

const Alert   = require('../models/Alert');
const { emitToAll } = require('../services/socketService');

// GET /api/alerts — Lista de alertas no leídas/activas
exports.obtenerAlertas = async (req, res, next) => {
  try {
    const { leida, resuelta, page = 1, limit = 20 } = req.query;
    const filtro = {};
    if (leida    !== undefined) filtro.leida    = leida    === 'true';
    if (resuelta !== undefined) filtro.resuelta = resuelta === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [alertas, total] = await Promise.all([
      Alert.find(filtro)
        .populate('producto', 'nombre sku codigo_barras ubicacion')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Alert.countDocuments(filtro)
    ]);

    return res.json({ success: true, data: alertas, total });
  } catch (error) { next(error); }
};

// PATCH /api/alerts/:id/read — Marcar alerta como leída
exports.marcarLeida = async (req, res, next) => {
  try {
    const alerta = await Alert.findByIdAndUpdate(
      req.params.id,
      { $set: { leida: true } },
      { new: true }
    );
    if (!alerta) return res.status(404).json({ success: false, message: 'Alerta no encontrada' });
    return res.json({ success: true, data: alerta });
  } catch (error) { next(error); }
};

// PATCH /api/alerts/:id/resolve — Marcar alerta como resuelta
exports.resolverAlerta = async (req, res, next) => {
  try {
    const alerta = await Alert.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          resuelta:    true,
          leida:       true,
          resuelta_por: req.user._id,
          resuelta_en: new Date()
        }
      },
      { new: true }
    );
    if (!alerta) return res.status(404).json({ success: false, message: 'Alerta no encontrada' });
    emitToAll('alert:resolved', { alertId: alerta._id });
    return res.json({ success: true, message: 'Alerta resuelta', data: alerta });
  } catch (error) { next(error); }
};

// GET /api/alerts/count — Contador de alertas sin leer (para badges del UI)
exports.contarNoLeidas = async (req, res, next) => {
  try {
    const count = await Alert.countDocuments({ leida: false, resuelta: false });
    return res.json({ success: true, data: { count } });
  } catch (error) { next(error); }
};
