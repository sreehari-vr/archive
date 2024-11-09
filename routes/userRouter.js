const express = require("express");
const router = express.Router()
const passport= require("passport")
const userController = require("../controllers/user/userController")
const {adminAuth,userAuth} = require("../middleware/auth");
const { find } = require("../models/productSchema");
const user = require('../models/userSchema')

router.get("/",userAuth,userController.loadHomepage)
router.get("/signup",userController.loadSignup)
router.get("/login",userController.loadLogin)
router.post("/login",userController.login)
router.post("/signup",userController.signup)
router.post("/verify-otp",userController.verifyOtp)
router.post("/resend-otp",userController.resendOtp)
router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}));
router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/signup'}),(req,res)=>{
    req.session.user = req.user._id;
    res.redirect('/')})
router.get("/productDetail/:id",userController.loadDetailPage)
router.get("/logout",userController.logout)
router.get("/userProfile",userController.renderUserProfile)


router.get("/changePassword",userAuth,userController.loadChangePass)
router.post("/changePassword",userAuth,userController.changePassword)


router.get("/changeEmail",userAuth,userController.loadChangeEmail)
router.post("/changeEmail",userAuth,userController.verifyEmail)
router.post("/verify-email-otp",userAuth,userController.verifyEmailOtp)
router.post('/update-email',userAuth,userController.updateEmail)

router.get('/addAddress',userAuth,userController.loadAddAddress)
router.post('/addAddress',userAuth,userController.addAddress)

 router.get('/editAddress/:id',userAuth,userController.loadEditAddress)
 router.post('/editAddress/:id',userAuth,userController.editAddress)

 router.get('/deleteAddress/:id',userAuth,userController.deleteAddress)



module.exports = router