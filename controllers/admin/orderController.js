
const Order = require("../../models/orderSchema");

const listOrders = async (req, res) => {
    try {

      let search = "";
        if(req.query.search){
            search = req.query.search;
        }

    let page = 1;
    if (req.query.page) {
      page = req.query.page;
    }
    const limit = 10;
    const skip = (page - 1) * limit;
    const orderData = await Order.find({
      $or:[{ 'items.productId.productName': { $regex: ".*" + search + ".*", $options: 'i' } }]
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit).exec();

    const totalOrders = await Order.countDocuments();
    const totalPages = Math.ceil(totalOrders / limit);


      const orders = await Order.find().populate("userId items.productId").exec();
      res.render("orders", { orders, 
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
    const { orderId, itemId } = req.params; // Use both order ID and item ID from request parameters
    const { status } = req.body;
  
    try {
      const order = await Order.findOneAndUpdate(
        { _id: orderId, "items._id": itemId }, // Match the specific item within the order
        { $set: { "items.$.status": status } }, // Update only the matched item
        { new: true }
      );
  
      if (!order) return res.status(404).json({ error: "Order or item not found" });
      res.json({ success: true, message: "Item status updated"});
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  };
  
  
  

module.exports = {
    listOrders,
    viewOrder,
    updateOrderStatus
}