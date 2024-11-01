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



module.exports = router