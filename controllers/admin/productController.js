const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const user = require("../../models/userSchema");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const multer = require("multer");
const category = require("../../models/categorySchema");
const HTTP_STATUS_CODES = require("../../utils/httpStatusCodes");

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

    let page = parseInt(req.query.page) || 1; 
    const limit = 6; 
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

    const totalProducts = await Product.countDocuments({
      deletedAt: null,
      category: { $ne: null },
      $or: [{ productName: { $regex: ".*" + search + ".*", $options: "i" } }],
    });

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
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({ error: "Internal server error" });
    console.log(error);
  }
};

const addProducts = async (req, res) => {
  let images = [];
  try {
    const {
      productName,
      description,
      category,
      regularPrice,
      quantity,
      offer,
    } = req.body;

    // Input validation
    if (!productName || productName.trim().length === 0) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ 
        success: false, 
        error: "Product name cannot be empty or contain only spaces" 
      });
    }

    if (!/^[a-zA-Z][a-zA-Z0-9\s]*$/.test(productName)) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ 
        success: false, 
        error: "Product name must start with a letter and can only contain letters, numbers and spaces" 
      });
    }

    if (!description || !/^[a-zA-Z]/.test(description)) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ 
        success: false, 
        error: "Description must start with a letter" 
      });
    }

    if (!regularPrice || regularPrice < 0) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ 
        success: false, 
        error: "Price cannot be negative" 
      });
    }

    if (!quantity || quantity < 0) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ 
        success: false, 
        error: "Quantity cannot be negative" 
      });
    }

    if (!offer || offer < 0 || offer > 100) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ 
        success: false, 
        error: "Offer must be between 0 and 100" 
      });
    }

    // Check for existing product
    const existProduct = await Product.findOne({
      productName: { $regex: new RegExp(`^${productName.trim()}$`, 'i') }
    });
    if (existProduct) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ 
        success: false, 
        error: "Product name already exists" 
      });
    }

    // Image processing
    if (!req.files || req.files.length === 0) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ 
        success: false, 
        error: "Product must have at least one image" 
      });
    }

    for (const file of req.files) {
      const originalImagePath = file.path;
      const uniqueFilename = `${Date.now()}-${path.parse(file.filename).name}-resized${path.extname(file.filename)}`;
      const resizedImagePath = path.join("uploads", uniqueFilename);

      try {
        await sharp(originalImagePath)
          .resize({ height: 440, width: 440 })
          .toFile(resizedImagePath);

        if (fs.existsSync(originalImagePath)) {
          fs.unlinkSync(originalImagePath);
        }

        images.push(resizedImagePath.replace(/\\/g, "/"));
      } catch (error) {
        if (fs.existsSync(resizedImagePath)) {
          fs.unlinkSync(resizedImagePath);
        }
        throw new Error("Error processing image: " + error.message);
      }
    }

    // Category validation and offer calculation
    const categoryDetails = await Category.findById(category);
    if (!categoryDetails) {
      cleanupImages(images);
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({ success: false, error: "Category not found" });
    }

    const categoryOffer = categoryDetails.offer || 0;
    const applicableOffer = Math.max(Number(offer), Number(categoryOffer));
    const salePrice = regularPrice - (regularPrice * applicableOffer) / 100;

    // Create and save product
    const newProduct = new Product({
      productName: productName.trim(),
      description,
      category,
      regularPrice,
      salePrice,
      quantity,
      productImage: images,
      offer,
      createdAt: new Date()
    });

    await newProduct.save();
    return res.status(HTTP_STATUS_CODES.OK).json({ success: true, message: "Product added" });

  } catch (error) {
    cleanupImages(images);
    console.error("Error in addProducts:", error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({ error: "Internal server error" });
  }
};

function cleanupImages(images) {
  if (images && images.length > 0) {
    images.forEach(imagePath => {
      const fullPath = path.join(__dirname, "../../", imagePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    });
  }
}

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

    const product = await Product.findById(id);
    if (!product) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({ success: false, error: "Product not found" });
    }

    // Input validation
    if (!productName || productName.trim().length === 0) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ 
        success: false, 
        error: "Product name cannot be empty or contain only spaces" 
      });
    }

    if (!/^[a-zA-Z][a-zA-Z0-9\s]*$/.test(productName)) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ 
        success: false, 
        error: "Product name must start with a letter and can only contain letters, numbers and spaces" 
      });
    }

    if (!description || !/^[a-zA-Z]/.test(description)) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ 
        success: false, 
        error: "Description must start with a letter" 
      });
    }

    if (!regularPrice || regularPrice < 0) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ 
        success: false, 
        error: "Price cannot be negative" 
      });
    }

    if (!quantity || quantity < 0) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ 
        success: false, 
        error: "Quantity cannot be negative" 
      });
    }

    if (!offer || offer < 0 || offer > 100) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ 
        success: false, 
        error: "Offer must be between 0 and 100" 
      });
    }

    const imagesToDelete = Array.isArray(req.body.imagesToDelete)
      ? req.body.imagesToDelete
      : req.body.imagesToDelete
      ? [req.body.imagesToDelete]
      : [];

    // Check if removing images would leave product with no images
    const currentImages = product.productImage.filter(
      (image) => !imagesToDelete.includes(image)
    );
    
    if (currentImages.length === 0 && (!req.files || req.files.length === 0)) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ 
        success: false, 
        error: "Product must have at least one image" 
      });
    }

    const categoryDetails = await Category.findById(category);
    if (!categoryDetails) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({ success: false, error: "Category not found" });
    }

    const categoryOffer = categoryDetails.offer || 0;
    const applicableOffer = Math.max(Number(offer), Number(categoryOffer));
    const salePrice = regularPrice - (regularPrice * applicableOffer) / 100;

    const existProduct = await Product.findOne({
      productName: { $regex: new RegExp(`^${productName.trim()}$`, 'i') },
      _id: { $ne: id },
    });
    
    if (existProduct) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ 
        success: false, 
        error: "Product name already exists" 
      });
    }

    const updatedProduct = {
      productName: productName.trim(),
      description,
      regularPrice,
      salePrice,
      quantity,
      category,
      offer,
    };

    if (imagesToDelete.length > 0) {
      product.productImage = currentImages;

      for (const imagePath of imagesToDelete) {
        const fullPath = path.join(__dirname, "../../", imagePath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      }

      await product.save();
    }

    const newImages = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const originalImagePath = file.path;
        const uniqueFilename = `${Date.now()}-${path.parse(file.filename).name}-resized${path.extname(file.filename)}`;
        const resizedImagePath = path.join("uploads", uniqueFilename);

        if (!fs.existsSync(resizedImagePath)) {
          await sharp(originalImagePath)
            .resize({ height: 440, width: 440 })
            .toFile(resizedImagePath);
        }

        newImages.push(resizedImagePath.replace(/\\/g, "/"));
      }
    }

    await Product.findByIdAndUpdate(
      id,
      {
        $set: updatedProduct,
        $push: { productImage: { $each: newImages } },
      },
      { new: true }
    );

    res.status(HTTP_STATUS_CODES.OK).json({ success: true, message: "Product updated" });
  } catch (error) {
    console.error("Error in updateProduct:", error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({ error: "Internal server error" });
  }
};


const renderUpdateProductForm = async (req, res) => {
  const id = req.query.id;
  try {
    const productData = await Product.findById(id).populate("category");
    console.log("Fetched Product Data for Rendering:", productData);

    if (!productData) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ error: "Product not found" });
    }
    const categories = await Category.find({ deletedAt: null });
    return res.render("updateProduct", { data: productData, categories });
  } catch (error) {
    console.error(error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({ error: "Internal server error" });
  }
};

const unlistProduct = async (req, res) => {
  const id = req.query.id;
  try {
    await Product.updateOne({ _id: id }, { $set: { isActive: false } });
    res.redirect("/admin/products");
  } catch (error) {
    console.error(error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({ error: "Internal server error" });
  }
};

const listProduct = async (req, res) => {
  const id = req.query.id;
  try {
    await Product.updateOne({ _id: id }, { $set: { isActive: true } });
    res.redirect("/admin/products");
  } catch (error) {
    console.error(error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({ error: "Internal server error" });
  }
};

const softDeleteProduct = async (req, res) => {
  const id = req.query.id;
  try {
    await Product.updateOne({ _id: id }, { $set: { deletedAt: new Date() } });
    res.redirect("/admin/products");
  } catch (error) {
    console.error(error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({ error: "Internal server error" });
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
