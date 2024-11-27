const Order = require("../../models/orderSchema");

const listOrders = async (req, res) => {
  try {
    let search = "";
    if (req.query.search) {
      search = req.query.search;
    }

    let page = 1;
    if (req.query.page) {
      page = req.query.page;
    }
    const limit = 10;
    const skip = (page - 1) * limit;
    const orderData = await Order.find({
      $or: [
        {
          "items.productId.productName": {
            $regex: ".*" + search + ".*",
            $options: "i",
          },
        },
      ],
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    const totalOrders = await Order.countDocuments();
    const totalPages = Math.ceil(totalOrders / limit);

    const orders = await Order.find().populate("userId items.productId").exec();
    res.render("orders", {
      orders,
      data: orderData,
      currentPage: page,
      totalPages: totalPages,
      totalOrders: totalOrders,
    });
  } catch (error) {
    console.error(error);
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
    const order = await Order.findByIdAndUpdate(
      orderId,
      { orderStatus: status },
      { new: true }
    );

    if (!order) return res.status(404).json({ error: "Order not found" });
    return res.json({ success: true, message: "Order status updated", order });
  } catch (error) {
    console.error(error);
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

module.exports = {
  listOrders,
  viewOrder,
  updateOrderStatus,
  updatePaymentStatus,
};
