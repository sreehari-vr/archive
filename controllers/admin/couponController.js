const Coupon = require("../../models/couponSchema");
const HTTP_STATUS_CODES = require("../../utils/httpStatusCodes");


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
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).send('Server Error');
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
    // Extract and parse numeric fields to ensure they are treated as numbers
    const {
      code,
      description,
      discount,
      expDate,
      minPurchase,
      usageLimit,
      perUserLimit,
    } = req.body;

    const parsedDiscount = Number(discount);
    const parsedMinPurchase = Number(minPurchase);
    const parsedUsageLimit = usageLimit ? Number(usageLimit) : null;
    const parsedPerUserLimit = perUserLimit ? Number(perUserLimit) : null;

    // Validate input values
    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (existingCoupon) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        error: "Coupon code already exists",
      });
    }

    if (parsedDiscount <= 0) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        error: "Discount amount must be greater than 0",
      });
    }

    if (parsedMinPurchase < 0) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        error: "Minimum purchase amount cannot be negative",
      });
    }

    if (parsedUsageLimit && parsedUsageLimit <= 0) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        error: "Usage limit must be greater than 0",
      });
    }

    if (parsedPerUserLimit && parsedPerUserLimit < 0) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        error: "Per user limit can't be negative.",
      });
    }

    if (parsedDiscount >= parsedMinPurchase) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        error: "Discount amount must be less than minimum purchase amount",
      });
    }

    if (!expDate) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        error: "Expiry date is required",
      });
    }

    const newCoupon = new Coupon({
      code: code.toUpperCase(),
      description,
      discount: parsedDiscount,
      expiryDate: expDate,
      minPurchase: parsedMinPurchase,
      usageLimit: parsedUsageLimit,
      perUserLimit: parsedPerUserLimit,
    });
    await newCoupon.save();

    return res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      message: "Coupon added successfully",
    });
  } catch (error) {
    console.error("Error adding coupon:", error);
    return res
      .status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ success: false, error: "Internal server error" });
  }
};


const inactivateCoupon = async (req, res) => {
  const id = req.query.id;
  try {
    await Coupon.updateOne({ _id: id }, { $set: { isActive: false } });
    res.redirect("/admin/coupon");
  } catch (error) {
    console.error(error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({ error: "Internal server error" });
  }
};

const activateCoupon = async (req, res) => {
  const id = req.query.id;
  try {
    await Coupon.updateOne({ _id: id }, { $set: { isActive: true } });
    res.redirect("/admin/coupon");
  } catch (error) {
    console.error(error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({ error: "Internal server error" });
  }
};

const softDeleteCoupon = async (req, res) => {
  const id = req.query.id;
  try {
    await Coupon.updateOne({ _id: id }, { $set: { deletedAt: new Date() } });
    res.redirect("/admin/coupon");
  } catch (error) {
    console.error(error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({ error: "Internal server error" });
  }
};

const loadUpdateCoupon = async (req, res) => {
  try {
    const id = req.query.id;
    const coupon = await Coupon.findById(id);
    res.render("updateCoupon", { coupon });
  } catch (error) {
    console.error(error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({ error: "Internal server error" });
  }
};

const updateCoupon = async (req, res) => {
  try {
    const {
      id,
      code,
      description,
      discount,
      expDate,
      minPurchase,
      usageLimit,
      perUserLimit,
    } = req.body;

    // Parse numeric values
    const parsedDiscount = Number(discount);
    const parsedMinPurchase = Number(minPurchase);
    const parsedUsageLimit = usageLimit ? Number(usageLimit) : null;
    const parsedPerUserLimit = perUserLimit ? Number(perUserLimit) : null;

    // Find the coupon by ID
    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res
        .status(HTTP_STATUS_CODES.NOT_FOUND)
        .json({ success: false, error: "Coupon not found." });
    }

    // Check for duplicate code
    const existingCoupon = await Coupon.findOne({
      code: code.toUpperCase(),
      _id: { $ne: id }, // Exclude the current coupon ID
    });

    if (existingCoupon) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        error: "Coupon code already exists",
      });
    }

    // Validation checks
    if (parsedDiscount <= 0) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        error: "Discount amount must be greater than 0",
      });
    }

    if (parsedMinPurchase < 0) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        error: "Minimum purchase amount cannot be negative",
      });
    }

    if (parsedUsageLimit && parsedUsageLimit <= 0) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        error: "Usage limit must be greater than 0",
      });
    }

    if (parsedPerUserLimit && parsedPerUserLimit < 0) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        error: "Per user limit can't be negative.",
      });
    }

    if (parsedDiscount >= parsedMinPurchase) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        error: "Discount amount must be less than minimum purchase amount",
      });
    }

    if (!expDate) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        error: "Expiry date is required",
      });
    }

    // Update coupon fields
    coupon.code = code.toUpperCase();
    coupon.description = description;
    coupon.discount = parsedDiscount;
    coupon.expiryDate = expDate;
    coupon.minPurchase = parsedMinPurchase;
    coupon.usageLimit = parsedUsageLimit;
    coupon.perUserLimit = parsedPerUserLimit;

    await coupon.save();

    res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      message: "Coupon updated successfully.",
      updatedCoupon: coupon,
    });
  } catch (error) {
    console.error("Error updating coupon:", error);
    res
      .status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ success: false, error: "Internal server error" });
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
