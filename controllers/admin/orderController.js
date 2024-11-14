const user = require("../../models/userSchema");
const product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Cart = require("../../models/cartSchema");
const Order = require("../../models/orderSchema");

const loadOrderManage = async(req,res)=>{
    try {
        res.render('orderManage')
    } catch (error) {
        
    }
}

module.exports = {
    loadOrderManage
}