const Coupon = require("../../models/couponSchema");

const loadCoupon = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";

    const searchQuery = {
      deletedAt: null,
      ...(search && {
        $or: [
          { code: { $regex: new RegExp(search, "i") } },
          { description: { $regex: new RegExp(search, "i") } }
        ]
      })
    };

    const totalCoupons = await Coupon.countDocuments(searchQuery);

    const coupon = await Coupon.find(searchQuery)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }); 

    const totalPages = Math.ceil(totalCoupons / limit);

    res.render("coupon", { 
      coupon, 
      totalPages, 
      currentPage: page,
      search 
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
};


const loadAddCoupon = async (req, res) => {
  try {
    res.render("addCoupon");
  } catch (error) {
    console.error(error);
  }
};

const addCoupon = async (req, res) => {
  try {
    const {
      code,
      description,
      discount,
      maxDiscount,
      expDate,
      minPurchase,
      usageLimit,
      perUserLimit,
    } = req.body;


    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (existingCoupon) {
      return res.status(400).json({ 
        success: false, 
        error: "Coupon code already exists" 
      });
    }

    if (discount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Discount amount must be greater than 0"
      });
    }

    if (minPurchase < 0) {
      return res.status(400).json({
        success: false,
        error: "Minimum purchase amount cannot be negative"
      });
    }

    if (usageLimit && usageLimit <= 0) {
      return res.status(400).json({
        success: false,
        error: "Usage limit must be greater than 0"
      });
    }

    if (perUserLimit && perUserLimit < 0) {
      return res.status(400).json({
        success: false,
        error: "Per user limit must be greater than 0"
      });
    }

    if (discount >= minPurchase) {
      return res.status(400).json({
        success: false,
        error: "Discount amount must be less than minimum purchase amount"
      });
    }

    if (!expDate) {
      return res.status(400).json({
        success: false,
        error: "Expiry date is required"
      });
    }

    const newCoupon = new Coupon({
      code,
      description,
      discount,
      maxDiscount,
      expiryDate: expDate,
      minPurchase,
      usageLimit,
      perUserLimit,
    });
    await newCoupon.save();

    return res.status(200).json({ success: true, message: "Coupon added" });
  } catch (error) {
    console.error(error);
  }
};

const inactivateCoupon = async (req, res) => {
  const id = req.query.id;
  try {
    await Coupon.updateOne({ _id: id }, { $set: { isActive: false } });
    res.redirect("/admin/coupon");
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const activateCoupon = async (req, res) => {
  const id = req.query.id;
  try {
    await Coupon.updateOne({ _id: id }, { $set: { isActive: true } });
    res.redirect("/admin/coupon");
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const softDeleteCoupon = async (req, res) => {
  const id = req.query.id;
  try {
    await Coupon.updateOne({ _id: id }, { $set: { deletedAt: new Date() } });
    res.redirect("/admin/coupon");
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const loadUpdateCoupon = async (req, res) => {
  try {
    const id = req.query.id;
    const coupon = await Coupon.findById(id);
    res.render("updateCoupon", { coupon });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const updateCoupon = async (req, res) => {
  try {
    const {
      id,
      code,
      description,
      discount,
      maxDiscount,
      expDate,
      minPurchase,
      usageLimit,
      perUserLimit,
    } = req.body;

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({ error: "Coupon not found." });
    }
    const existingCoupon = await Coupon.findOne({
      code: code.toUpperCase(),
      _id: { $ne: id } 
    });

    if (existingCoupon) {
      return res.status(400).json({ 
        success: false,
        error: "Coupon code already exists" 
      });
    }

    coupon.code = code;
    coupon.description = description;
    coupon.discount = discount;
    coupon.expiryDate = expDate;
    coupon.minPurchase = minPurchase;
    coupon.usageLimit = usageLimit;
    coupon.maxDiscount = maxDiscount;
    coupon.perUserLimit = perUserLimit;

    await coupon.save()

    res.status(200).json({
        success: true,
        message: "Coupon updated successfully.",
        updatedCoupon: coupon,
      });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  loadCoupon,
  addCoupon,
  loadAddCoupon,
  inactivateCoupon,
  activateCoupon,
  softDeleteCoupon,
  loadUpdateCoupon,
  updateCoupon,
};
