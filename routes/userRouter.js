const express = require("express");
const router = express.Router()
const passport = require("passport")

const userController = require("../controllers/user/userController")
const cartController = require("../controllers/user/cartController")
const orderController = require("../controllers/user/orderController")
const wishlistController = require("../controllers/user/wishlistController")

const { adminAuth, userAuth } = require("../middleware/auth");
const { find } = require("../models/productSchema");
const user = require('../models/userSchema')

router.get("/", userAuth, userController.loadHomepage)
router.get("/signup", userController.loadSignup)
router.get("/login", userController.loadLogin)
router.post("/login", userController.login)
router.post("/signup", userController.signup)
router.post("/verify-otp", userController.verifyOtp)
router.post("/resend-otp", userController.resendOtp)
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/signup' }), (req, res) => {
    req.session.user = req.user._id;
    res.redirect('/')
})
router.get("/productDetail/:id", userController.loadDetailPage)
router.get("/logout", userController.logout)
router.get("/userProfile", userController.renderUserProfile)
router.get("/shop", userAuth, userController.loadShop)


router.get("/changePassword", userAuth, userController.loadChangePass)
router.post("/changePassword", userAuth, userController.changePassword)


router.get("/changeEmail", userAuth, userController.loadChangeEmail)
router.post("/changeEmail", userAuth, userController.verifyEmail)
router.post("/verify-email-otp", userAuth, userController.verifyEmailOtp)
router.post('/update-email', userAuth, userController.updateEmail)

router.get('/addAddress', userAuth, userController.loadAddAddress)
router.post('/addAddress', userAuth, userController.addAddress)

router.get('/editAddress/:id', userAuth, userController.loadEditAddress)
router.post('/editAddress/:id', userAuth, userController.editAddress)

router.get('/deleteAddress/:id', userAuth, userController.deleteAddress)

router.get('/cart', userAuth, cartController.cartLoad)
router.post('/cart/:id', userAuth, cartController.cartAdd)
router.get('/cart/remove/:id', userAuth, cartController.removeFromCart)
router.post('/couponApply', userAuth, cartController.applyCoupon)


router.post('/checkout', userAuth, userController.loadCheckout)


router.post('/placeOrder', userAuth, orderController.placeOrder)

router.get('/orderConfirmation/:id', userAuth, orderController.orderConfirmation)


router.get('/orderCancel/:orderId/:itemId', userAuth, orderController.orderCancel)
router.get('/orderReturn/:orderId/:itemId', userAuth, orderController.orderReturn)

router.get('/forgotPass', userController.loadForgotPassword)
router.post('/forgotPass', userController.verifyForgotPass)
router.post('/verifyForgotPassOtp', userController.verifyForgotPassOtp)
router.post('/newPassword', userController.newPassword)

router.get('/wishlist', userAuth, wishlistController.loadWishlist)
router.post('/wishlist/:id', userAuth, wishlistController.addWishlist)
router.get('/wishlist/remove/:id', userAuth, wishlistController.removeWishlist)
router.get('/orderDetailUser/:orderId', userAuth, orderController.orderDetailUser)



module.exports = router