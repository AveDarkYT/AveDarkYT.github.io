const Brand = require('../models/Brand');
exports.getAll = async(req,res) => {
  try { res.json({success:true, data: await Brand.find()}); }
  catch (error) { res.status(500).json({success:false, message: error.message}); }
};
exports.create = async(req,res) => {
  try {
    const item = new Brand(req.body);
    await item.save();
    res.json({success:true, data: item});
  } catch (error) { res.status(400).json({success:false, message: error.message}); }
};
