const user = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const category = require("../../models/categorySchema");
const env = require("dotenv").config();
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");

const loadHomepage = async (req, res) => {
  try {
    const User = req.session.user;
    const categories = await category.find({ isActive: true });
    let productData = await Product.find({
      isActive: true,
      deletedAt: null,
      category: { $in: categories.map((category) => category._id) }
    });
    productData = productData.sort((a, b) => b.createdAt - a.createdAt);

    // console.log("Fetched Products:", productData); // Log product data
    // console.log("categories:", categories);
    if (User) {
      const userData = await user.findOne({ _id: User._id });
      return res.render("home", { product: productData, userData });
    } else {
      return res.render("home", { product: productData });
    }
  } catch (error) {
    console.log("Home page not found", error);
    res.status(500).send("Server error");
  }
};

const loadDetailPage = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId);
    if(!product){
      res.status(500).send('Product not found');
    }
    return res.render("productDetail",{product});
  } catch (error) {
    console.log(error);
  }
};

const loadSignup = async (req, res) => {
  try {
    return res.render("signup");
  } catch (error) {
    console.log("Home page not loading:", error);
    res.status(500).send("Server error");
  }
};

const loadLogin = async (req, res) => {
  try {
    // return res.render("login");
    if (!req.session.user) {
      return res.render("login");
    } else {
      res.redirect("/");
    }
  } catch (error) {
    console.log("Home page not loading:", error);
    res.status(500).send("Server error");
  }
};

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(email, otp) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Verify your account",
      text: `Your OTP is ${otp}`,
      html: `<b>Your OTP: ${otp}</b>`,
    });

    return info.accepted.length > 0;
  } catch (error) {
    console.error("Error sending email", error);
    return false;
  }
}

const signup = async (req, res) => {
  try {
    const { name, email, phone, password, cPassword } = req.body;
    if (password !== cPassword) {
      return res.render("signup", { message: "Passwords do not match" });
    }
    const findUser = await user.findOne({ email });
    if (findUser) {
      return res.render("signup", { message: "Email already exists" });
    }

    const otp = generateOtp();
    const emailSend = await sendVerificationEmail(email, otp);

    if (!emailSend) {
      return res.json("email-error");
    }

    req.session.userOtp = otp;
    req.session.userData = { name, email, phone, password };

    res.render("verify-otp");
    console.log("OTP Send", otp);
  } catch (error) {
    console.error("signup error", error);
  }
};

const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
  } catch (error) {
    console.error("Error hashing password:", error);
    throw error;
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { otpInput } = req.body;
    console.log(otpInput);
    console.log(req.session.userOtp);

    if (otpInput === req.session.userOtp) {
      const userData = req.session.userData;
      const passwordHash = await securePassword(userData.password);

      const newUser = new user({
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        password: passwordHash,
      });
      await newUser.save();
      req.session.userId = newUser._id;
      res.json({ success: true, redirectUrl: "/login" });
    } else {
      res
        .status(400)
        .json({ success: false, message: "Invalid OTP, Please try again" });
    }
  } catch (error) {
    console.error("Error Verifying OTP", error);
    res.status(500).json({ success: false, message: "An error occured" });
  }
};

const resendOtp = async (req, res) => {
  try {
    const { email } = req?.session?.userData; // Retrieve email from session
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Session expired. Please sign up again.",
      });
    }

    const newOtp = generateOtp();
    const emailSent = await sendVerificationEmail(email, newOtp);

    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to resend OTP. Try again later.",
      });
    }

    req.session.userOtp = newOtp; // Update session with the new OTP
    res.json({ success: true, message: "OTP resent successfully" });
    console.log("OTP Resent", newOtp);
  } catch (error) {
    console.error("Error resending OTP", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while resending OTP",
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const findUser = await user.findOne({ isAdmin: 0, email: email });

    if (!findUser) {
      return res.render("login", { message: "User not found" });
    }
    if (findUser.isBlocked) {
      return res.render("login", { message: "User is blocked by admin" });
    }

    const passwordMatch = await bcrypt.compare(password, findUser.password);

    if (!passwordMatch) {
      return res.render("login", { message: "Incorrect Password" });
    }

    req.session.user = findUser._id;
    res.redirect("/");
  } catch (error) {
    console.error("login error", error);
    res.render("login", { message: "login failed.please try again" });
  }
};

module.exports = {
  loadHomepage,
  loadSignup,
  loadLogin,
  signup,
  verifyOtp,
  resendOtp,
  login,
  loadDetailPage,
};
