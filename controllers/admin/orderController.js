const mongoose = require("mongoose");
const Order = require("../../models/orderSchema");
const User = mongoose.model("user");
const Product = mongoose.model("product");
const Coupon = require("../../models/couponSchema");
const Wallet = require("../../models/walletSchema");
const HTTP_STATUS_CODES = require("../../utils/httpStatusCodes");

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
                    { email: { $regex: new RegExp(search, "i") } },
                  ],
                }).distinct("_id"),
              },
            },
            {
              "items.productId": {
                $in: await Product.find({
                  productName: { $regex: new RegExp(search, "i") },
                }).distinct("_id"),
              },
            },
          ],
        }
      : {};

    const totalOrders = await Order.countDocuments(searchQuery);
    const totalPages = Math.ceil(totalOrders / limit);

    const orders = await Order.find(searchQuery)
      .populate({
        path: "userId",
        select: "email name",
      })
      .populate({
        path: "items.productId",
        select: "productName price images",
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
      search,
    });
  } catch (error) {
    console.error("Error in listOrders:", error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({ error: "Internal server error" });
  }
};

const viewOrder = async (req, res) => {
  const { id } = req.params;
  try {
    const order = await Order.findById(id)
      .populate("userId items.productId")
      .exec();
    if (!order) return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({ error: "Order not found" });
    res.render("orderDetail", { order });
  } catch (error) {
    console.error(error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({ error: "Internal server error" });
  }
};

const notifications = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("userId", "name email")
      .populate("items.productId", "productName price");
    res.render("notifications", { orders });
  } catch (error) {
    console.error(error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({ error: "Internal server error" });
  }
};

const orderReturnApprove = async (req, res) => {
  const { orderId } = req.params;
  try {
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      {
        orderStatus: "Returned",
        paymentStatus: "Refunded",
        "items.$[].orderStatus": "Returned",
        "items.$[].paymentStatus": "Refunded",
      },
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        error: "Order not found",
        message: "Unable to find the specified order.",
      });
    }

    const walletRefund = updatedOrder.totalAmount;
    if (walletRefund > 0) {
      let wallet = await Wallet.findOne({ userId: updatedOrder.userId });
      if (!wallet) {
        wallet = new Wallet({
          userId: updatedOrder.userId,
          balance: 0,
          transactionHistory: [],
        });
      }
      wallet.balance += walletRefund;
      wallet.transactionHistory.push({
        type: "Credit",
        amount: walletRefund,
        description: `Refund for returned order ${orderId}`,
      });
      await wallet.save();
    }

    res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      message: "Order return approved successfully!",
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Error approving order return:", error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: "Internal server error",
      message: "Failed to process the return. Please try again later.",
    });
  }
};

const orderReturnReject = async (req, res) => {
  const { orderId } = req.params;
  try {
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { orderStatus: "Return Rejected", returnReason: null },
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        error: "Order not found",
        message: "Unable to find the specified order.",
      });
    }

    res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      message: "Order return rejected successfully!",
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Error rejecting order return:", error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: "Internal server error",
      message: "Failed to process the return. Please try again later.",
    });
  }
};

const calculateOrderTotals = (order) => {
  const activeItems = order.items.filter(
    (item) => item.orderStatus !== "Cancelled"
  );

  const originalItemsTotal = activeItems.reduce((sum, item) => {
    return sum + item.price * item.quantity;
  }, 0);

  const totalDiscount = activeItems.reduce((sum, item) => {
    return sum + item.itemDiscount;
  }, 0);

  const finalTotal = Math.max(0, originalItemsTotal - totalDiscount);

  return {
    originalItemsTotal,
    totalDiscount,
    finalTotal,
  };
};

const itemReturnApprove = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { returnReason } = req.body;

    const order = await Order.findOne({ _id: orderId }).populate(
      "items.productId"
    );

    if (!order) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).send("Order not found");
    }

    const item = order.items.find((item) => String(item._id) === itemId);
    if (!item || item.orderStatus !== "Return Pending") {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).send("Invalid item or return not eligible.");
    }

    item.orderStatus = "Returned";
    item.returnReason = returnReason || item.returnReason;

    if (item.paymentStatus === "Paid") {
      item.paymentStatus = "Refunded";

      const refundAmount = item.price * item.quantity - item.itemDiscount;

      let wallet = await Wallet.findOne({ userId: order.userId });
      if (!wallet) {
        wallet = new Wallet({
          userId: order.userId,
          balance: 0,
          transactionHistory: [],
        });
      }

      wallet.balance += refundAmount;
      wallet.transactionHistory.push({
        type: "Credit",
        amount: refundAmount,
        description: `Refund for returned item in order ${order._id}`,
      });
      await wallet.save();
    } else {
      item.paymentStatus = "N/A";
    }

    const product = await Product.findById(item.productId._id);
    if (product) {
      product.quantity += item.quantity;
      await product.save();
    }

    // Recalculate order totals
    const { finalTotal } = calculateOrderTotals(order);
    order.totalAmount = finalTotal;

    // Update overall order status
    const allReturned = order.items.every(
      (item) =>
        item.orderStatus === "Returned" || item.orderStatus === "Cancelled"
    );

    if (allReturned) {
      order.orderStatus = "Returned";
      order.paymentStatus = "Refunded";
    } else if (order.paymentStatus === "Paid") {
      order.paymentStatus = "Partially Refunded";
    }

    await order.save();

    res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      message: `Item return approved successfully for item ID ${itemId}`,
      order: order,
    });
  } catch (error) {
    console.error("Error approving item return:", error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).send("Error processing return approval");
  }
};

const itemReturnReject = async (req, res) => {
  const { orderId, itemId } = req.params;
  try {
    const updatedOrder = await Order.findOneAndUpdate(
      { _id: orderId, "items._id": itemId },
      {
        $set: {
          "items.$.orderStatus": "Return Rejected",
          "items.$.returnReason": null,
        },
      },
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        error: "Order or item not found",
        message: "Unable to find the specified order or item.",
      });
    }

    res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      message: `Item return rejected successfully for item ID ${itemId}!`,
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Error rejecting item return:", error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: "Internal server error",
      message: "Failed to process the item return. Please try again later.",
    });
  }
};

const updateOrderStatus = async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  try {
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({ error: "Order not found" });
    }

    const userId = order.userId;
    order.orderStatus = status;

    if (order.orderStatus === "Delivered") {
      order.paymentStatus = "Paid";
      order.items.forEach((item) => {
        if (
          item.orderStatus !== "Cancelled" &&
          item.orderStatus !== "Returned"
        ) {
          item.orderStatus = "Delivered";
          item.paymentStatus = "Paid";
        }
      });
    } else if (order.orderStatus === "Cancelled") {
      if (order.paymentStatus === "paid") {
        order.paymentStatus = "Refunded";
        order.items.forEach((item) => {
          item.paymentStatus = "Refunded";
        });
      } else {
        order.paymentStatus = "N/A";
        order.items.forEach((item) => {
          item.paymentStatus = "N/A";
        });
      }
      order.items.forEach((item) => {
        if (
          item.orderStatus !== "Delivered" &&
          item.orderStatus !== "Returned"
        ) {
          item.orderStatus = "Cancelled";
        }
      });
    } else if (order.orderStatus === "Shipped") {
      order.items.forEach((item) => {
        if (
          item.orderStatus !== "Delivered" &&
          item.orderStatus !== "Returned"
        ) {
          item.orderStatus = "Shipped";
        }
      });
    }

    if (order.orderStatus === "Cancelled") {
      const productUpdates = order.items.map((item) => ({
        updateOne: {
          filter: { _id: item.productId },
          update: { $inc: { quantity: item.quantity } },
        },
      }));
      await Product.bulkWrite(productUpdates);

      if (
        order.paymentMethod === "wallet" ||
        order.paymentMethod === "razorpay"
      ) {
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
      }
    }

    await order.save();

    return res.json({ success: true, message: "Order status updated", order });
  } catch (error) {
    console.error("Error updating order status:", error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({ error: "Internal server error" });
  }
};


const updateItemStatus = async (req, res) => {
  const { orderId, itemId } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ error: "Status is required" });
  }

  if (
    ![
      "Pending",
      "Delivered",
      "Shipped",
      "Cancelled",
      "Returned",
      "Processing",
    ].includes(status)
  ) {
    return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ error: "Invalid status value" });
  }

  try {
    const order = await Order.findOne({ _id: orderId }).populate(
      "items.productId"
    );
    if (!order) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({ error: "Order not found" });
    }

    const item = order.items.find((item) => String(item._id) === itemId);
    if (!item) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({ error: "Item not found in order" });
    }

    const userId = order.userId;
    item.orderStatus = status;

    switch (status) {
      case "Delivered":
        item.paymentStatus = "Paid";
        if (order.items.every((item) => item.orderStatus === "Delivered")) {
          order.orderStatus = "Delivered";
          order.paymentStatus = "Paid";
        }
        break;

      case "Cancelled":
        item.orderStatus = "Cancelled";

        if (item.paymentStatus === "Paid") {
          item.paymentStatus = "Refunded";

          const refundAmount = item.price * item.quantity - item.itemDiscount;

          let wallet = await Wallet.findOne({ userId });
          if (!wallet) {
            wallet = new Wallet({
              userId,
              balance: 0,
              transactionHistory: [],
            });
          }

          wallet.balance += refundAmount;
          wallet.transactionHistory.push({
            type: "Credit",
            amount: refundAmount,
            description: `Refund for cancelled item in order ${order._id}`,
          });
          await wallet.save();
        } else {
          item.paymentStatus = "N/A";
        }

        const product = await Product.findById(item.productId._id);
        if (product) {
          product.quantity += item.quantity;
          await product.save();
        }

        const { finalTotal } = calculateOrderTotals(order);
        order.totalAmount = finalTotal;

        const allCancelled = order.items.every(
          (item) => item.orderStatus === "Cancelled"
        );

        if (allCancelled) {
          order.orderStatus = "Cancelled";
          order.paymentStatus =
            order.paymentStatus === "Paid" ||
            order.paymentStatus === "Partially Refunded"
              ? "Refunded"
              : "N/A";
        } else if (order.paymentStatus === "Paid") {
          order.paymentStatus = "Partially Refunded";
        }
        break;

      case "Shipped":
        if (order.items.every((item) => item.orderStatus === "Shipped")) {
          order.orderStatus = "Shipped";
        }
        break;

      default:
        break;
    }

    await order.save();

    return res.json({
      message: "Item status updated successfully",
      updatedItem: item,
      updatedOrder: order,
    });
  } catch (error) {
    console.error("Error updating item status:", error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({ error: "Internal server error" });
  }
};


module.exports = {
  listOrders,
  viewOrder,
  updateOrderStatus,
  updateItemStatus,
  notifications,
  orderReturnApprove,
  orderReturnReject,
  itemReturnApprove,
  itemReturnReject,
};
