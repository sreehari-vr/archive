const Coupon = require("../../models/couponSchema");

const loadCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.find({ deletedAt: null });
    res.render("coupon", { coupon });
  } catch (error) {
    console.error(error);
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
