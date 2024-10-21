const express = require("express");
const router = express.Router()
const passport= require("passport")
const userController = require("../controllers/user/userController")
const {adminAuth,userAuth} = require("../middleware/auth")

router.get("/",userAuth,userController.loadHomepage)
router.get("/signup",userController.loadSignup)
router.get("/login",userController.loadLogin)
router.post("/login",userController.login)
router.post("/signup",userController.signup)
router.post("/verify-otp",userController.verifyOtp)
router.post("/resend-otp",userController.resendOtp)
router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}));
router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/signup'}),(req,res)=>{res.redirect('/')})


module.exports = router