const user = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const category = require("../../models/categorySchema");
const Cart = require("../../models/cartSchema");
const Order = require("../../models/orderSchema");
const Wallet = require("../../models/walletSchema");

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
      category: { $in: categories.map((category) => category._id) },
    });
    productData = productData.sort((a, b) => b.createdAt - a.createdAt);
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
    if (!product) {
      res.status(500).send("Product not found");
    }

    const relatedProducts = await Product.find({
      isDeleted: null,
      isActive: true,
      category: product.category,
      _id: { $ne: productId },
    }).limit(4);

    return res.render("productDetail", { product, relatedProducts });
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
    const { email } = req?.session?.userData;
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

    req.session.userOtp = newOtp;
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

const logout = async (req, res) => {
  try {
    req.session.user = null;
    res.redirect("/login");
  } catch (error) {
    console.error("Logout not working:", error);
  }
};

const userProfile = async (req, res) => {
  try {
    return res.render("userProfile");
  } catch (error) {
    console.log("Home page not loading:", error);
    res.status(500).send("Server error");
  }
};

const renderUserProfile = async (req, res) => {
  try {
    const id = req.session.user;
    const data = await user.findById(id);
    const userAddress = await Address.findOne({ userId: id });
    const orders = await Order.find({ userId: id }).populate("items.productId").sort({orderDate:-1});
    const wallet = await Wallet.findOne({ userId: id });

    if (!data) {
      console.log("user does not exist");
      return res.status(404).json({ error: "User not found" });
    }
    const addressCount = userAddress ? userAddress.address.length : 0;
    const maxCount = 3;
    console.log(id);
    return res.render("userProfile", {
      data,
      address: userAddress ? userAddress.address : [],
      addressCount,
      maxCount,
      orders,
      wallet: wallet || { balance: 0, transactionHistory: [] },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const loadChangeEmail = async (req, res) => {
  try {
    return res.render("changeEmail");
  } catch (error) {
    console.log("Home page not loading:", error);
    res.status(500).send("Server error");
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { email } = req.body;

    userExist = await user.findOne({ email, phone: { $ne: null } });
    if (userExist) {
      otp = generateOtp();
      emailSend = await sendVerificationEmail(email, otp);
      if (emailSend) {
        req.session.userOtp = otp;
        req.session.userData = req.body;
        req.session.email = email;
        res.render("changeEmailOtp");
        console.log("Email sent:", email);
        console.log("OTP:", otp);
      } else {
        res.json("email-error");
      }
    } else {
      res.render("changeEmail", {
        message: "User with this email not exist",
      });
    }
  } catch (error) {
    console.log(error);
  }
};

const verifyEmailOtp = async (req, res) => {
  try {
    otpEntered = req.body.otp;
    if (otpEntered === req.session.userOtp) {
      req.session.userData = req.body.userData;
      res.render("newEmail", { userData: req.session.userData });
    } else {
      res.render("changeEmail", { message: "otp not matching" });
    }
  } catch (error) {
    console.log(error);
  }
};

const updateEmail = async (req, res) => {
  try {
    const newEmail = req.body.newEmail;
    const id = req.session.user;

    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "User not logged in" });
    }

    if (!newEmail) {
      return res
        .status(400)
        .json({ success: false, message: "Email cannot be empty" });
    }

    await user.findByIdAndUpdate(id, { email: newEmail });

    return res
      .status(200)
      .json({ success: true, message: "Email updated successfully!" });
  } catch (error) {
    console.error("Error updating email:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "An error occurred while updating the email.",
      });
  }
};

const loadChangePass = async (req, res) => {
  try {
    return res.render("changePassword");
  } catch (error) {
    console.log("page not loading:", error);
    res.status(500).send("Server error");
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.session.user;

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "User not logged in" });
    }

    const User = await user.findById(userId);

    const isMatch = await bcrypt.compare(currentPassword, User.password);
    if (!isMatch) {
      return res
        .status(400)
        .json({ success: false, message: "Current password is incorrect" });
    }

    if (newPassword !== confirmPassword) {
      return res
        .status(400)
        .json({ success: false, message: "New passwords do not match" });
    }

    if (newPassword === currentPassword) {
      return res
        .status(400)
        .json({
          success: false,
          message: "New password must be different from the current password",
        });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    User.password = hashedPassword;
    await User.save();

    return res
      .status(200)
      .json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("Error updating password:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "An error occurred while changing the password",
      });
  }
};

const loadAddAddress = async (req, res) => {
  try {
    return res.render("addAddress");
  } catch (error) {
    console.log("Address page not loading:", error);
    res.status(500).send("Server error");
  }
};

const addAddress = async (req, res) => {
  try {
    const {
      addressType,
      name,
      city,
      landMark,
      state,
      pincode,
      phone,
      altPhone,
    } = req.body;
    const userId = req.session.user;
    const data = await user.findById(userId);
    const userAddress = await Address.findOne({ userId });
    const addressCount = userAddress ? userAddress.address.length : 0;
    const maxCount = 3;
    if (userAddress) {
      const addressCount = userAddress.address.length;

      if (addressCount < maxCount) {
        userAddress.address.push({
          addressType,
          name,
          city,
          landMark,
          state,
          pincode,
          phone,
          altPhone,
        });
        await userAddress.save();
        res.redirect("/userProfile");
      } else {
        res.status(400).send("Maximum of 3 addresses allowed");
      }
    } else {
      const newAddress = new Address({
        userId,
        address: [
          {
            addressType,
            name,
            city,
            landMark,
            state,
            pincode,
            phone,
            altPhone,
          },
        ],
      });
      await newAddress.save();
      res.redirect("/userProfile");
    }
  } catch (error) {
    console.log("Error occured while adding address:", error);
    res.status(500).send("Server error");
  }
};

const loadEditAddress = async (req, res) => {
  const addressId = req.params.id;
  const userId = req.session.user;
  try {
    const userAddress = await Address.findOne({ userId });
    const address = userAddress.address.find(
      (addr) => addr._id.toString() === addressId
    );

    return res.render("editAddress", { address });
  } catch (error) {
    console.log(" page not loading:", error);
    res.status(500).send("Server error");
  }
};

const editAddress = async (req, res) => {
  const addressId = req.params.id;
  const userId = req.session.user;
  const updatedData = {
    addressType: req.body.addressType,
    name: req.body.name,
    city: req.body.city,
    landMark: req.body.landMark,
    state: req.body.state,
    pincode: req.body.pincode,
    phone: req.body.phone,
    altPhone: req.body.altPhone,
  };

  try {
    const userAddress = await Address.findOne({ userId });
    if (!userAddress) {
      return res.status(404).send("User address document not found");
    }

    const addressIndex = userAddress.address.findIndex(
      (addr) => addr._id.toString() === addressId
    );
    if (addressIndex === -1) {
      return res.status(404).send("Address not found");
    }

    userAddress.address[addressIndex] = {
      ...userAddress.address[addressIndex].toObject(),
      ...updatedData,
    };

    await userAddress.save();

    res.redirect("/userProfile");
  } catch (error) {
    console.log("Error updating address:", error);
    res.status(500).send("Server error");
  }
};

const deleteAddress = async (req, res) => {
  const addressId = req.params.id;
  const userId = req.session.user;

  try {
    const userAddress = await Address.findOne({ userId });
    const address = userAddress.address.find(
      (addr) => addr._id.toString() === addressId
    );
    await Address.updateOne(
      { userId },
      { $pull: { address: { _id: addressId } } }
    );
    res.redirect("/userProfile");
  } catch (error) {
    console.log("Error deleting address:", error);
    res.status(500).send("Server error");
  }
};

const loadCheckout = async (req, res) => {
  const id = req.session.user;
  const { subtotal, discount, grandTotal, quantities, couponCode } = req.body;

  try {
    const cart = await Cart.findOne({ userId: id }).populate("items.productId");
    const data = await user.findById(id);
    const userAddress = await Address.findOne({ userId: id });
    const wallet = await Wallet.findOne({ userId: id });
    const addressCount = userAddress ? userAddress.address.length : 0;
    const maxCount = 3;
    const orderId = req.query.orderId || ''; 

    const subTotalToAdd = parseFloat(subtotal);
    const grandTotalToAdd = parseFloat(grandTotal);
    const discountToAdd = parseFloat(discount);

    cart.subTotal = subTotalToAdd;
    cart.grandTotal = grandTotalToAdd;

    const updatedQuantities = JSON.parse(quantities);

    for (const item of updatedQuantities) {
      const cartItem = cart.items.find(
        (cartItem) => cartItem.productId._id.toString() === item.productId
      );
      if (cartItem) {
        cartItem.quantity = item.quantity;
      }
    }
    cart.discount = discountToAdd;

    await cart.save();

    console.log("Updated Cart:", cart);

    res.render("checkOut", {
      data,
      address: userAddress ? userAddress.address : [],
      maxCount,
      addressCount,
      cart,
      couponCode,
      orderId,
      walletBalance: wallet ? wallet.balance : 0
    });
  } catch (error) {
    console.error("Error in loadCheckout:", error);
    res.status(500).send("An error occurred while loading the checkout page.");
  }
};

const loadShop = async (req, res) => {
  try {
    const { sort, filter } = req.query;
    const categories = await category.find({ isActive: true });

    let filterCategory = filter || "all";

    let productData = await Product.find({
      isActive: true,
      deletedAt: null,
      category: { $in: categories.map((category) => category._id) },
    });

    if (filterCategory !== "all" && filterCategory !== "available") {
      productData = productData.filter(
        (product) => product.category.toString() === filterCategory
      );
    }

    if (filterCategory === "available") {
      productData = productData.filter((product) => product.quantity > 0);
    }

    switch (sort) {
      case "price-asc":
        productData = productData.sort((a, b) => a.salePrice - b.salePrice);
        break;
      case "price-desc":
        productData = productData.sort((a, b) => b.salePrice - a.salePrice);
        break;
      case "new":
        productData = productData.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case "name-asc":
        productData.sort((a, b) => a.productName.localeCompare(b.productName));
        break;
      case "name-desc":
        productData.sort((a, b) => b.productName.localeCompare(a.productName));
        break;
      default:
        productData = productData.sort((a, b) => b.createdAt - a.createdAt);
        break;
    }

    res.render("shop", {
      product: productData,
      sort,
      categories,
      filterCategory,
    });
  } catch (error) {
    console.error(error);
  }
};


const loadForgotPassword = async (req, res) => {
  try {
    return res.render("forgotPass");
  } catch (error) {
    console.log("page not loading:", error);
    res.status(500).send("Server error");
  }
};

const verifyForgotPass = async (req, res) => {
  try {
    const { email } = req.body;
    userExist = await user.findOne({ email });
    if (userExist) {
      otp = generateOtp();
      emailSend = await sendVerificationEmail(email, otp);
      if (emailSend) {
        req.session.userOtp = otp;
        req.session.userData = req.body;
        req.session.email = email;
        res.render("verifyForgotOtp");
        console.log("Email sent:", email);
        console.log("OTP:", otp);
      } else {
        res.json("email-error");
      }
    } else {
      res.render("forgotPass", {
        message: "User with this email not exist",
      });
    }
  } catch (error) {
    console.log(error);
  }
};

const verifyForgotPassOtp = async (req, res) => {
  try {
    otpEntered = req.body.otp;
    if (otpEntered === req.session.userOtp) {
      req.session.userData = req.body.userData;
      res.render("newPassword", { userData: req.session.userData });
    } else {
      res.render("forgotPass", { message: "otp not matching" });
    }
  } catch (error) {
    console.log(error);
  }
};

const newPassword = async (req, res) => {
  try {
    const { newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "New passwords do not match" });
    }

    const User = await user.findOne({ email: req.session.email });
    if (!User) {
      return res.status(404).json({ message: "User not found" });
    }

    User.password = await bcrypt.hash(newPassword, 10);
    await User.save();

    req.session.userOtp = null;
    req.session.userData = null;
    req.session.email = null;

    res.redirect("/login");
  } catch (error) {
    console.error("Error updating password:", error);
    res
      .status(500)
      .json({ message: "An error occurred while changing the password" });
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
  logout,
  loadDetailPage,
  userProfile,
  renderUserProfile,
  loadChangeEmail,
  loadChangePass,
  verifyEmail,
  verifyEmailOtp,
  updateEmail,
  changePassword,
  loadAddAddress,
  addAddress,
  loadEditAddress,
  editAddress,
  deleteAddress,
  loadCheckout,
  loadShop,
  verifyForgotPass,
  loadForgotPassword,
  verifyForgotPassOtp,
  newPassword,
};
