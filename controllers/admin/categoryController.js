const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const HTTP_STATUS_CODES = require("../../utils/httpStatusCodes");

const categoryInfo = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";

    const searchQuery = {
      deletedAt: null,
      ...(search && {
        $or: [
          { name: { $regex: new RegExp(search, "i") } },
          { description: { $regex: new RegExp(search, "i") } },
        ],
      }),
    };

    const totalCategories = await Category.countDocuments(searchQuery);
    const categoryData = await Category.find(searchQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalCategories / limit);

    res.render("category", {
      data: categoryData,
      totalPages: totalPages,
      currentPage: page,
      search,
    });
  } catch (error) {
    console.error(error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).send("Server Error");
  }
};

const addCategory = async (req, res) => {
  res.render("addCategory");
};

const check = async (req, res) => {
  const { name, description, offer } = req.body;

  try {
    // Validate name
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ 
        success: false, 
        error: "Category name is required" 
      });
    }

    const namePattern = /^[a-z\s]+$/i;
    if (!namePattern.test(name)) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ 
        success: false, 
        error: "Category name can only contain letters and spaces." 
      });
    }

    // Validate description
    if (!description || typeof description !== 'string' || description.trim().length < 10) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ 
        success: false, 
        error: "Description must be at least 10 characters long." 
      });
    }

    // Validate offer
    const offerValue = Number(offer);
    if (isNaN(offerValue) || offerValue < 0 || offerValue > 100) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ 
        success: false, 
        error: "Offer must be a number between 0 and 100." 
      });
    }

    // Check for duplicate category
    const existingCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
    });

    if (existingCategory) {
      return res.status(HTTP_STATUS_CODES.CONFLICT).json({ 
        success: false, 
        error: "Category already exists." 
      });
    }

    // Create new category
    const newCategory = new Category({ 
      name: name.trim(), 
      description: description.trim(), 
      offer: offerValue 
    });
    await newCategory.save();

    return res.status(HTTP_STATUS_CODES.CREATED).json({ 
      success: true, 
      message: "Category added successfully" 
    });
  } catch (error) {
    console.error("Error in adding category:", error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({ 
      success: false, 
      error: "Internal server error" 
    });
  }
};

const updateCategory = async (req, res) => {
  const { id, name, description, offer } = req.body;

  try {
    // Validate ID
    if (!id || typeof id !== 'string') {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        error: "Invalid category ID",
      });
    }

    // Validate name
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        error: "Category name is required",
      });
    }

    const namePattern = /^[a-z\s]+$/i;
    if (!namePattern.test(name)) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        error: "Category name can only contain letters and spaces.",
      });
    }

    // Validate description
    if (!description || typeof description !== 'string' || description.trim().length < 10) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        error: "Description must be at least 10 characters long.",
      });
    }

    // Validate offer
    const offerValue = Number(offer);
    if (isNaN(offerValue) || offerValue < 0 || offerValue > 100) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        error: "Offer must be a number between 0 and 100.",
      });
    }

    // Check if category with the same name exists
    const existCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
    });

    if (existCategory && existCategory._id.toString() !== id) {
      return res.status(HTTP_STATUS_CODES.CONFLICT).json({
        success: false,
        error: "Category with this name already exists.",
      });
    }

    // Update category
    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      { name: name.trim(), description: description.trim(), offer: offerValue },
      { new: true }
    );

    if (!updatedCategory) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        error: "Category not found",
      });
    }

    // Update related products
    const products = await Product.find({ category: id });
    for (const product of products) {
      const productOffer = product.productOffer || 0;
      const applicableOffer = Math.max(productOffer, offerValue);
      const salePrice = product.regularPrice - (product.regularPrice * applicableOffer) / 100;
      product.salePrice = salePrice;
      await product.save();
    }

    return res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      message: "Category updated successfully",
    });
  } catch (error) {
    console.error("Error updating category:", error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: "Internal server error",
    });
  }
};

const renderUpdateCategoryForm = async (req, res) => {
  const id = req.query.id;
  try {
    const categoryData = await Category.findById(id);
    if (!categoryData) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({ 
        error: "Category not found" 
      });
    }
    res.render("updateCategory", { data: categoryData });
  } catch (error) {
    console.error(error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({ 
      error: "Internal server error" 
    });
  }
};

const unlistCategory = async (req, res) => {
  const id = req.query.id;
  try {
    const result = await Category.updateOne(
      { _id: id }, 
      { $set: { isActive: false } }
    );
    if (result.matchedCount === 0) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({ 
        error: "Category not found" 
      });
    }
    res.redirect("/admin/category");
  } catch (error) {
    console.error(error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({ 
      error: "Internal server error" 
    });
  }
};

const listCategory = async (req, res) => {
  const id = req.query.id;
  try {
    const result = await Category.updateOne(
      { _id: id }, 
      { $set: { isActive: true } }
    );
    if (result.matchedCount === 0) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({ 
        error: "Category not found" 
      });
    }
    res.redirect("/admin/category");
  } catch (error) {
    console.error(error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({ 
      error: "Internal server error" 
    });
  }
};

const softDeleteCategory = async (req, res) => {
  const id = req.query.id;
  try {
    const result = await Category.updateOne(
      { _id: id }, 
      { $set: { deletedAt: new Date() } }
    );
    if (result.matchedCount === 0) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({ 
        error: "Category not found" 
      });
    }
    res.redirect("/admin/category");
  } catch (error) {
    console.error(error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({ 
      error: "Internal server error" 
    });
  }
};

module.exports = {
  categoryInfo,
  addCategory,
  updateCategory,
  listCategory,
  unlistCategory,
  renderUpdateCategoryForm,
  check,
  softDeleteCategory,
};