const user = require("../../models/userSchema");
const product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Cart = require("../../models/cartSchema");
const Order = require("../../models/orderSchema");
const Coupon = require("../../models/couponSchema");
const Wallet = require("../../models/walletSchema");
const Razorpay = require("razorpay");


const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const { selectedAddress, paymentMethod, couponCode, discount, paymentFailed } = req.body;

    const userAddresses = await Address.findOne({ userId });
    const address = userAddresses.address.find(
      (addr) => addr._id.toString() === selectedAddress
    );
    if (!address) {
      return res.status(400).send("Invalid address selected.");
    }

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.status(400).send("Your cart is empty.");
    }

    const totalAmount = cart.grandTotal;

    let coupon = null;
    if (couponCode) {
      coupon = await Coupon.findOne({ code: couponCode, isActive: true });
      if (coupon) {
        const userRecord = await user.findById(userId);
        const userCouponUsage = userRecord.usedCoupons.find(
          (uc) => String(uc.couponId) === String(coupon._id)
        );
        if (userCouponUsage) {
          userCouponUsage.useCount += 1;
        } else {
          userRecord.usedCoupons.push({ couponId: coupon._id, useCount: 1 });
        }

        coupon.usedCount += 1;
        await userRecord.save();
        await coupon.save();
      }
    }

    // Default value for paymentStatus (we'll update it later based on the payment result)
    let paymentStatus = 'Pending'; // Default status

    // Create the order object
    const newOrder = new Order({
      userId,
      items: cart.items.map((item) => ({
        productId: item.productId._id,
        quantity: item.quantity,
        price: item.productId.salePrice,
      })),
      totalAmount,
      address: {
        addressType: address.addressType,
        name: address.name,
        city: address.city,
        landMark: address.landMark,
        state: address.state,
        pincode: address.pincode,
        phone: address.phone,
        altPhone: address.altPhone,
      },
      discount,
      paymentMethod,
      paymentStatus, // Initial status
      razorpayOrderId: paymentMethod === 'razorpay' && !paymentFailed ? req.body.razorpay_order_id : null
    });

    await newOrder.save();

    if (paymentMethod === 'razorpay') {
      // Check Razorpay payment status
      paymentStatus = req.body.paymentStatus || 'Failed'; // Default to 'Failed' if not provided

      if (paymentStatus === 'Success') {
        newOrder.paymentStatus = 'Paid';
      } else {
        newOrder.paymentStatus = 'Failed';
      }

      // Save updated order status
      await newOrder.save();
    }

    // If the payment was successful, update product quantities and clear the cart
    if (!paymentFailed) {
      for (const item of cart.items) {
        const Product = await product.findById(item.productId._id);
        if (Product) {
          Product.quantity = Math.max(0, Product.quantity - item.quantity);
          await Product.save();
        }
      }

      await Cart.findOneAndUpdate({ userId }, { items: [] });

      // Return the order confirmation based on the payment method
      if (paymentMethod === "razorpay") {
        return res.json({ success: true, orderId: newOrder._id });
      } else if (paymentMethod === "cod" || paymentMethod === "wallet") {
        return res.redirect(`/orderConfirmation/${newOrder._id}`);
      }
    } else {
      return res.json({ success: false, message: "Payment failed", orderId: newOrder._id });
    }
  } catch (error) {
    console.error("Error placing order:", error);
    res.status(500).send("Error placing order.");
  }
};



const orderConfirmation = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate(
      "items.productId"
    );
    if (!order) return res.status(404).send("Order not found");

    res.render("orderConfirmation", { order });
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).send("Error fetching order");
  }
};

const orderCancel = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const userId = req.session.user;
    const order = await Order.findOne({ _id: orderId, userId }).populate(
      "items.productId"
    );
    if (!order) {
      return res.status(404).send("Order not found");
    }

    order.orderStatus = "Cancelled";
    if (order.paymentStatus==="Paid") {
      order.paymentStatus="Refund"
    }

    for (const item of order.items) {
      const Product = await product.findById(item.productId);
      if (Product) {
        Product.quantity += item.quantity;
        await Product.save();
      }
    }

    await order.save();

    let wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      wallet = new Wallet({
        userId,
        balance: order.totalAmount,
        transactionHistory: [
          {
            type: "Credit",
            amount: order.totalAmount,
            description: `Refund for canceled order ${order._id}`,
          },
        ],
      });
    } else {
      wallet.balance += order.totalAmount;
      wallet.transactionHistory.push({
        type: "Credit",
        amount: order.totalAmount,
        description: `Refund for canceled order ${order._id}`,
      });
    }

    await wallet.save();

    res.redirect("/userProfile");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching order");
  }
};

const orderReturn = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const userId = req.session.user;
    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) {
      return res.status(404).send("Order not found");
    }

    order.orderStatus = "Returned";
    order.paymentStatus = "Refund";
    await order.save();

    res.redirect("/userProfile");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching order");
  }
};

const orderDetailUser = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId).populate("items.productId");
    res.render("orderDetailUser", { order });
  } catch (error) {
    console.error(error);
  }
};


const razorpay = new Razorpay({
  key_id: process.env.RAZORPAYID,
  key_secret: process.env.RAZORPAYSECRET,
});

const retryPayment = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await Order.findById(orderId);
    
    if (!order || order.paymentStatus !== "Failed") {
      return res.json({ success: false, message: "Invalid order or payment already completed." });
    }

    const paymentOrder = await razorpay.orders.create({
      amount: order.totalAmount * 100, // Amount in paise
      currency: "INR",
      receipt: `order_${order._id}`,
    });

    // Update order with new Razorpay order ID
    order.razorpayOrderId = paymentOrder.id;
    await order.save();

    res.json({
      success: true,
      razorpayKey: process.env.RAZORPAYID, // Use your Razorpay key here
      amount: paymentOrder.amount,
      razorpayOrderId: paymentOrder.id,
      userName: req.session.user.name,
      userEmail: req.session.user.email,
      userPhone: req.session.user.phone,
    });
    
  } catch (error) {
    console.error("Error in retry payment:", error);
    res.json({ success: false, message: "Error in retrying payment." });
  }
};


const confirmPayment = async (req, res) => {
  const { orderId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;

  // Add Razorpay validation logic here (optional)
  console.log(req.body)
  
  const order = await Order.findById(orderId);
  if (order && order.razorpayOrderId === razorpayOrderId) {
    order.paymentStatus = "Paid";
    await order.save();

    const cart = await Cart.findOne({ userId: order.userId });
    if (cart) {
      for (const item of cart.items) {
        const Product = await product.findById(item.productId);
        if (Product) {
          Product.quantity = Math.max(0, Product.quantity - item.quantity);
          await Product.save();
        }
      }

      // Clear the cart after successful payment
      cart.items = [];
      await cart.save();
    }

    res.json({ success: true });
  } else {
    res.json({ success: false, message: "Invalid payment confirmation." });
  }
};


module.exports = {
  placeOrder,
  orderConfirmation,
  orderCancel,
  orderDetailUser,
  orderReturn,
  confirmPayment,
  retryPayment
};
