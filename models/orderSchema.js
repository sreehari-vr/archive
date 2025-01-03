const mongoose = require("mongoose");
const { Schema } = mongoose;

const orderSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "user",
    required: true,
  },
  items: [
    {
      productId: {
        type: Schema.Types.ObjectId,
        ref: "product",
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
      },
      price: {
        type: Number,
        required: true,
      },
      itemDiscount: {
        type: Number,
        default: 0,
      },
      orderStatus: {
        type: String,
        enum: [
          "Pending",
          "Delivered",
          "Shipped",
          "Cancelled",
          "Returned",
          "Processing",
          "Return Rejected",
          "Return Pending"
        ],
        default: "Pending",
      },
      paymentStatus: {
        type: String,
        enum: ["Pending", "Failed", "Refunded", "Paid", "N/A"],
        default: "Pending",
      },
      returnReason: { 
        type: String,
        default: null
      }
    },
  ],
  grandTotalAmount: {
    type: Number,
    required: true,
  },
  totalAmount: {
    type: Number,
    required: true,
  },
  address: {
    addressType: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    landMark: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      required: true,
    },
    pincode: {
      type: Number,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    altPhone: {
      type: String,
      required: false,
    },
  },
  orderDate: {
    type: Date,
    default: Date.now,
  },
  paymentMethod: {
    type: String,
    enum: ["cod", "razorpay", "wallet"],
    default: "cod",
    required: true,
  },
  orderStatus: {
    type: String,
    enum: [
      "Pending",
      "Delivered",
      "Shipped",
      "Cancelled",
      "Returned",
      "Processing",
      "Return Rejected",
      "Return Pending"
    ],
    default: "Pending",
  },
  discount:{
    type: Number,
    default: 0,
  },
  paymentStatus: {
    type: String,
    enum: ["Pending", "Failed", "Refunded", "Paid", "Partially Refunded", "N/A"],
    default: "Pending",
  },
  returnReason: { 
    type: String,
    default: null
  },
  razorpayOrderId: {
    type: String,
    required: false, 
  },
  couponId: {
    type: Schema.Types.ObjectId,
    ref: "Coupon",
    default: null,
  }
});

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;
