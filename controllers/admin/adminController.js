const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");

const bcrypt = require("bcrypt");



const loadAdminLogin = async (req, res) => {
  if (req.session.admin) {
    return res.redirect("/admin/adminDash");
  }
  res.render("adminLogin", { message: null });
};



const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await User.findOne({ email: email, isAdmin: true });
    if (admin) {
      const passwordMatch = bcrypt.compare(password, admin.password);
      if (passwordMatch) {
        req.session.admin = true;
        return res.redirect("/admin/adminDash");
      } else {
        return res.redirect("/admin/login");
      }
    } else {
      return res.redirect("/admin/login");
    }
  } catch (error) {
    console.error("Admin login error:", error);
    res.render("adminLogin", { message: "Login failed. Please try again." });
  }
};



const loadAdminDash = async (req, res) => {
  try {
    if (req.session.admin) {
      return res.render("adminDash");
    }
  } catch (error) {
    console.error("Error loading admin dashboard:", error);
  }
};



const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.log("Error destroying session", err);
      }
      res.redirect("/admin/login");
    });
  } catch (error) {
    console.log(error);
  }
};


const getSalesReport = async (req,res) => {
  try{
    const cart = await Cart.find()
    const order = await Order.find()
    const product = await Product.find()

    const totalOrders = order.length
    const totalAmount = order.reduce((acc,curr)=>{
      acc = acc+curr.totalAmount
      return acc
  },0)

    const totalCouponOffers = cart.reduce((acc,curr)=>{
      acc = acc + curr.discount
      return acc
    },0)

    const totalOffers = product.reduce((sum, curr) => {
      return sum + (curr.regularPrice - curr.salePrice);
    }, 0);

    const totalDelivered = order.filter((o) => o.orderStatus === "Delivered").length;

     const totalShipped = order.filter((o) => o.orderStatus === "Shipped").length;

     const totalReturned = order.filter((o) => o.orderStatus === "Returned").length;

     const totalCancelled = order.filter((o) => o.orderStatus === "cancelled").length;


    res.render('report',{
      totalAmount,
      totalOrders,
      totalCouponOffers,
      totalOffers,
      totalDelivered,
      totalShipped,
      totalReturned,
      totalCancelled
    })
  }catch(error){
    console.error(error)
  }
}
module.exports = { loadAdminLogin, login, loadAdminDash, logout, getSalesReport };
