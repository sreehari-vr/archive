const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const user = require("../../models/userSchema");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const multer = require('multer');
const category = require("../../models/categorySchema");
 

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
      cb(null, 'uploads/');  // Ensure the 'uploads' folder exists
  },
  filename: (req, file, cb) => {
      cb(null, Date.now() + path.extname(file.originalname));  // Append timestamp to avoid filename collisions
  }
});

// File filter to allow specific types of images
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
      return cb(null, true);
  }
  cb(new Error('Only images are allowed!'));
};

// Initialize multer with storage, file size limit, and file filter
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter
});


const productInfo = async (req, res) => {
  try {
    let search = "";
    if (req.query.search) {
      search = req.query.search;
    }

    let page = 1;
    if (req.query.page) {
      page = req.query.page;
    }
    limit = 6;
    const skip = (page - 1) * limit;
    const productData = await Product.find({
      deletedAt: null,
      $or: [{ productName: { $regex: ".*" + search + ".*", $options: "i" } }],
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
      const categories = await Category.find({ deletedAt: null });
      console.log('Product Data:', productData);
    const totalProducts = await Product.countDocuments();
    const totalPages = Math.ceil(totalProducts / limit);
    res.render("product", {
      data: productData,
      currentPage: page,
      totalPages: totalPages,
      totalProducts: totalProducts,
    });
  } catch (error) {
    console.error(error);
  }
};

const getAddProduct = async (req, res) => {
  try {
    const categories = await Category.find({ deletedAt: null }); // Fetching categories
    const statusOptions = ["Available", "Out of stock"];
    res.render("addProducts", { categories, statusOptions }); // Passing the categories to the EJS template
  } catch (error) { 
    res.status(500).json({ error: "Internal server error" });
    console.log(error)
  }
};

const addProducts = async (req, res) => {
  try {
    const{ productName, description, category, regularPrice, salePrice, quantity, }=req.body
    
        // Extract the filenames of the uploaded images
    const productImages = req.files.map(file => file.filename); // Storing filenames of uploaded images

    const newProduct = new Product({

      productName: req.body.productName,
      description: req.body.description,
      category: req.body.category,
      regularPrice: req.body.regularPrice,
      salePrice: req.body.salePrice,
      quantity: req.body.quantity,
      productImage: productImages,
      status: req.body.status,

    });
  
  await newProduct.save();
  console.log(newProduct)
    res.redirect('/admin/products');
} catch (error) {
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
}
}


const updateProduct = async (req, res) => {

  try {

    const{ productName, description, category, regularPrice, salePrice, quantity, } = req.body

    const productImages = req.files.map(file => file.filename); // Storing filenames of uploaded images

  const existProduct = await Product.findOne({productName})
  if(existProduct){
    return res.status(400).json({success:false,error:'Product is already there'})
  }

  const updatedProduct = await Product.updateOne(
    { _id: req.query.id },
    {
        $set: {
            productName,
            description,
            category,
            regularPrice,
            salePrice,
            quantity,
            productImage: productImages,
        },
    }
)


    if (!updatedProduct) {
      return res.status(404).json({success:false, error: "Product not found" });
    }
    return res.json({success:true, error: "Product updated successfully" });

    
  } catch (error) {
    res.status(500).json({ error: "internal server error" });
    console.log(error)
  }
};


const renderUpdateProductForm = async (req, res) => {
  const id = req.query.id;
  try {
    const productData = await Product.findById(id);
    if (!productData) {
      return res.status(400).json({ error: "Product not found" });
    }
    const categories = await Category.find({ deletedAt: null });
    console.log('Product Data:', productData); // Log product data for debugging
    res.render("updateProduct", { data: productData, categories });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const unlistProduct = async (req, res) => {
  const id = req.query.id;
  try {
    await Product.updateOne({ _id: id },{ $set:  { isActive: false }});
    res.redirect("/admin/products");
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const listProduct = async (req, res) => {
  const id = req.query.id;
  try {
    await Product.updateOne({ _id: id }, { $set: { isActive: true }});
    res.redirect("/admin/products");
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const softDeleteProduct = async (req, res) => {
  const id = req.query.id;
  try {
    await Product.updateOne({_id:id},{$set:{deletedAt: new Date}})
    res.redirect("/admin/products");
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  } 
};


module.exports = { productInfo, addProducts, getAddProduct, softDeleteProduct, listProduct, unlistProduct, renderUpdateProductForm, updateProduct };

module.exports.upload = upload;
