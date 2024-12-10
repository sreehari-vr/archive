const mongoose = require('mongoose');
const Order = require('../../models/orderSchema'); 
const User = mongoose.model('user');
const Product = mongoose.model('product');

const listOrders = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const searchQuery = search
      ? {
          $or: [
            { _id: mongoose.isValidObjectId(search) ? search : null },
            { 
              userId: {
                $in: await User.find({
                  $or: [
                    { name: { $regex: new RegExp(search, "i") } },
                    { email: { $regex: new RegExp(search, "i") } }
                  ]
                }).distinct('_id')
              }
            },
            {
              "items.productId": {
                $in: await Product.find({
                  productName: { $regex: new RegExp(search, "i") }
                }).distinct('_id')
              }
            }
          ]
        }
      : {};

    const totalOrders = await Order.countDocuments(searchQuery);
    const totalPages = Math.ceil(totalOrders / limit);

    const orders = await Order.find(searchQuery)
      .populate({
        path: "userId",
        select: "email name"
      })
      .populate({
        path: "items.productId",
        select: "productName price images"
      })
      .sort({ orderDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();

    res.render("orders", {
      orders,
      currentPage: page,
      totalPages,
      totalOrders,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      search
    });

  } catch (error) {
    console.error("Error in listOrders:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const viewOrder = async (req, res) => {
  const { id } = req.params;
  try {
    const order = await Order.findById(id)
      .populate("userId items.productId")
      .exec();
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.render("orderDetail", { order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const updateOrderStatus = async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  try {
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    order.orderStatus = status;

    if (order.orderStatus === "Delivered") {
      order.items.forEach(item => {
        if (item.orderStatus !== "Cancelled" && item.orderStatus !== "Returned") {
          item.orderStatus = "Delivered";
        }
      });
    } else if (order.orderStatus === "Cancelled") {
      order.items.forEach(item => {
        if (item.orderStatus !== "Delivered" && item.orderStatus !== "Returned") {
          item.orderStatus = "Cancelled";
        }
      });
    }

    await order.save();

    return res.json({ success: true, message: "Order status updated", order });
  } catch (error) {
    console.error("Error updating order status:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};


const updatePaymentStatus = async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  try {
    const order = await Order.findByIdAndUpdate(
      orderId,
      { paymentStatus: status },
      { new: true }
    );

    if (!order) return res.status(404).json({ error: "Order not found" });
    return res.json({
      success: true,
      message: "Payment status updated",
      order,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const updateItemStatus = async (req, res) => {
  const { orderId, itemId } = req.params; 
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: "Status is required" });
  }

  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const item = order.items.find((item) => String(item._id) === itemId);
    if (!item) {
      return res.status(404).json({ error: "Item not found in order" });
    }

    if (!["Pending", "Delivered", "Shipped", "Cancelled", "Returned", "Processing"].includes(status)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    item.orderStatus = status; 
    await order.save(); 

    return res.json({ message: "Item status updated successfully", updatedItem: item });
  } catch (error) {
    console.error("Error updating item status:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};



const updateItemPaymentStatus = async (req, res) => {
  const { orderId, itemId } = req.params;
  const { paymentStatus } = req.body;

  try {
    const order = await Order.findById(orderId);
    const item = order.items.id(itemId);

    if (!item) return res.status(404).json({ error: "Item not found" });

    item.paymentStatus = paymentStatus;
    await order.save();

    res.json({ message: "Item payment status updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  listOrders,
  viewOrder,
  updateOrderStatus,
  updatePaymentStatus,
  updateItemStatus,
  updateItemPaymentStatus
};
