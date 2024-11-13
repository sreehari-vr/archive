const user = require("../../models/userSchema");
const product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Cart = require("../../models/cartSchema");
const Order = require("../../models/orderSchema");

const placeOrder = async(req,res) => {
    try {
        const userId = req.session.user;
        const { selectedAddress, paymentMethod } = req.body;
    
        const cart = await Cart.findOne({ userId }).populate("items.productId");
        if (!cart || cart.items.length === 0) {
          return res.status(400).send("Your cart is empty.");
        }
    
        const totalAmount = cart.items.reduce((total, item) =>
          total + item.productId.salePrice * item.quantity, 0
        );
    
        const newOrder = new Order({
          userId,
          items: cart.items.map(item => ({
            productId: item.productId._id,
            quantity: item.quantity,
            price: item.productId.salePrice
          })),
          totalAmount,
          address: selectedAddress,
          status: "Pending",
          paymentMethod
        });
    
        await newOrder.save();
    
        await Cart.findOneAndUpdate({ userId }, { items: [] });
    
        res.redirect(`/orderConfirmation/${newOrder._id}`);
      } catch (error) {
        console.error("Error placing order:", error);
        res.status(500).send("Error placing order");
      }
}


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


module.exports = {
    placeOrder,
    orderConfirmation
}