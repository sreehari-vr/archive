const user = require("../../models/userSchema");
const Coupon = require("../../models/couponSchema");
const Cart = require("../../models/cartSchema");
const product = require("../../models/productSchema");
const HTTP_STATUS_CODES = require("../../utils/httpStatusCodes");


const cartLoad = async (req, res) => {
  const userId = req.session.user;
  try {
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    const coupon = await Coupon.find({ isActive: true, deletedAt: null });

    res.render("cart", { cart, coupon });
  } catch (error) {
    console.log("page not loading:", error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).send("Server error");
  }
};

const cartAdd = async (req, res) => {
  const userId = req.session.user;
  const productId = req.params.id;
  const { quantity } = req.body;
  
  try {
    let cart = await Cart.findOne({ userId }).populate("items.productId");
    const quantityToAdd = parseInt(quantity, 10);
    
    if (cart) {
      const productIndex = cart.items.findIndex(
        (item) => item.productId._id.toString() === productId
      );

      if (productIndex > -1) {
        res.redirect("/cart");
        return;
      } else {
        // Add new item
        cart.items.push({ productId, quantity: quantityToAdd });
      }
      
      // Recalculate totals
      await cart.populate("items.productId");
      let subTotal = 0;
      cart.items.forEach(item => {
        subTotal += item.productId.salePrice * item.quantity;
      });
      
      cart.subTotal = subTotal;
      
      // If there's an existing coupon, validate and update if necessary
      if (cart.appliedCouponCode) {
        const coupon = await Coupon.findOne({ 
          code: cart.appliedCouponCode, 
          isActive: true,
          deletedAt: null 
        });
        
        if (!coupon || subTotal < coupon.minPurchase) {
          // Remove coupon if no longer valid
          cart.discount = 0;
          cart.appliedCouponCode = null;
          cart.grandTotal = subTotal;
        } else {
          // Recalculate discount
          const discountAmount = Math.min(
            coupon.discount,
            coupon.maxDiscount || coupon.discount
          );
          cart.discount = discountAmount;
          cart.grandTotal = subTotal - discountAmount;
        }
      } else {
        cart.grandTotal = subTotal;
      }
      
    } else {
      // Create new cart
      const Product = await product.findById(productId);
      const subTotal = Product.salePrice * quantityToAdd;
      
      cart = new Cart({
        userId,
        items: [{ productId, quantity: quantityToAdd }],
        subTotal: subTotal,
        grandTotal: subTotal,
        discount: 0,
        appliedCouponCode: null
      });
    }
    
    await cart.save();
    res.redirect("/cart");
    
  } catch (error) {
    console.error("Error adding to cart:", error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, message: "Server error" });
  }
};

const removeFromCart = async (req, res) => {
  const userId = req.session.user;
  const productId = req.params.id;
  
  try {
    // Find cart and populate product details
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    
    if (!cart) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({ 
        success: false, 
        message: "Cart not found" 
      });
    }

    // Find and remove the product
    const removingProductIndex = cart.items.findIndex(
      item => item.productId._id.toString() === productId
    );

    if (removingProductIndex === -1) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({ 
        success: false, 
        message: "Product not found in cart" 
      });
    }

    // Remove the item
    cart.items.splice(removingProductIndex, 1);

    // Recalculate subtotal
    let subTotal = 0;
    cart.items.forEach(item => {
      subTotal += item.productId.salePrice * item.quantity;
    });
    
    cart.subTotal = subTotal;

    // Check if coupon is still valid after removal
    if (cart.appliedCouponCode) {
      const appliedCoupon = await Coupon.findOne({ 
        code: cart.appliedCouponCode,
        isActive: true,
        deletedAt: null
      });

      if (!appliedCoupon || subTotal < appliedCoupon.minPurchase) {
        // Clear coupon if subtotal is less than minimum purchase
        cart.discount = 0;
        cart.appliedCouponCode = null;
        cart.grandTotal = subTotal;
        
        await cart.save();
        return res.json({
          success: true,
          couponRemoved: true,
          message: "Product removed and coupon cleared as minimum purchase requirement not met",
          cart: {
            subTotal: cart.subTotal,
            discount: 0,
            grandTotal: cart.subTotal,
            items: cart.items.length,
            appliedCouponCode: null
          }
        });
      } else {
        // Recalculate discount if coupon is still valid
        const discountAmount = Math.min(
          appliedCoupon.discount,
          appliedCoupon.maxDiscount || appliedCoupon.discount
        );
        cart.discount = discountAmount;
        cart.grandTotal = subTotal - discountAmount;
      }
    } else {
      cart.grandTotal = subTotal;
    }

    await cart.save();

    res.json({
      success: true,
      message: "Product removed successfully",
      cart: {
        subTotal: cart.subTotal,
        discount: cart.discount,
        grandTotal: cart.grandTotal,
        items: cart.items.length,
        appliedCouponCode: cart.appliedCouponCode
      }
    });

  } catch (error) {
    console.error("Error removing from cart:", error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({ 
      success: false, 
      message: "Server error" 
    });
  }
};

const updateQuantity = async (req, res) => {
  const userId = req.session.user;
  const { productId, quantity } = req.body;
  
  try {
    // Find cart and validate
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({ 
        success: false, 
        message: "Cart not found" 
      });
    }

    // Update item quantity
    const itemIndex = cart.items.findIndex(
      item => item.productId.toString() === productId
    );
    if (itemIndex === -1) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({ 
        success: false, 
        message: "Product not found in cart" 
      });
    }

    // Update quantity
    cart.items[itemIndex].quantity = parseInt(quantity, 10);

    // Recalculate subtotal with populated products
    await cart.populate("items.productId");
    let subTotal = 0;
    cart.items.forEach(item => {
      subTotal += item.productId.salePrice * item.quantity;
    });
    
    cart.subTotal = subTotal;

    // Check coupon validity based on new subtotal
    if (cart.appliedCouponCode) {
      const appliedCoupon = await Coupon.findOne({ 
        code: cart.appliedCouponCode,
        isActive: true,
        deletedAt: null
      });

      if (!appliedCoupon || subTotal < appliedCoupon.minPurchase) {
        // Clear coupon if subtotal is less than minimum purchase
        cart.discount = 0;
        cart.appliedCouponCode = null;
        cart.grandTotal = subTotal;
        
        // Send a flag to frontend indicating coupon was removed
        await cart.save();
        return res.json({
          success: true,
          couponRemoved: true,
          message: "Coupon removed as minimum purchase requirement not met",
          cart: {
            subTotal: cart.subTotal,
            discount: 0,
            grandTotal: cart.subTotal,
            appliedCouponCode: null
          }
        });
      } else {
        // Recalculate discount if coupon is still valid
        const discountAmount = Math.min(
          appliedCoupon.discount,
          appliedCoupon.maxDiscount || appliedCoupon.discount
        );
        cart.discount = discountAmount;
        cart.grandTotal = subTotal - discountAmount;
      }
    } else {
      cart.grandTotal = subTotal;
    }

    await cart.save();

    res.json({
      success: true,
      cart: {
        subTotal: cart.subTotal,
        discount: cart.discount,
        grandTotal: cart.grandTotal,
        appliedCouponCode: cart.appliedCouponCode
      }
    });

  } catch (error) {
    console.error("Error updating quantity:", error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({ 
      success: false, 
      message: "Server error" 
    });
  }
};

const applyCoupon = async (req, res) => {
  const userId = req.session.user;
  try {
    const { couponCode, subtotal } = req.body;
    const cart = await Cart.findOne({ userId }).populate("items.productId");

    if (!cart) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({ success: false, message: "Cart not found" });
    }

    const coupon = await Coupon.findOne({ code: couponCode, isActive: true });
    if (!coupon) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ success: false, message: "Invalid or expired coupon." });
    }

    // Validate coupon usage
    const userRecord = await user.findOne({ _id: userId }).populate("usedCoupons.couponId");
    const userCouponUsage = userRecord.usedCoupons.find(
      (uc) => String(uc.couponId._id) === String(coupon._id)
    );
    const userUseCount = userCouponUsage ? userCouponUsage.useCount : 0;

    if (userUseCount >= coupon.perUserLimit) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Coupon usage limit exceeded for this user."
      });
    }

    if (coupon.usageLimit !== 0 && coupon.usedCount >= coupon.usageLimit) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Coupon usage limit exceeded globally."
      });
    }

    // Recalculate subtotal from cart items to ensure accuracy
    let calculatedSubTotal = 0;
    cart.items.forEach(item => {
      calculatedSubTotal += item.productId.salePrice * item.quantity;
    });

    if (calculatedSubTotal < coupon.minPurchase) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Minimum purchase requirement not met."
      });
    }

    if (coupon.expiryDate < new Date()) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ success: false, message: "Coupon has expired." });
    }

    const discountAmount = Math.min(
      coupon.discount,
      coupon.maxDiscount || coupon.discount
    );
    
    // Update cart with new values
    cart.subTotal = calculatedSubTotal;
    cart.discount = discountAmount;
    cart.appliedCouponCode = couponCode;
    cart.grandTotal = calculatedSubTotal - discountAmount;

    await cart.save();

    res.json({
      success: true,
      discountAmount,
      newSubtotal: calculatedSubTotal,
      newGrandTotal: cart.grandTotal,
      couponCode,
    });
  } catch (error) {
    console.error("Error applying coupon:", error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, message: "Server error." });
  }
};

// Remove coupon from cart
const removeCoupon = async (req, res) => {
  const userId = req.session.user;
  try {
    const cart = await Cart.findOne({ userId });
    
    if (!cart) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({ success: false, message: "Cart not found" });
    }

    // Clear all coupon-related fields
    cart.discount = 0;
    cart.appliedCouponCode = null;
    cart.grandTotal = cart.subTotal;
    
    await cart.save();

    res.json({
      success: true,
      message: "Coupon removed successfully",
      newGrandTotal: cart.grandTotal
    });
  } catch (error) {
    console.error("Error removing coupon:", error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, message: "Server error" });
  }
};

const coupons = async (req, res) => {
  try {
    const coupon = await Coupon.find({ isActive: true, deletedAt: null });
    res.render("coupons", { coupon });
  } catch (error) {
    console.log("page not loading:", error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).send("Server error");
  }
}

module.exports = {
  cartLoad,
  cartAdd,
  removeFromCart,
  updateQuantity,
  applyCoupon,
  removeCoupon,
  coupons
};
