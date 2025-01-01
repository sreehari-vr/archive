const user = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const category = require("../../models/categorySchema");
const Cart = require("../../models/cartSchema");
const Order = require("../../models/orderSchema");
const Wallet = require("../../models/walletSchema");
const HTTP_STATUS_CODES = require("../../utils/httpStatusCodes");

const env = require("dotenv").config();
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");

const loadLanding = async (req, res) => {
  try {
    const categories = await category.find({ isActive: true });
    let productData = await Product.find({
      isActive: true,
      deletedAt: null,
      category: { $in: categories.map((category) => category._id) },
    });
    productData = productData.sort((a, b) => b.createdAt - a.createdAt);
    return res.render("landing", { product: productData });
  } catch (error) {
    console.log("Home page not found", error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR)
    .send("Server error");
  }
};

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
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR)
    .send("Server error");
  }
};

const loadDetailPage = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId).populate("category");
    if (!product) {
      res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR)
      .send("Product not found");
    }
    const categoryOffer = product.category?.offer || 0; 
    const productOffer = product.productOffer || 0;
    const bestOffer = Math.max(categoryOffer, productOffer);

    const relatedProducts = await Product.find({
      isDeleted: null,
      isActive: true,
      category: product.category,
      _id: { $ne: productId },
    }).limit(4);

    return res.render("productDetail", { product, relatedProducts, bestOffer });
  } catch (error) {
    console.log(error);
  }
};

const loadSignup = async (req, res) => {
  try {
    return res.render("signup");
  } catch (error) {
    console.log("Home page not loading:", error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR)
    .send("Server error");
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
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR)
    .send("Server error");
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
    const { name, email, phone, password, cPassword, referral } = req.body;

    const namePattern = /^[A-Za-z\s'-]+$/;
    const emailPattern =
          /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const phonePattern = /^[0-9]{10}$/;
    const alpha = /[a-zA-Z]/.test(password);
        const num = /\d/.test(password);

    if (!name || name.trim() === "") {
      return res.render("signup", { message: "Please enter your name" });
    } else if (!namePattern.test(name)) {
      return res.render("signup", { message: "Please enter a valid name" });
    }

    if (!emailPattern.test(email)) {
      return res.render("signup", { message: "Please enter a valid email" });
    }

    if (!phonePattern.test(phone)) {
      return res.render("signup", { message: "Please enter a valid phone number" });
    }

    if(password.length<8){
      return res.render("signup", { message: "Password is too short" });
    }else if(!alpha || !num){
      return res.render("signup", { message: "Password should contain numbers and alphabets" });
    }else if (password !== cPassword) {
      return res.render("signup", { message: "Passwords do not match" });
    }
    const findUser = await user.findOne({ email });
    if (findUser) {
      return res.render("signup", { message: "Email already exists" });
    }

    let referrer = null;
    if (referral) {
      referrer = await user.findOne({ referralCode: referral });
      if (!referrer) {
        return res.render("signup", { message: "Invalid referral code" });
      }
    }

    const otp = generateOtp();
    const emailSend = await sendVerificationEmail(email, otp);

    if (!emailSend) {
      return res.json("email-error");
    }

    const referralCode = `${name.slice(0, 3).toUpperCase()}-${Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()}`;

    req.session.userOtp = otp;
    req.session.userData = {
      name,
      email,
      phone,
      password,
      referralCode,
      referrerId: referrer ? referrer._id : null,
    };
    console.log(req.session.userData);
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
        referralCode: userData.referralCode,
      });
      await newUser.save();

      await Wallet.create({
        userId: newUser._id,
        balance: 0,
        transactionHistory: [],
      });

      if (userData.referrerId) {
        await addMoneyToWallet(newUser._id, 21, "Credit", "Referral bonus");

        await addMoneyToWallet(
          userData.referrerId,
          101,
          "Credit",
          "Referred a new user"
        );
      }

      req.session.userId = newUser._id;
      res.json({ success: true, redirectUrl: "/login" });
    } else {
      res
        .status(HTTP_STATUS_CODES.BAD_REQUEST)
        .json({ success: false, message: "Invalid OTP, Please try again" });
    }
  } catch (error) {
    console.error("Error Verifying OTP", error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR)
    .json({ success: false, message: "An error occured" });
  }
};

const addMoneyToWallet = async (userId, amount, type, description) => {
  const wallet = await Wallet.findOne({ userId });
  if (!wallet) throw new Error("Wallet not found");

  wallet.balance += amount;
  wallet.transactionHistory.push({
    type,
    amount,
    description,
    date: new Date(),
  });

  await wallet.save();
};

const resendOtp = async (req, res) => {
  try {
    const { email } = req?.session?.userData;
    if (!email) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST)
      .json({
        success: false,
        message: "Session expired. Please sign up again.",
      });
    }

    const newOtp = generateOtp();
    const emailSent = await sendVerificationEmail(email, newOtp);

    if (!emailSent) {
      return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({
        success: false,
        message: "Failed to resend OTP. Try again later.",
      });
    }

    req.session.userOtp = newOtp;
    res.json({ success: true, message: "OTP resent successfully" });
    console.log("OTP Resent", newOtp);
  } catch (error) {
    console.error("Error resending OTP", error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR)    .json({
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
    res.redirect("/home");
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
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).send("Server error");
  }
};

const renderUserProfile = async (req, res) => {
  try {
    const id = req.session.user;
    const data = await user.findById(id);
    const userAddress = await Address.findOne({ userId: id });
    const wallet = await Wallet.findOne({ userId: id });

    if (!data) {
      console.log("User does not exist");
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({ error: "User not found" });
    }

    const { page = 1, limit = 5 } = req.query;
    const skip = (page - 1) * limit;

    const totalOrders = await Order.countDocuments({ userId: id });
    const orders = await Order.find({ userId: id })
      .populate("items.productId")
      .sort({ orderDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const addressCount = userAddress ? userAddress.address.length : 0;
    const maxCount = 3;

    const sortedWallet = wallet ? {
      ...wallet.toObject(),
      transactionHistory: wallet.transactionHistory.sort((a, b) => b.date - a.date)
    } : { balance: 0, transactionHistory: [] };

    return res.render("userProfile", {
      data,
      address: userAddress ? userAddress.address : [],
      addressCount,
      maxCount,
      orders,
      wallet: sortedWallet,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalOrders / limit),
    });
  } catch (error) {
    console.error(error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({ error: "Internal server error" });
  }
};

const loadChangeEmail = async (req, res) => {
  try {
    return res.render("changeEmail",{message: null});
  } catch (error) {
    console.log("Home page not loading:", error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).send("Server error");
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { email } = req.body;

    // Check if the user exists in the database
    const userExist = await user.findOne({ email, phone: { $ne: null } });

    if (userExist) {
      // Generate and send OTP
      const otp = generateOtp();
      const emailSend = await sendVerificationEmail(email, otp);

      if (emailSend) {
        // Store OTP and user data in the session
        req.session.userOtp = otp;
        req.session.userData = req.body;
        req.session.email = email;
        console.log(otp)
        return res.render("changeEmailOtp", { message: null }); // Render the OTP page
      } else {
        return res.render("changeEmail", {
          message: "Failed to send email. Please try again later.",
        });
      }
    } else {
      // Email does not exist in the database
      return res.render("changeEmail", {
        message: "User with this email does not exist. Please try again.",
      });
    }
  } catch (error) {
    console.error("Error during email verification:", error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR)
    .render("changeEmail", {
      message: "An error occurred. Please try again later.",
    });
  }
};


const verifyEmailOtp = async (req, res) => {
  try {
    otpEntered = req.body.otp;
    if (otpEntered === req.session.userOtp) {
      req.session.userData = req.body.userData;
      res.render("newEmail", { userData: req.session.userData , message: null});
    } else {
      res.render("changeEmailOtp", { message: "otp not matching" });
    }
  } catch (error) {
    console.log(error);
  }
};

const updateEmail = async (req, res) => {
  try {
    const newEmail = req.body.newEmail;
    const id = req.session.user;

    if (!id || !newEmail) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST)
      .json({ success: false, message: "Invalid request" });
    }

    // Check if email exists
    const emailExists = await user.findOne({ email: newEmail });
    if (emailExists) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST)
      .json({ success: false, message: "Email already in use" });
    }

    // Update email and session
    await user.findByIdAndUpdate(id, { email: newEmail });
    req.session.email = newEmail;
    
    // Wait for session to save
    await new Promise(resolve => req.session.save(resolve));

    return res.status(HTTP_STATUS_CODES.OK)
    .json({ success: true, message: "Email updated successfully!" });

  } catch (error) {
    console.error("Error updating email:", error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR)
    .json({ success: false, message: "Server error" });
  }
};

const loadChangePass = async (req, res) => {
  try {
    return res.render("changePassword");
  } catch (error) {
    console.log("page not loading:", error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR)
    .send("Server error");
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.session.user;

    if (!userId) {
      return res
        .status(HTTP_STATUS_CODES.UNAUTHORIZED)
        .json({ success: false, message: "User not logged in" });
    }

    const User = await user.findById(userId);

    // Verify the current password
    const isMatch = await bcrypt.compare(currentPassword, User.password);
    if (!isMatch) {
      return res
        .status(HTTP_STATUS_CODES.BAD_REQUEST)
        .json({ success: false, message: "Current password is incorrect" });
    }

    // Check if the new password matches the confirm password
    if (newPassword !== confirmPassword) {
      return res
        .status(HTTP_STATUS_CODES.BAD_REQUEST)
        .json({ success: false, message: "New passwords do not match" });
    }

    // Validate the new password
    const passwordValidation = {
      length: newPassword.length >= 8,
      containsLetter: /[a-zA-Z]/.test(newPassword),
      containsNumber: /\d/.test(newPassword),
    };

    if (!passwordValidation.length) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "New password must be at least 8 characters long.",
      });
    }
    if (!passwordValidation.containsLetter || !passwordValidation.containsNumber) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "New password must contain both letters and numbers.",
      });
    }

    // Ensure the new password is not the same as the current password
    if (newPassword === currentPassword) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "New password must be different from the current password.",
      });
    }

    // Hash the new password and save it
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    User.password = hashedPassword;
    await User.save();

    return res
      .status(HTTP_STATUS_CODES.OK)
      .json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("Error updating password:", error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "An error occurred while changing the password.",
    });
  }
};


const loadAddAddress = async (req, res) => {
  try {
    return res.render("addAddress");
  } catch (error) {
    console.log("Address page not loading:", error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).send("Server error");
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

    const errors = {};

    // Validation for input fields
    const namePattern = /^(?!\s*$)[A-Za-z\s]+$/;
    const pincodePattern = /^\d{6}$/;
    const phonePattern = /^\d{10}$/;

    if (!name || !namePattern.test(name)) errors.name = "Name should contain alphabets only.";
    if (!city || !namePattern.test(city)) errors.city = "City should contain alphabets only.";
    if (!landMark || !namePattern.test(landMark)) errors.landMark = "Landmark should contain alphabets only.";
    if (!state || !namePattern.test(state)) errors.state = "State should contain alphabets only.";
    if (!pincode || !pincodePattern.test(pincode)) errors.pincode = "Pincode should be a 6-digit number.";
    if (!phone || !phonePattern.test(phone)) errors.phone = "Phone number should be a 10-digit number.";
    if (!altPhone || !phonePattern.test(altPhone)) errors.altPhone = "Alternate phone number should be a 10-digit number.";
    if (phone === altPhone) errors.altPhone = "Phone and alternate phone number should be different.";

    if (Object.keys(errors).length > 0) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ errors });
    }

    const userAddress = await Address.findOne({ userId });
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
        return res.status(HTTP_STATUS_CODES.OK).json({ success: "Address added successfully!" });
      } else {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ errors: { addressType: "Maximum of 3 addresses allowed." } });
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
      return res.status(HTTP_STATUS_CODES.OK).json({ success: "Address added successfully!" });
    }
  } catch (error) {
    console.error("Error occurred while adding address:", error);
    return res.status(500).json({ errors: { server: "Server error occurred. Please try again." } });
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
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).send("Server error");
  }
};

const editAddress = async (req, res) => {
  try {
    const addressId = req.params.id;
    const userId = req.session.user;
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

    const errors = {};

    // Validation for input fields using the same patterns as addAddress
    const namePattern = /^(?!\s*$)[A-Za-z\s]+$/;
    const pincodePattern = /^\d{6}$/;
    const phonePattern = /^\d{10}$/;

    // Perform all validations
    if (!name || !namePattern.test(name)) errors.name = "Name should contain alphabets only.";
    if (!city || !namePattern.test(city)) errors.city = "City should contain alphabets only.";
    if (!landMark || !namePattern.test(landMark)) errors.landMark = "Landmark should contain alphabets only.";
    if (!state || !namePattern.test(state)) errors.state = "State should contain alphabets only.";
    if (!pincode || !pincodePattern.test(pincode)) errors.pincode = "Pincode should be a 6-digit number.";
    if (!phone || !phonePattern.test(phone)) errors.phone = "Phone number should be a 10-digit number.";
    if (!altPhone || !phonePattern.test(altPhone)) errors.altPhone = "Alternate phone number should be a 10-digit number.";
    if (phone === altPhone) errors.altPhone = "Phone and alternate phone number should be different.";

    // If there are validation errors, return them
    if (Object.keys(errors).length > 0) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ errors });
    }

    // Find the user's address document
    const userAddress = await Address.findOne({ userId });
    if (!userAddress) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({ 
        errors: { server: "User address document not found" }
      });
    }

    // Find the specific address to update
    const addressIndex = userAddress.address.findIndex(
      (addr) => addr._id.toString() === addressId
    );
    if (addressIndex === -1) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({ 
        errors: { server: "Address not found" }
      });
    }

    // Update the address with validated data
    userAddress.address[addressIndex] = {
      ...userAddress.address[addressIndex].toObject(),
      addressType,
      name,
      city,
      landMark,
      state,
      pincode,
      phone,
      altPhone,
    };

    await userAddress.save();
    return res.status(HTTP_STATUS_CODES.OK).json({ success: "Address updated successfully!" });

  } catch (error) {
    console.error("Error updating address:", error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({ 
      errors: { server: "Server error occurred. Please try again." }
    });
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
    res.redirect("/userProfile?deleteSuccess=true");
  } catch (error) {
    console.log("Error deleting address:", error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).send("Server error");
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
    const orderId = req.query.orderId || "";

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
      walletBalance: wallet ? wallet.balance : 0,
    });
  } catch (error) {
    console.error("Error in loadCheckout:", error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).send("An error occurred while loading the checkout page.");
  }
};

const loadShop = async (req, res) => {
  try {
    const { sort, filter, page = 1 } = req.query;
    const categories = await category.find({ isActive: true });

    let filterCategory = filter || "all";
    const limit = 12;
    const skip = (page - 1) * limit;

    let productQuery = {
      isActive: true,
      deletedAt: null,
      category: { $in: categories.map((category) => category._id) },
    };

    if (filterCategory !== "all" && filterCategory !== "available") {
      productQuery.category = filterCategory;
    }

    if (filterCategory === "available") {
      productQuery.quantity = { $gt: 0 };
    }

    let sortOrder = { createdAt: -1 };
    switch (sort) {
      case "price-asc":
        sortOrder = { salePrice: 1 };
        break;
      case "price-desc":
        sortOrder = { salePrice: -1 };
        break;
      case "name-asc":
        sortOrder = { productName: 1 };
        break;
      case "name-desc":
        sortOrder = { productName: -1 };
        break;
      default:
        break;
    }

    const productData = await Product.find(productQuery)
      .sort(sortOrder)
      .skip(skip)
      .limit(limit)
      .exec();

    const totalProducts = await Product.countDocuments(productQuery);
    const totalPages = Math.ceil(totalProducts / limit);

    res.render("shop", {
      product: productData,
      sort,
      categories,
      filterCategory,
      currentPage: parseInt(page),
      totalPages,
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
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).send("Server error");
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
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ message: "New passwords do not match" });
    }

    const User = await user.findOne({ email: req.session.email });
    if (!User) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({ message: "User not found" });
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
      .status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ message: "An error occurred while changing the password" });
  }
};

const searchProducts = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.redirect("/shop");
    }

    const regex = new RegExp(query, "i");
    const products = await Product.find({
      $or: [{ productName: regex }, { description: regex }],
      isActive: true,
      deletedAt: null,
    }).limit(20);

    res.render("shop", {
      product: products,
      sort: null,
      categories: [],
      filterCategory: "all",
      currentPage: 1,
      totalPages: 1,
    });
  } catch (error) {
    console.error("Error fetching search results:", error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).send("Internal Server Error");
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
  loadLanding,
  searchProducts,
};
