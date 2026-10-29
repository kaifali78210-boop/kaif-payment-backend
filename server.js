
const express = require("express");
const cors = require("cors");
const Razorpay = require("razorpay");
const crypto = require("crypto");

const app = express();

app.use(cors({
  origin: "https://kaifali78210-boop.github.io"
}));

app.use(express.json({ limit: "20kb" }));

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (!keyId || !keySecret) {
  throw new Error("Razorpay environment variables are missing");
}

const razorpay = new Razorpay({
  key_id: keyId,
  key_secret: keySecret
});

app.get("/", (req, res) => {
  res.send("Kaif Payment Backend Running!");
});

// Create an order. Amount is in paise.
// This endpoint creates a payment order only; it does not credit a wallet.
app.post("/create-order", async (req, res) => {
  try {
    const amount = Number(req.body?.amount);

    if (
      !Number.isSafeInteger(amount) ||
      amount < 100 ||
      amount > 10000000
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid amount"
      });
    }

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: "rcpt_" + crypto.randomUUID()
    });

    return res.json({
      success: true,
      id: order.id,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId
    });
  } catch (error) {
    console.error("Order error:", error.message);
    return res.status(500).json({
      success: false,
      error: "Order creation failed"
    });
  }
});

// Verify signature and check payment status/amount with Razorpay.
// This endpoint does not credit a wallet.
app.post("/verify-payment", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body || {};

    if (
      typeof razorpay_order_id !== "string" ||
      typeof razorpay_payment_id !== "string" ||
      typeof razorpay_signature !== "string"
    ) {
      return res.status(400).json({
        success: false,
        error: "Payment details missing"
      });
    }

    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest();

    let receivedSignature;

    try {
      receivedSignature = Buffer.from(razorpay_signature, "hex");
    } catch {
      return res.status(400).json({
        success: false,
        error: "Invalid signature"
      });
    }

    if (
      receivedSignature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(receivedSignature, expectedSignature)
    ) {
      return res.status(400).json({
        success: false,
        error: "Payment signature verification failed"
      });
    }

    const [order, payment] = await Promise.all([
      razorpay.orders.fetch(razorpay_order_id),
      razorpay.payments.fetch(razorpay_payment_id)
    ]);

    if (
      payment.order_id !== order.id ||
      payment.amount !== order.amount ||
      payment.currency !== order.currency ||
      payment.status !== "captured"
    ) {
      return res.status(400).json({
        success: false,
        error: "Payment is not captured or order details mismatch"
      });
    }

    return res.json({
      success: true,
      message: "Payment verified and captured",
      paymentId: payment.id,
      orderId: order.id,
      amount: payment.amount,
      currency: payment.currency
    });
  } catch (error) {
    console.error("Verification error:", error.message);
    return res.status(500).json({
      success: false,
      error: "Payment verification failed"
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Kaif Payment Backend running on port " + PORT);
});
