const user = require("../../models/userSchema");
const Coupon = require("../../models/couponSchema");
const Cart = require("../../models/cartSchema");

const cartLoad = async (req, res) => {
  const userId = req.session.user;
  try {
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    const coupon = await Coupon.find({ isActive: true, deletedAt: null });

    res.render("cart", { cart, coupon });
  } catch (error) {
    console.log("page not loading:", error);
    res.status(500).send("Server error");
  }
};

const cartAdd = async (req, res) => {
  const userId = req.session.user;
  const productId = req.params.id;
  const { quantity, subTotal, grandTotal } = req.body;
  try {
    let cart = await Cart.findOne({ userId });
    const quantityToAdd = parseInt(quantity, 10);
    const subTotalToAdd = parseInt(subTotal, 10);
    const grandTotalToAdd = parseInt(grandTotal, 10);
    if (cart) {
      const productIndex = cart.items.findIndex(
        (item) => item.productId.toString() === productId
      );

      if (productIndex > -1) {
        cart.items[productIndex].quantity += quantityToAdd;
      } else {
        cart.items.push({ productId, quantity: quantityToAdd });
      }
      cart.subTotal = subTotalToAdd;
      cart.grandTotal = grandTotalToAdd;
    } else {
      cart = new Cart({
        userId,
        items: [{ productId, quantity: quantityToAdd }],
        subTotal: subTotalToAdd,
        grandTotal: grandTotalToAdd,
      });
    }
    await cart.save();

    res.redirect("/cart");
  } catch (error) {
    console.error(error);
  }
};

const removeFromCart = async (req, res) => {
  const userId = req.session.user;
  const productId = req.params.id;
  try {
    const userCart = await Cart.findOne({ userId });
    const removingProduct = userCart.items.find(
      (id) => id.productId.toString() === productId
    );
    await Cart.updateOne(
      { userId },
      { $pull: { items: { _id: removingProduct } } }
    );
    res.json({ success: true, message: "Product removed successfully" });

    res.redirect("/cart");
  } catch (error) {
    console.error(error);
  }
};

const applyCoupon = async (req, res) => {
  const userId = req.session.user;
  try {
    const { couponCode, subtotal } = req.body;

    const coupon = await Coupon.findOne({ code: couponCode, isActive: true });
    if (!coupon) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired coupon." });
    }

    const userRecord = await user
      .findOne({ _id: userId })
      .populate("usedCoupons.couponId");
    const userCouponUsage = userRecord.usedCoupons.find(
      (uc) => String(uc.couponId._id) === String(coupon._id)
    );
    const userUseCount = userCouponUsage ? userCouponUsage.useCount : 0;

    if (userUseCount >= coupon.perUserLimit) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Coupon usage limit exceeded for this user.",
        });
    }

    if (coupon.usageLimit !== 0 && coupon.usedCount >= coupon.usageLimit) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Coupon usage limit exceeded globally.",
        });
    }

    if (subtotal < coupon.minPurchase) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Minimum purchase requirement not met.",
        });
    }

    if (coupon.expiryDate < new Date()) {
      return res
        .status(400)
        .json({ success: false, message: "Coupon has expired." });
    }

    const discountAmount = Math.min(
      coupon.discount,
      coupon.maxDiscount || coupon.discount
    );
    const newGrandTotal = subtotal - discountAmount;
    const finalGrandTotal = newGrandTotal > 0 ? newGrandTotal : 0;

    res.json({
      success: true,
      discountAmount,
      newSubtotal: subtotal,
      newGrandTotal: finalGrandTotal,
      couponCode,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = {
  cartLoad,
  cartAdd,
  removeFromCart,
  applyCoupon,
};
