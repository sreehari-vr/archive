const user = require("../../models/userSchema");
const product = require("../../models/productSchema");
const Address = require("../../models/addressSchema")
const Cart = require("../../models/cartSchema")


const cartLoad = async (req,res) => {
    const userId = req.session.user;
    try {
        const cart = await Cart.findOne({userId}).populate('items.productId')
        res.render('cart',{cart});
    } catch (error) {
    console.log("page not loading:", error);
    res.status(500).send("Server error");
    }
}

const cartAdd = async (req,res) => {
    const userId = req.session.user;
    const productId = req.params.id;
    const { quantity } = req.body;
    try {
        let cart = await Cart.findOne({userId});
        const quantityToAdd = parseInt(quantity, 10);
        if (cart) {
            const productIndex = cart.items.findIndex(item => item.productId.toString() === productId);

            if (productIndex > -1) {
                cart.items[productIndex].quantity += quantityToAdd;
            } else {
                cart.items.push({ productId, quantity: quantityToAdd });
            }
        } else {
            cart = new Cart({
                userId,
                items: [{ productId, quantity: quantityToAdd }]
            });
        }
        await cart.save()

        res.redirect('/cart')
    } catch (error) {
        console.error(error)
    }
}

const removeFromCart = async (req,res) => {
    const userId = req.session.user;
    const productId = req.params.id;
    try {
        const userCart = await Cart.findOne({userId});
        const removingProduct = userCart.items.find(id=>id.productId.toString()===productId) 
        await Cart.updateOne({userId},{$pull:{items:{_id:removingProduct}}});
        res.redirect('/cart')

    } catch (error) {
        console.error(error)

    }
}



module.exports=({
    cartLoad,
    cartAdd,
    removeFromCart
})