const mongoose = require("mongoose");
const { Schema } = mongoose;

const orderSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "user",
    required: true
  },
  items: [
    {
      productId: {
        type: Schema.Types.ObjectId,
        ref: "product",
        required: true
      },
      quantity: {
        type: Number,
        required: true
      },
      price: {
        type: Number,
        required: true
      },
      status: {
        type: String,
        enum:['Pending','Shipped','Cancelled','Returned'],
        default: "pending"
      },
    }
  ],
  totalAmount: {
    type: Number,
    required: true
  },
  address: {
    addressType: {
      type: String,
      required: true
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
      required: true
    },
    state: {
      type: String,
      required: true
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
    }
  },
  
  orderDate: {
    type: Date,
    default: Date.now
  },
  paymentMethod: {
    type: String,
    enum: ["cod", "razorpay", "wallet"],
    default: 'cod',
    required: true,

  }
});

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;