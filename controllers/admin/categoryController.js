const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");

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
          { description: { $regex: new RegExp(search, "i") } }
        ]
      })
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
      search 
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
};

const addCategory = async (req, res) => {
  res.render("addCategory");
};

const check = async (req, res) => {
  const { name, description, offer } = req.body;
  try {
    if (!name) {
      return res
        .status(400)
        .json({ success: false, error: "Category name is required" });
    }

    const existingCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') },
    });

    if (existingCategory) {
      return res
        .status(400)
        .json({ success: false, error: "Category already exists." });
    }
    const newCategory = new Category({ name, description, offer });
    await newCategory.save();
    return res
      .status(200)
      .json({ success: true, message: "Category added successfully" });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
};

const updateCategory = async (req, res) => {
  const { id, name, description, offer } = req.body;

  try {
    const existCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') },
    });

    if (existCategory && existCategory._id.toString() !== id) {
      return res.status(400).json({
        success: false,
        error: "Category with this name already exists.",
      });
    }

    const updatedCategory = await Category.updateOne(
      { _id: id },
      { $set: { name, description, offer } }
    );

    if (!updatedCategory) {
      return res.status(404).json({
        success: false,
        error: "Category not found",
      });
    }

    const products = await Product.find({ category: id });

    for (const product of products) {
      const productOffer = product.productOffer || 0;
      const applicableOffer = Math.max(productOffer, offer || 0);

      const salePrice =
        product.regularPrice - (product.regularPrice * applicableOffer) / 100;

      product.salePrice = salePrice;
      await product.save();
    }

    return res.status(200).json({
      success: true,
      message: "Category updated successfully",
    });
  } catch (error) {
    console.error("Error updating category:", error);
    return res.status(500).json({
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
      return res.status(400).json({ error: "Category not found" });
    }
    res.render("updateCategory", { data: categoryData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const unlistCategory = async (req, res) => {
  const id = req.query.id;
  try {
    await Category.updateOne({ _id: id }, { $set: { isActive: false } });
    res.redirect("/admin/category");
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const listCategory = async (req, res) => {
  const id = req.query.id;
  try {
    await Category.updateOne({ _id: id }, { $set: { isActive: true } });
    res.redirect("/admin/category");
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const softDeleteCategory = async (req, res) => {
  const id = req.query.id;
  try {
    await Category.updateOne({ _id: id }, { $set: { deletedAt: new Date() } });
    res.redirect("/admin/category");
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
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
