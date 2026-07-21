const Category = require('../models/Category');
exports.getAll = async(req,res) => {
  try {
    const data = await Category.find();
    res.json({success:true, data});
  } catch (error) {
    res.status(500).json({success:false, message: error.message});
  }
};
exports.create = async(req,res) => {
  try {
    const cat = new Category(req.body);
    await cat.save();
    res.json({success:true, data: cat});
  } catch (error) {
    res.status(400).json({success:false, message: error.message});
  }
};
