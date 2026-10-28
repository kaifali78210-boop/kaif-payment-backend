const express = require("express");
const cors = require("cors");
const Razorpay = require("razorpay");
const crypto = require("crypto");

const app = express();

app.use(cors({
  origin: [
    "https://kaifali78210-boop.github.io"
  ]
}));

app.use(express.json());

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Apne products aur unki prices yahan set karo
const PRODUCTS = {
  "product1": {
    name: "Product 1",
    price: 49900
  },
  "product2": {
    name: "Product 2",
    price: 99900
  }
};

// Backend check
app.get("/", (req, res) => {
  res.send("Kaif Payment Backend Running!");
});

// Buy Now: Payment order create karo
app.post("/create-order", async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;

    const product = PRODUCTS[productId];

    if (!product) {
      return res.status(400).json({
        success: false,
        message: "Invalid product"
      });
    }

    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 10
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid quantity"
      });
    }

    const order = await razorpay.orders.create({
      amount: product.price * quantity,
      currency: "INR",
      receipt: "order_" + Date.now()
    });

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      productName: product.name,
      keyId: process.env.RAZORPAY_KEY_ID
    });

  } catch (error) {
    console.error("Order error:", error.message);

    res.status(500).json({
      success: false,
      message: "Payment order create nahi hua"
    });
  }
});

// Payment signature verify karo
app.post("/verify-payment", (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment details missing"
      });
    }

    const expectedSignature = crypto
      .createHmac(
        "sha256",
        process.env.RAZORPAY_KEY_SECRET
      )
      .update(
        razorpay_order_id + "|" + razorpay_payment_id
      )
      .digest("hex");

    const received = Buffer.from(razorpay_signature);
    const expected = Buffer.from(expectedSignature);

    if (
      received.length !== expected.length ||
      !crypto.timingSafeEqual(received, expected)
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed"
      });
    }

    res.json({
      success: true,
      message: "Payment signature verified",
      payment
