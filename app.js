const express = require("express");
const app = express();
const session = require('express-session');
const passport = require('./config/passport');
const path = require("path")
const Razorpay = require('razorpay')
const crypto = require('crypto')
const bodyParser = require('body-parser');
const env = require("dotenv").config();
const db = require("./config/db");
const userRouter = require("./routes/userRouter.js");
const adminRouter = require("./routes/adminRouter.js")
const orderController = require("./controllers/user/orderController.js")
db();


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24
    }

}))

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
    res.set('cache-control', 'no-store')
    next();
})

app.set("view engine", "ejs")
app.set("views", [path.join(__dirname, 'views/user'),
path.join(__dirname, 'views/admin')])
app.use(express.static(path.join(__dirname, "public")))

app.use("/", userRouter);
app.use("/admin", adminRouter);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/css', express.static(path.join(__dirname, 'css')));









const razorpay = new Razorpay({
    key_id: process.env.RAZORPAYID,
    key_secret: process.env.RAZORPAYSECRET,
});

// Razorpay Order Creation
app.post("/order", async (req, res) => {
    console.log("Order request received:", req.body);
    const options = {
        amount: req.body.amount * 100, // Amount in paise
        currency: req.body.currency || "INR",
        receipt: `order_rcptid_${Date.now()}`,
    };

    try {
        const response = await razorpay.orders.create(options);
        console.log("Razorpay Order Created:", response);
        res.json({
            order_id: response.id,
            currency: response.currency,
            amount: response.amount,
        });
    } catch (error) {
        console.error("Error creating Razorpay order:", error);
        res.status(400).json({ error: "Failed to create Razorpay order" });
    }
});

// Razorpay Payment Verification
// Razorpay Payment Verification
app.post("/paymentCapture", async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            selectedAddress,
            couponCode,
        } = req.body;

        // Validate required fields
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            console.error("Missing payment details");
            return res.status(400).json({ success: false, message: "Missing payment details" });
        }

        // Generate the expected signature
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAYSECRET)
            .update(body)
            .digest("hex");

        console.log("Razorpay Details:");
        console.log("razorpay_order_id:", razorpay_order_id);
        console.log("razorpay_payment_id:", razorpay_payment_id);
        console.log("razorpay_signature:", razorpay_signature);
        console.log("Expected Signature:", expectedSignature);

        if (expectedSignature === razorpay_signature) {
            console.log("Payment verified successfully");

            // Call placeOrder with necessary fields
            req.body.paymentMethod = "razorpay"; // Ensure the payment method is passed
            req.body.selectedAddress = selectedAddress; // Ensure address is passed
            req.body.couponCode = couponCode; // Include coupon if provided

            // Call placeOrder controller
            await orderController.placeOrder(req, res);
        } else {
            console.error("Payment verification failed");
            return res.status(400).json({ success: false, message: "Payment verification failed" });
        }
    } catch (error) {
        console.error("Error in paymentCapture:", error);
        res.status(500).json({ success: false, message: "Payment processing error" });
    }
});





app.listen(process.env.PORT, () => {
    console.log(`Server running on http://localhost:${process.env.PORT}`);
})


module.exports = app;