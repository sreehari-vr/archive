const Razorpay = require("razorpay");
const crypto = require("crypto");
const orderController = require("./orderController");
const HTTP_STATUS_CODES = require("../../utils/httpStatusCodes");

require("dotenv").config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAYID,
  key_secret: process.env.RAZORPAYSECRET,
});

const paymentController = {
  createOrder: async (req, res) => {
    console.log("Order request received:", req.body);
    const options = {
      amount: req.body.amount * 100,
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
      res.status(HTTP_STATUS_CODES.BAD_REQUEST)
      .json({ error: "Failed to create Razorpay order" });
    }
  },

  capturePayment: async (req, res) => {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        selectedAddress,
        couponCode,
        paymentStatus,
      } = req.body;

      if (!razorpay_order_id) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST)
        .json({ success: false, message: "Missing Razorpay order ID" });
      }

      if (paymentStatus === "Failed" || !razorpay_payment_id || !razorpay_signature) {
        console.log("Payment failed, saving failed order.");

        req.body.paymentMethod = "razorpay";
        req.body.selectedAddress = selectedAddress;
        req.body.couponCode = couponCode;
        req.body.paymentFailed = true;

        await orderController.placeOrder(req, res);
        return;
      }

      const body = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAYSECRET)
        .update(body)
        .digest("hex");

      console.log("Razorpay Details:", {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        expectedSignature
      });

      if (expectedSignature === razorpay_signature) {
        console.log("Payment verified successfully");

        req.body.paymentMethod = "razorpay";
        req.body.selectedAddress = selectedAddress;
        req.body.couponCode = couponCode;

        await orderController.placeOrder(req, res);
      } else {
        console.error("Payment verification failed");
        return res
          .status(HTTP_STATUS_CODES.BAD_REQUEST)
          .json({ success: false, message: "Payment verification failed" });
      }
    } catch (error) {
      console.error("Error in paymentCapture:", error);
      res
        .status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR)

        .json({ success: false, message: "Payment processing error" });
    }
  }
};

module.exports = paymentController;