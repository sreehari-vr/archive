const user = require("../../models/userSchema");
const product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Cart = require("../../models/cartSchema");
const Order = require("../../models/orderSchema");

const placeOrder = async(req,res) => {
    try {
        const userId = req.session.user;
        const { selectedAddress, paymentMethod } = req.body;
        const userAddresses = await Address.findOne({userId});

        const address = userAddresses.address.find(addr=>addr._id.toString()===selectedAddress)
        const cart = await Cart.findOne({ userId }).populate("items.productId");
        if (!cart || cart.items.length === 0) {
          return res.status(400).send("Your cart is empty.");
        }
    
        const totalAmount = cart.grandTotal
    
        const newOrder = new Order({
          userId,
          items: cart.items.map(item => ({
            productId: item.productId._id,
            quantity: item.quantity,
            price: item.productId.salePrice,
            status: "Pending",
          })),
          totalAmount,
          address: {
            addressType:address.addressType,
            name:address.name,
            city:address.city,
            landMark:address.landMark,
            state:address.state,
            pincode:address.pincode,
            phone:address.phone,
            altPhone:address.altPhone
          },
          paymentMethod
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

  const orderCancel = async (req, res) => {
    try {  
      const {orderId,itemId} = req.params;
      const userId = req.session.user;
      const order = await Order.findOne({_id:orderId,userId});
      if (!order) {
        return res.status(404).send("Order not found");
      }
      const item = order.items.id(itemId)

      item.status = 'Cancelled'

      await order.save();

      res.redirect("/userProfile");
    } catch (error) {
      console.error(error);
      res.status(500).send("Error fetching order");
    }
  };

module.exports = {
    placeOrder,
    orderConfirmation,
    orderCancel
}