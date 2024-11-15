const Category = require("../../models/categorySchema");

const categoryInfo = async (req, res) => {
  try {

    let search = "";
        if(req.query.search){
            search = req.query.search;
        }

    let page = 1;
    if (req.query.page) {
      page = req.query.page;
    }
    const limit = 4;
    const skip = (page - 1) * limit;
    const categoryData = await Category.find({deletedAt:null,
      $or:[{ name: { $regex: ".*" + search + ".*", $options: 'i' } }]
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalCategories = await Category.countDocuments();
    const totalPages = Math.ceil(totalCategories / limit);
    res.render("category", {
      data: categoryData,
      currentPage: page,
      totalPages: totalPages,
      totalCategories: totalCategories,
    });
  } catch (error) {
    console.error(error);
  }
};

const addCategory = async (req, res) => {
   res.render("addCategory");
};

const check = async (req, res) => {
  const { name, description } = req.body;

  try {
      if (!name) {
          return res.status(400).json({ success: false, error: "Category name is required" });
      }

      const existingCategory = await Category.findOne({ name });
      if (existingCategory) {
          return res.status(400).json({ success: false, error: "Category already exists" });
      }

      const newCategory = new Category({ name, description });
      await newCategory.save();

      return res.status(200).json({ success: true, message: "Category added successfully" });
  } catch (error) {
      console.error(error);
      return res.status(500).json({ success: false, error: "Internal server error" });
  }
};



const updateCategory = async (req, res) => {
  const { id, name, description } = req.body;
  try {

  const existCategory = await Category.findOne({name})
  if(existCategory){
    return res.status(400).json({success:false,error:'category is already there'})
  }

    const updatedCategory = await Category.updateOne(
      { _id: id },
      { $set: { name,description } }
    );



    if (!updatedCategory) {
      return res.status(404).json({success:false, error: "Category not found" });
    }
    return res.json({success:true, error: "Category updated successfully" });

    
  } catch (error) {
    return res.status(500).json({ error: "internal server error" });
  }
};

const renderUpdateCategoryForm = async (req, res) => {
  const id = req.query.id; // Get the category ID from the query parameter
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
    await Category.updateOne({ _id: id },{ $set:  { isActive: false }});
    res.redirect("/admin/category");
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const listCategory = async (req, res) => {
  const id = req.query.id;
  try {
    await Category.updateOne({ _id: id }, { $set: { isActive: true }});
    res.redirect("/admin/category");
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const softDeleteCategory = async (req, res) => {
  const id = req.query.id;
  try {
    await Category.updateOne({_id:id},{$set:{deletedAt: new Date}})
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
  softDeleteCategory
};
