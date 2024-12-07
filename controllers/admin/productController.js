const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const user = require("../../models/userSchema");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const multer = require("multer");
const category = require("../../models/categorySchema");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(new Error("Only images are allowed!"));
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    fieldSize: 10 * 1024 * 1024,
    fields: 20,
    files: 10,
  },
  fileFilter: fileFilter,
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
      category: { $ne: null },
      $or: [{ productName: { $regex: ".*" + search + ".*", $options: "i" } }],
    })
      .populate("category")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const categories = await Category.find({ deletedAt: null });
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
    const categories = await Category.find({ deletedAt: null });
    const statusOptions = ["Available", "Out of stock"];
    res.render("addProducts", { categories, statusOptions });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
    console.log(error);
  }
};

const addProducts = async (req, res) => {
  try {
    const {
      productName,
      description,
      category,
      regularPrice,
      quantity,
      offer,
    } = req.body;

    const existProduct = await Product.findOne({ productName });
    if (existProduct) {
      return res
        .status(400)
        .json({ success: false, error: "Product name already exists" });
    }
    const images = [];
    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const originalImagePath = req.files[i].path;
        const resizedImagePath = path.join(
          "uploads",
          `${path.parse(req.files[i].filename).name}-resized${path.extname(
            req.files[i].filename
          )}`
        );
        await sharp(originalImagePath)
          .resize({ height: 440, width: 440 })
          .toFile(resizedImagePath);

        images.push(resizedImagePath);
      }
    }

    const categoryDetails = await Category.findById(category);
    if (!categoryDetails) {
      return res
        .status(404)
        .json({ success: false, error: "Category not found" });
    }
    const categoryOffer = categoryDetails.offer || 0;
    const applicableOffer = Math.max(Number(offer), Number(categoryOffer));

    const salePrice = regularPrice - (regularPrice * applicableOffer) / 100;

    const newProduct = new Product({
      productName,
      description,
      category,
      regularPrice,
      salePrice,
      quantity,
      productImage: images,
      createdAt: new Date(),
      offer,
    });

    await newProduct.save();
    return res.status(200).json({ success: true, message: "Product added" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const updateProduct = async (req, res) => {
  try {
    const {
      id,
      productName,
      description,
      regularPrice,
      quantity,
      category,
      offer,
    } = req.body;

    const categoryDetails = await Category.findById(category);
    if (!categoryDetails) {
      return res
        .status(404)
        .json({ success: false, error: "Category not found" });
    }

    const categoryOffer = categoryDetails.offer || 0;
    const applicableOffer = Math.max(Number(offer), Number(categoryOffer));

    const salePrice = regularPrice - (regularPrice * applicableOffer) / 100;
    const existProduct = await Product.findOne({
      productName,
      _id: { $ne: id },
    });
    if (existProduct) {
      return res
        .status(400)
        .json({ success: false, error: "Product name already exists" });
    }

    const updatedProduct = {
      productName,
      description,
      regularPrice,
      salePrice,
      quantity,
      category,
      offer,
    };

    const images = [];
    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const originalImagePath = req.files[i].path;
        const resizedImagePath = path.join(
          "uploads",
          `${path.parse(req.files[i].filename).name}-resized${path.extname(
            req.files[i].filename
          )}`
        );

        await sharp(originalImagePath)
          .resize({ height: 440, width: 440 })
          .toFile(resizedImagePath);

        images.push(`uploads/${path.basename(resizedImagePath)}`);
      }

      await Product.findByIdAndUpdate(
        id,
        {
          $set: updatedProduct,
          $push: { productImage: { $each: images } },
        },
        { new: true }
      );
    } else {
      await Product.findByIdAndUpdate(
        id,
        { $set: updatedProduct },
        { new: true }
      );
    }
    console.log(images);

    res.status(200).json({ success: true, message: "product updated" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const renderUpdateProductForm = async (req, res) => {
  const id = req.query.id;
  try {
    const productData = await Product.findById(id).populate("category");
    console.log("Fetched Product Data for Rendering:", productData);

    if (!productData) {
      return res.status(400).json({ error: "Product not found" });
    }
    const categories = await Category.find({ deletedAt: null });
    return res.render("updateProduct", { data: productData, categories });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const unlistProduct = async (req, res) => {
  const id = req.query.id;
  try {
    await Product.updateOne({ _id: id }, { $set: { isActive: false } });
    res.redirect("/admin/products");
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const listProduct = async (req, res) => {
  const id = req.query.id;
  try {
    await Product.updateOne({ _id: id }, { $set: { isActive: true } });
    res.redirect("/admin/products");
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const softDeleteProduct = async (req, res) => {
  const id = req.query.id;
  try {
    await Product.updateOne({ _id: id }, { $set: { deletedAt: new Date() } });
    res.redirect("/admin/products");
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  productInfo,
  addProducts,
  getAddProduct,
  softDeleteProduct,
  listProduct,
  unlistProduct,
  renderUpdateProductForm,
  updateProduct,
};

module.exports.upload = upload;
