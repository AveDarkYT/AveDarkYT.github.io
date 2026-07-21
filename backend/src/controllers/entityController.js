'use strict';

const Entity = require('../models/Entity');

exports.createEntity = async (req, res) => {
  try {
    const entity = new Entity(req.body);
    await entity.save();
    res.status(201).json({ success: true, data: entity });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getEntities = async (req, res) => {
  try {
    const entities = await Entity.find();
    res.status(200).json({ success: true, data: entities });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
