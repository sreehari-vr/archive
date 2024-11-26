const user = require("../../models/userSchema");
const product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Cart = require("../../models/cartSchema");
const Order = require("../../models/orderSchema");
const Coupon = require('../../models/couponSchema')
const Wallet = require('../../models/walletSchema')

const placeOrder = async (req, res) => {
  try {
      const userId = req.session.user;
      const { selectedAddress, paymentMethod, couponCode } = req.body;

      const userAddresses = await Address.findOne({ userId });
      const address = userAddresses.address.find(addr => addr._id.toString() === selectedAddress);
      if (!address) {
          return res.status(400).send("Invalid address selected.");
      }

      const cart = await Cart.findOne({ userId }).populate("items.productId");
      if (!cart || cart.items.length === 0) {
          return res.status(400).send("Your cart is empty.");
      }

      const totalAmount = cart.grandTotal;

      let coupon = null;
      let userCouponUsage = null;

      if (couponCode) {
          coupon = await Coupon.findOne({ code: couponCode, isActive: true });
          const userRecord = await user.findOne({ _id: userId });

          if (coupon) {
              userCouponUsage = userRecord.usedCoupons.find(uc => String(uc.couponId) === String(coupon._id));
              if (userCouponUsage) {
                  userCouponUsage.useCount += 1; 
              } else {
                  userRecord.usedCoupons.push({
                      couponId: coupon._id,
                      useCount: 1, 
                  });
              }

              coupon.usedCount += 1;

              await userRecord.save(); 
              await coupon.save(); 
          }
      }

      const wallet = await Wallet.findOne({ userId });
      if (paymentMethod === "wallet") {
        if (!wallet || wallet.balance < totalAmount) {
            return res.status(400).send("Insufficient wallet balance.");
        }
        wallet.balance -= totalAmount;
        wallet.transactionHistory.push({
            type: "Debit",
            amount: totalAmount,
            description: `Purchase for order`,
        });
        await wallet.save();
    }
    

    const paymentStatus = paymentMethod === "wallet" || paymentMethod === "razorpay" ? "Paid" : "Pending";

      const newOrder = new Order({
          userId,
          items: cart.items.map(item => ({
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
          paymentMethod,
          paymentStatus
      });

      await newOrder.save();

      for (const item of cart.items) {
          const Product = await product.findById(item.productId._id);
          if (Product) {
              Product.quantity = Math.max(0, Product.quantity - item.quantity);
              await Product.save();
          }
      }

      await Cart.findOneAndUpdate({ userId }, { items: [] });
      

      if (paymentMethod === "razorpay") {
        return res.json({ success: true, orderId: newOrder._id });
    } else if (paymentMethod === "cod" || "wallet") {
        return res.redirect(`/orderConfirmation/${newOrder._id}`);
    }
    } catch (error) {
      console.error("Error placing order:", error);
      res.status(500).send("Error placing order.");
  }
};





const orderConfirmation = async (req, res) => {
    try {
      const order = await Order.findById(req.params.id).populate("items.productId");
      if (!order) return res.status(404).send("Order not found");
  
      res.render("orderConfirmation", { order });
    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).send("Error fetching order");
    }
  };

  const orderCancel = async (req, res) => {
    try {  
      const {orderId,itemId} = req.params;
      const userId = req.session.user;
      const order = await Order.findOne({_id:orderId,userId}).populate("items.productId");
      if (!order) {
        return res.status(404).send("Order not found");
      }

      order.orderStatus = 'Cancelled'

      for (const item of order.items) {
        const Product = await product.findById(item.productId);
        if (Product) {
          Product.quantity += item.quantity; 
          await Product.save(); 
        }
      }

      await order.save();

      let wallet = await Wallet.findOne({userId})

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
      const {orderId,itemId} = req.params;
      const userId = req.session.user;
      const order = await Order.findOne({_id:orderId,userId});
      if (!order) {
        return res.status(404).send("Order not found");
      }

      order.orderStatus = 'Returned'
      order.paymentStatus = 'Refund' 
      await order.save();

      res.redirect("/userProfile");
    } catch (error) {
      console.error(error);
      res.status(500).send("Error fetching order");
    }
  };

  const orderDetailUser = async (req,res) =>{
    try {
      const {orderId} = req.params
      const order = await Order.findById(orderId).populate('items.productId')
      res.render('orderDetailUser',{order})
    } catch (error) {
      console.error(error)
    }
  }

module.exports = {
    placeOrder,
    orderConfirmation,
    orderCancel,
    orderDetailUser,
    orderReturn
}