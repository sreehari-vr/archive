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
      // Initialize PDF document with better margins
      const doc = new PDFDocument({ 
        margin: 50,
        size: 'A4'
      });
      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      // Page border with rounded corners
      doc.roundedRect(20, 20, doc.page.width - 40, doc.page.height - 40, 10).stroke();

      // Constants for layout
      const pageWidth = doc.page.width - 100; // Accounting for margins
      const leftMargin = 50;
      const rightMargin = doc.page.width - 50;

      // Header Section
      doc.fontSize(24)
         .font('Helvetica-Bold')
         .fillColor("#88c8bc")
         .text("ARCHIVE", { align: "center" })
         .moveDown(0.3);

      // Company Details
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor("#666666")
         .text("Address: Archive, Kochi, Pin: 686457", { align: "center" })
         .text("Phone: +91-9081969790 | Email: archive@gmail.com", { align: "center" })
         .moveDown(1);

      // Decorative Line
      doc.moveTo(leftMargin, doc.y)
         .lineTo(rightMargin, doc.y)
         .lineWidth(1)
         .strokeColor("#CCCCCC")
         .stroke()
         .moveDown(1);

      // Invoice Title
      doc.fontSize(20)
         .font('Helvetica-Bold')
         .fillColor("#333333")
         .text("INVOICE", { align: "center" })
         .moveDown(1);

      // Two-column layout for order details and shipping address
      const detailsY = doc.y;
      
      // Left Column - Order Details
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor("#444444")
         .text("Order Details", leftMargin)
         .moveDown(0.5);

      doc.fontSize(10)
         .font('Helvetica')
         .fillColor("#666666")
         .text(`Order ID: ${order._id}`, leftMargin)
         .text(`Order Date: ${new Date(order.orderDate).toLocaleDateString()}`, leftMargin)
         .text(`Payment Method: ${order.paymentMethod}`, leftMargin)
         .text(`Order Status: ${order.orderStatus}`, leftMargin);

      // Right Column - Shipping Address
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor("#444444")
         .text("Shipping Address", doc.page.width / 2, detailsY)
         .moveDown(0.5);

      const address = order.address;
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor("#666666")
         .text(`${address.addressType}, ${address.name}`, doc.page.width / 2)
         .text(`${address.city}, ${address.state}, ${address.pincode}`)
         .text(`Landmark: ${address.landMark}`)
         .text(`Phone: ${address.phone}`);
      
      if (address.altPhone) {
        doc.text(`Alt Phone: ${address.altPhone}`);
      }

      // Move to the lowest Y position from both columns
      doc.moveDown(2);

      // Order Items Table
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor("#444444")
         .text("Order Items", leftMargin)
         .moveDown(1);

      // Table styling
      const tableTop = doc.y;
      const tableWidth = pageWidth;
      const columnWidths = {
        no: tableWidth * 0.08,
        product: tableWidth * 0.42,
        quantity: tableWidth * 0.15,
        price: tableWidth * 0.15,
        subtotal: tableWidth * 0.20
      };

      // Table Headers with background
      doc.fillColor("#f6f6f6")
         .rect(leftMargin, tableTop, tableWidth, 20)
         .fill();

      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor("#333333");

      // Header positions
      const headerY = tableTop + 5;
      doc.text("No", leftMargin, headerY)
         .text("Product", leftMargin + columnWidths.no, headerY)
         .text("Qty", leftMargin + columnWidths.no + columnWidths.product, headerY)
         .text("Price", leftMargin + columnWidths.no + columnWidths.product + columnWidths.quantity, headerY)
         .text("Subtotal", leftMargin + columnWidths.no + columnWidths.product + columnWidths.quantity + columnWidths.price, headerY);

      // Table Rows
      let currentY = tableTop + 25;
      let totalAmount = 0;

      order.items.forEach((item, index) => {
        const subtotal = item.quantity * item.price;
        totalAmount = order.totalAmount;

        // Alternate row background
        if (index % 2 === 0) {
          doc.fillColor("#fafafa")
             .rect(leftMargin, currentY - 5, tableWidth, 20)
             .fill();
        }

        doc.fontSize(9)
           .font('Helvetica')
           .fillColor("#444444")
           .text((index + 1).toString(), leftMargin, currentY)
           .text(item.productId.productName, leftMargin + columnWidths.no, currentY, {
             width: columnWidths.product - 10,
             ellipsis: true
           })
           .text(item.quantity.toString(), leftMargin + columnWidths.no + columnWidths.product, currentY)
           .text(`${item.price.toFixed(2)}`, leftMargin + columnWidths.no + columnWidths.product + columnWidths.quantity, currentY)
           .text(`${subtotal.toFixed(2)}`, leftMargin + columnWidths.no + columnWidths.product + columnWidths.quantity + columnWidths.price, currentY);

        currentY += 20;
      });

      // Total Section with proper alignment
      doc.moveDown(2);
      const totalSectionX = rightMargin - 200;
      const amountColumnX = totalSectionX + 120;
      
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor("#333333")
         .text("Invoice Summary", totalSectionX)
         .moveDown(0.5);

      // Summary box with light background
      const summaryBoxY = doc.y;
      doc.fillColor("#f9f9f9")
         .rect(totalSectionX, summaryBoxY, 200, 80)
         .fill();

      // Labels column (left-aligned)
      doc.fillColor("#666666")
         .fontSize(10)
         .font('Helvetica')
         .text("Subtotal:", totalSectionX + 10, summaryBoxY + 15)
         .text("Discount:", totalSectionX + 10, summaryBoxY + 35)
         .font('Helvetica-Bold')
         .text("Total Amount:", totalSectionX + 10, summaryBoxY + 55);

      // Amounts column (right-aligned)
      doc.fontSize(10)
         .font('Helvetica')
         .text(`${totalAmount.toFixed(2)}`, amountColumnX, summaryBoxY + 15, { width: 70, align: 'right' })
         .text(`${order.discount.toFixed(2)}`, amountColumnX, summaryBoxY + 35, { width: 70, align: 'right' })
         .font('Helvetica-Bold')
         .text(`${(totalAmount).toFixed(2)}`, amountColumnX, summaryBoxY + 55, { width: 70, align: 'right' });

      // Footer
      doc.fontSize(8)
         .font('Helvetica')
         .fillColor("#999999")
         .text("Thank you for shopping with Archive!", leftMargin, doc.page.height - 100, { align: 'center' })
         .text("All prices are in Indian Rupees (INR)", { align: 'center' });

      // Finalize PDF
      doc.end();
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    } catch (error) {
      reject(error);
    }
  });
}



module.exports = { getInvoice };
