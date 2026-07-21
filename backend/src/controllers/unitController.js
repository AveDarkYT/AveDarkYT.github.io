const Unit = require('../models/Unit');
exports.getAll = async(req,res) => {
  try { res.json({success:true, data: await Unit.find()}); }
  catch (error) { res.status(500).json({success:false, message: error.message}); }
};
exports.create = async(req,res) => {
  try {
    const item = new Unit(req.body);
    await item.save();
    res.json({success:true, data: item});
  } catch (error) { res.status(400).json({success:false, message: error.message}); }
};
