const mongoose = require("mongoose");
const { Schema } = mongoose;

const couponSchema = new Schema({
  code: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  discount: { type: Number, required: true },
  maxDiscount: { type: Number, default: null },
  expiryDate: { type: Date, required: true },
  minPurchase: { type: Number, default: 0 },
  usageLimit: { type: Number, default: 0 },
  perUserLimit: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  deletedAt: { type: Date, default: null },
  usedCount: { type: Number, default: 0 },
});

const Coupon = mongoose.model("Coupon", couponSchema);
module.exports = Coupon;
