const path = require("path");
const fs = require("fs");
const PDFDocument = require("pdfkit");
const Order = require("../../models/orderSchema"); 

const getInvoice = async (req, res) => {
  try {
    const { orderId } = req.query;
    console.log(req.query)
    const order = await Order.findOne({ _id:orderId }).populate("items.productId");
    if (!order) {
      return res.status(400).json({ success: false, error: "Order not found" });
    }

    const invoiceDir = path.join(__dirname, "../../invoices");
    if (!fs.existsSync(invoiceDir)) {
      fs.mkdirSync(invoiceDir);
    }

    const invoicePath = path.join(invoiceDir, `${orderId}_${Date.now()}.pdf`);

    await generateInvoice(order, invoicePath);

    res.download(invoicePath, `Invoice_${orderId}.pdf`, (err) => {
      if (err) {
        console.error("Error sending the file:", err);
        res.status(500).send("Could not download the file");
      }
    });
  } catch (error) {
    console.error("Error generating invoice:", error);
    res.status(500).send("Internal server error");
  }
};

function generateInvoice(order, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const writeStream = fs.createWriteStream(outputPath);

      doc.pipe(writeStream);

      doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).stroke();
      doc
        .fontSize(20)
        .fillColor("#0073e6")
        .text("ARCHIVE", { align: "center" })
        .moveDown(0.5);
      doc
        .fontSize(12)
        .fillColor("black")
        .text("Address: Archive, Kochi, Pin: 686457", { align: "center" });
      doc.text("Phone: +91-9081969790 | Email: archive@gmail.com", {
        align: "center",
      });

      doc
        .moveDown(1)
        .fontSize(18)
        .fillColor("#333333")
        .text("Invoice", { align: "center", underline: true })
        .moveDown(1);

      doc.fontSize(12).fillColor("black").text("Order Details:").moveDown(0.5);
      doc.text(`Order ID: ${order._id}`, { indent: 20 });
      doc.text(
        `Order Date: ${new Date(order.orderDate).toLocaleDateString()}`,
        { indent: 20 }
      );
      doc.text(`Payment Method: ${order.paymentMethod}`, { indent: 20 });
      doc.text(`Order Status: ${order.orderStatus}`, { indent: 20 }).moveDown(1);
      doc.text(`Shipping Address: ${order.address.addressType}`, { indent: 20 });
      doc.text(`                  ${order.address.name}`, { indent: 20 });
      doc.text(`                  ${order.address.city}`, { indent: 20 });
      doc.text(`                  ${order.address.landMark}`, { indent: 20 });
      doc.text(`                  ${order.address.state}`, { indent: 20 });
      doc.text(`                  ${order.address.pincode}`, { indent: 20 });
      doc.text(`                  ${order.address.phone}`, { indent: 20 });
      doc.text(`                  ${order.address.altPhone}`, { indent: 20 });

      doc.text("Order Items:", { underline: true }).moveDown(0.5);
      let totalAmount = 0;

      order.items.forEach((item, index) => {
        const subtotal = item.quantity * item.price;
        totalAmount = order.totalAmount;
        doc.text(
          `${index + 1}. ${item.productId.productName} - ${item.quantity} x ${
            item.price
          } = ${subtotal.toFixed(2)}`
        );
      });


      doc.moveDown(1);
      doc
        .fontSize(12)
        .text(`Discount: ${order.discount.toFixed(2)}`, { align: "right" });
      doc
        .fontSize(14)
        .fillColor("#0073e6")
        .text(`Total: ${totalAmount.toFixed(2)}`, { align: "right" });
      doc
        .fontSize(8)
        .text("All values are in INR", { align: "right" });

      doc.end();
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { getInvoice };
