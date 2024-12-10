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

    for (const item of cart.items) {
      const Product = await product.findById(item.productId._id);
      if (!Product || Product.quantity < item.quantity) {
        return res.status(400).send(`Not enough stock for product: ${item.productId.productName}`);
      }
    }

    let coupon = null;
    let couponId = null;

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
        couponId = coupon._id;
      }
    }

    let paymentStatus = 'Pending'; 

    const newOrder = new Order({
      userId,
      items: cart.items.map((item) => ({
        productId: item.productId._id,
        quantity: item.quantity,
        price: item.productId.salePrice,
        paymentStatus: paymentMethod === "wallet" ? "Paid" : "Pending"
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
      paymentStatus: paymentMethod === "wallet" ? "Paid" : "Pending",
      razorpayOrderId: paymentMethod === 'razorpay' && !paymentFailed ? req.body.razorpay_order_id : null,
      couponId
    });

    await newOrder.save();

    if (paymentMethod === 'razorpay') {
      paymentStatus = req.body.paymentStatus || 'Failed'; 

      if (paymentStatus === 'Success') {
        newOrder.paymentStatus = 'Paid';
      } else {
        newOrder.paymentStatus = 'Failed';
      }

      await newOrder.save();
    }

    if (!paymentFailed) {
      for (const item of cart.items) {
        const Product = await product.findById(item.productId._id);
        if (Product) {
          Product.quantity = Math.max(0, Product.quantity - item.quantity);
          await Product.save();
        }
      }

      await Cart.findOneAndUpdate({ userId }, { items: [] });

      if (paymentMethod === 'wallet') {
        let wallet = await Wallet.findOne({ userId });
      

        if (!wallet) {
          wallet = new Wallet({
            userId,
            balance: 0, 
            transactionHistory: [], 
          });
          await wallet.save();
        }
      
        if (wallet.balance < totalAmount) {
          return res.status(400).json({ success: false, message: "Insufficient wallet balance." });
        }
      
        wallet.balance -= totalAmount;
        wallet.transactionHistory.push({
          type: "Debit",
          amount: totalAmount,
          description: `Spent for order ${newOrder._id}`,
        });
        await wallet.save();
      }
      

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

const paymentFailure = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate(
      "items.productId"
    );
    if (!order) return res.status(404).send("Order not found");

    res.render("paymentFailure", { order });
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
      order.paymentStatus="Refunded"
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


const calculateOrderTotals = (order, coupon) => {
  const originalItemsTotal = order.items.reduce((sum, item) => {
    return sum + (item.orderStatus !== 'Cancelled' ? item.price * item.quantity : 0);
  }, 0);

  let finalDiscount = 0;
  if (coupon && originalItemsTotal >= coupon.minPurchase) {
    finalDiscount = coupon.discount;
  }

  const finalTotal = Math.max(0, originalItemsTotal - finalDiscount);

  return {
    originalItemsTotal,
    finalDiscount,
    finalTotal,
  };
};

const itemCancel = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const userId = req.session.user;
    const order = await Order.findOne({ _id: orderId, userId }).populate(
      "items.productId"
    );
    if (!order) {
      return res.status(404).send("Order not found");
    }

    const item = order.items.find((item) => String(item._id) === itemId);
    if (!item || item.orderStatus === "Cancelled") {
      return res.status(400).send("Invalid item or already cancelled.");
    }

    item.orderStatus = "Cancelled";

    const Product = await product.findById(item.productId._id);
    if (Product) {
      Product.quantity += item.quantity;
      await Product.save();
    }

    const coupon = order.couponId ? await Coupon.findById(order.couponId) : null;

    const { originalItemsTotal, finalDiscount, finalTotal } = calculateOrderTotals(
      order,
      coupon
    );

    const paidAmount = order.totalAmount; 
    const newTotal = finalTotal; 
    const walletRefund = Math.max(0, paidAmount - newTotal);

    if (order.paymentStatus === "Paid") {
      let wallet = await Wallet.findOne({ userId });
      if (!wallet) {
        wallet = new Wallet({
          userId,
          balance: 0,
          transactionHistory: [],
        });
      }
      wallet.balance += walletRefund;
      wallet.transactionHistory.push({
        type: "Credit",
        amount: walletRefund,
        description: `Refund for cancelled item in order ${order._id}`,
      });
      await wallet.save();
    }

    order.totalAmount = finalTotal;
    order.discount = finalDiscount;
    if (!finalDiscount) {
      order.couponId = null;
    }

    const allCancelled = order.items.every((item) => item.orderStatus === "Cancelled");
    if (allCancelled) {
      order.orderStatus = "Cancelled";
      order.paymentStatus = order.paymentStatus === "Paid" ? "Refunded" : order.paymentStatus;
    } else if (order.paymentStatus === "Paid") {
      order.paymentStatus = "Partially Refunded";
    }

    await order.save();
    res.redirect("/userProfile");
  } catch (error) {
    console.error("Error cancelling item in order:", error);
    res.status(500).send("Error processing cancellation");
  }
};




const orderReturn = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    const userId = req.session.user;

    if (!reason || reason.trim() === "") {
      return res.status(400).send("Return reason is required");
    }

    const order = await Order.findOne({ _id: orderId, userId });

    if (!order) {
      return res.status(404).send("Order not found");
    }

    if (order.orderStatus !== "Delivered") {
      return res.status(400).send("Only delivered orders can be returned");
    }

    order.orderStatus = "Returned";
    if(order.paymentStatus = "Paid"){
      order.paymentStatus = "Refunded";
    }
    
    order.returnReason = reason;

    await order.save();
    res.redirect("/userProfile"); 
  } catch (error) {
    console.error(error);
    res.status(500).send("Error processing return");
  }
};

const itemReturn = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { reason } = req.body;
    const userId = req.session.user;

    if (!reason || reason.trim() === "") {
      return res.status(400).send("Return reason is required");
    }

    const order = await Order.findOne({ _id: orderId, userId });

    if (!order) {
      return res.status(404).send("Order not found");
    }

    const item = order.items.find((item) => String(item._id) === itemId);

    if (!item) {
      return res.status(404).send("Item not found in order");
    }

    if (item.orderStatus !== "Delivered") {
      return res.status(400).send("Only delivered items can be returned");
    }

    if (item.orderStatus === "Returned") {
      return res.status(400).send("Item is already returned");
    }

    item.orderStatus = "Returned";
    item.returnReason = reason;

    const remainingItemsTotal = order.items
      .filter((i) => i.orderStatus !== "Returned")
      .reduce((sum, i) => sum + i.price * i.quantity, 0);

    const coupon = order.couponId ? await Coupon.findById(order.couponId) : null;
    let finalDiscount = 0;
    if (coupon && remainingItemsTotal >= coupon.minPurchase) {
      finalDiscount = coupon.discount;
    }

    const newTotal = Math.max(0, remainingItemsTotal - finalDiscount);

    const paidAmount = order.totalAmount;
    const walletRefund = Math.max(0, paidAmount - newTotal);

    if (order.paymentStatus === "Paid" && walletRefund > 0) {
      let wallet = await Wallet.findOne({ userId });
      if (!wallet) {
        wallet = new Wallet({
          userId,
          balance: 0,
          transactionHistory: [],
        });
      }
      wallet.balance += walletRefund;
      wallet.transactionHistory.push({
        type: "Credit",
        amount: walletRefund,
        description: `Refund for returned item in order ${order._id}`,
      });
      await wallet.save();
    }

    order.totalAmount = newTotal;
    order.discount = finalDiscount;
    if (!finalDiscount) {
      order.couponId = null;
    }

    const allReturned = order.items.every((item) => item.orderStatus === "Returned");
    if (allReturned) {
      order.orderStatus = "Returned";
      order.paymentStatus = order.paymentStatus === "Paid" ? "Refunded" : order.paymentStatus;
    } else if (order.paymentStatus === "Paid") {
      order.paymentStatus = "Partially Refunded";
    }

    await order.save();
    res.redirect("/userProfile");
  } catch (error) {
    console.error("Error processing item return:", error);
    res.status(500).send("Error processing return");
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
      amount: order.totalAmount * 100, 
      currency: "INR",
      receipt: `order_${order._id}`,
    });

    order.razorpayOrderId = paymentOrder.id;
    await order.save();

    res.json({
      success: true,
      razorpayKey: process.env.RAZORPAYID, 
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
  retryPayment,
  itemCancel,
  itemReturn,
  paymentFailure
};
