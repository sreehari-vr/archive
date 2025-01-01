const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const bcrypt = require("bcrypt");
const path = require("path");
const HTTP_STATUS_CODES = require("../../utils/httpStatusCodes");


const loadAdminLogin = async (req, res) => {
  if (req.session.admin) {
    return res.redirect("/admin/adminDash");
  }
  res.status(HTTP_STATUS_CODES.OK).render("adminLogin", { message: null });};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      return res.render("adminLogin", { message: "Invalid email format." });
    }

    if (password.length < 6) {
      return res.render("adminLogin", {
        message: "Password must be at least 6 characters long.",
      });
    }

    const admin = await User.findOne({ email: email, isAdmin: true });
    if (!admin) {
      return res.render("adminLogin", {
        message: "No admin account found with this email.",
      });
    }

    const passwordMatch = await bcrypt.compare(password, admin.password);
    if (!passwordMatch) {
      return res.render("adminLogin", {
        message: "Incorrect password. Please try again.",
      });
    }

    req.session.admin = true;
    return res.redirect("/admin/adminDash");
  } catch (error) {
    console.error("Admin login error:", error);
    res.render("adminLogin", {
      message: "An error occurred. Please try again.",
    });
  }
};

const loadAdminDash = async (req, res) => {
  try {
    if (req.session.admin) {
      const topSellingProducts = await Order.aggregate([
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.productId",
            totalSold: { $sum: "$items.quantity" },
          },
        },
        { $sort: { totalSold: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: "products",
            localField: "_id",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: "$product" },
        {
          $project: {
            _id: 0,
            productName: "$product.productName",
            totalSold: 1,
          },
        },
      ]);

      const bestSellingCategories = await Order.aggregate([
        { $unwind: "$items" },
        {
          $lookup: {
            from: "products",
            localField: "items.productId",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: "$product" },
        {
          $lookup: {
            from: "categories",
            localField: "product.category",
            foreignField: "_id",
            as: "category",
          },
        },
        { $unwind: "$category" },
        {
          $group: {
            _id: "$category.name",
            totalSold: { $sum: "$items.quantity" },
          },
        },
        { $sort: { totalSold: -1 } },
        { $limit: 5 },
        {
          $project: {
            _id: 0,
            categoryName: "$_id",
            totalSold: 1,
          },
        },
      ]);

      return res.render("adminDash", {
        topSellingProducts,
        bestSellingCategories,
      });
    }
  } catch (error) {
    console.error("Error loading admin dashboard:", error);
  }
};

const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.log("Error destroying session", err);
      }
      res.redirect("/admin/login");
    });
  } catch (error) {
    console.log(error);
  }
};

const getSalesReport = async (req, res) => {
  try {
    const { filter, startDate, endDate } = req.query;

    const now = new Date();
    let query = {};

    if (filter === "Daily") {
      const startOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );
      const endOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
        999
      );
      query.orderDate = { $gte: startOfDay, $lte: endOfDay };
    } else if (filter === "Weekly") {
      const startOfWeek = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - now.getDay()
      );
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      query.orderDate = { $gte: startOfWeek, $lte: endOfWeek };
    } else if (filter === "Yearly") {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      query.orderDate = { $gte: startOfYear, $lte: endOfYear };
    } else if (filter === "Custom" && startDate && endDate) {
      query.orderDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const orders = await Order.find(query).populate("items.productId");
    const products = await Product.find();
    const carts = await Cart.find();

    const totalOrders = orders.length;
    const totalAmount = orders.reduce(
      (sum, order) => sum + order.totalAmount,
      0
    );

    const totalCouponOffers = orders.reduce(
      (sum, order) => sum + order.discount,
      0
    );
    const totalOffers = products.reduce((sum, product) => {
      return sum + (product.regularPrice - product.salePrice);
    }, 0);

    const totalDelivered = orders.filter(
      (order) => order.orderStatus === "Delivered"
    ).length;
    const totalShipped = orders.filter(
      (order) => order.orderStatus === "Shipped"
    ).length;
    const totalReturned = orders.filter(
      (order) => order.orderStatus === "Returned"
    ).length;
    const totalCancelled = orders.filter(
      (order) => order.orderStatus === "Cancelled"
    ).length;

    res.render("report", {
      totalOrders,
      totalAmount,
      totalCouponOffers,
      totalOffers,
      totalDelivered,
      totalShipped,
      totalReturned,
      totalCancelled,
      filter,
      startDate,
      endDate,
    });
  } catch (error) {
    console.error(error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).send("Error fetching sales report");
  }
};

const downloadExcelReport = async (req, res) => {
  try {
    const { filter, startDate, endDate } = req.query;

    const now = new Date();
    let query = {};
    if (filter === "Daily") {
      const startOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );
      const endOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
        999
      );
      query.orderDate = { $gte: startOfDay, $lte: endOfDay };
    } else if (filter === "Weekly") {
      const startOfWeek = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - now.getDay()
      );
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      query.orderDate = { $gte: startOfWeek, $lte: endOfWeek };
    } else if (filter === "Yearly") {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      query.orderDate = { $gte: startOfYear, $lte: endOfYear };
    } else if (filter === "Custom" && startDate && endDate) {
      query.orderDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const orders = await Order.find(query);
    const totalOrders = orders.length;
    const totalAmount = orders.reduce(
      (sum, order) => sum + order.totalAmount,
      0
    );

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sales Report");

    sheet.columns = [
      { header: "Order ID", key: "_id", width: 20 },
      { header: "Order Date", key: "orderDate", width: 15 },
      { header: "Total Amount", key: "totalAmount", width: 15 },
    ];

    orders.forEach((order) => {
      sheet.addRow({
        _id: order._id.toString(),
        orderDate: order.orderDate.toLocaleDateString(),
        totalAmount: order.totalAmount.toFixed(2),
      });
    });

    sheet.addRow({});
    sheet.addRow({
      _id: "Summary",
      totalAmount: `Total: Rs. ${totalAmount.toFixed(2)}`,
    });

    const fileName = `Sales_Report_${Date.now()}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).send("Error generating Excel report");
  }
};

const downloadPdfReport = async (req, res) => {
  try {
    const { filter, startDate, endDate } = req.query;
    const now = new Date();
    let query = {};

    if (filter === "Daily") {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      query.orderDate = { $gte: startOfDay, $lte: endOfDay };
    } else if (filter === "Weekly") {
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      query.orderDate = { $gte: startOfWeek, $lte: endOfWeek };
    } else if (filter === "Yearly") {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      query.orderDate = { $gte: startOfYear, $lte: endOfYear };
    } else if (filter === "Custom" && startDate && endDate) {
      query.orderDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const orders = await Order.find(query).populate('items.productId');
    const products = await Product.find();

    // Calculate metrics
    const totalOrders = orders.length;
    const totalAmount = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const totalCouponOffers = orders.reduce((sum, order) => sum + (order.discount || 0), 0);
    const totalOffers = products.reduce((sum, product) => sum + (product.regularPrice - product.salePrice), 0);
    
    const orderStatusCounts = {
      delivered: orders.filter(order => order.orderStatus === "Delivered").length,
      shipped: orders.filter(order => order.orderStatus === "Shipped").length,
      returned: orders.filter(order => order.orderStatus === "Returned").length,
      cancelled: orders.filter(order => order.orderStatus === "Cancelled").length,
      processing: orders.filter(order => order.orderStatus === "Processing").length
    };

    // Create PDF document
    const doc = new PDFDocument({
      margin: 50,
      size: 'A4'
    });

    // Set up response headers
    const fileName = `Sales_Report_${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    // Pipe the PDF to the response
    doc.pipe(res);

  
    // Add company details
    doc.fontSize(10)
       .text('Archive', 50, 70)
       .text('Kochi, Kerala')
       .text('Phone: (+91) 6238089989')
       .text('Email: archive@gmail.com');

    // Add report title
    doc.fontSize(24)
       .text('Sales Report', 50, 170, { align: 'center' })
       .moveDown(0.5);

    // Add report period
    doc.fontSize(12)
       .fillColor('#666666')
       .text(`Report Period: ${filter}`, { align: 'center' })
       .text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' })
       .moveDown(2);

    // Add summary section
    doc.fontSize(16)
       .fillColor('#000000')
       .text('Summary', 50, 280)
       .moveDown(0.5);

    // Create summary table
    const summaryData = [
      ['Total Orders', totalOrders, 'Total Amount', `INR. ${totalAmount.toFixed(2)}`],
      ['Total Discounts', `INR. ${totalOffers.toFixed(2)}`, 'Coupon Discounts', `INR. ${totalCouponOffers.toFixed(2)}`]
    ];

    let yPos = doc.y + 10;
    summaryData.forEach(row => {
      doc.fontSize(10)
         .text(row[0], 50, yPos)
         .text(row[1].toString(), 150, yPos)
         .text(row[2], 300, yPos)
         .text(row[3].toString(), 400, yPos);
      yPos += 20;
    });

    // Add order status section
    doc.fontSize(16)
       .text('Order Status Breakdown', 50, yPos + 30)
       .moveDown(0.5);

    // Create status table
    const statusTableTop = doc.y + 10;
    const statusData = [
      ['Status', 'Count', 'Percentage'],
      ['Delivered', orderStatusCounts.delivered, ((orderStatusCounts.delivered / totalOrders) * 100).toFixed(1) + '%'],
      ['Shipped', orderStatusCounts.shipped, ((orderStatusCounts.shipped / totalOrders) * 100).toFixed(1) + '%'],
      ['Processing', orderStatusCounts.processing, ((orderStatusCounts.processing / totalOrders) * 100).toFixed(1) + '%'],
      ['Returned', orderStatusCounts.returned, ((orderStatusCounts.returned / totalOrders) * 100).toFixed(1) + '%'],
      ['Cancelled', orderStatusCounts.cancelled, ((orderStatusCounts.cancelled / totalOrders) * 100).toFixed(1) + '%']
    ];

    // Draw status table
    const colWidths = [150, 100, 100];
    let currentTop = statusTableTop;

    statusData.forEach((row, rowIndex) => {
      // Draw background for header row
      if (rowIndex === 0) {
        doc.fillColor('#f0f0f0')
           .rect(50, currentTop - 5, sum(colWidths), 25)
           .fill();
      }

      // Draw cell borders and text
      let leftPos = 50;
      row.forEach((cell, colIndex) => {
        doc.strokeColor('#cccccc')
           .lineWidth(1)
           .rect(leftPos, currentTop - 5, colWidths[colIndex], 25)
           .stroke();

        doc.fillColor('#000000')
           .fontSize(10)
           .text(cell, leftPos + 5, currentTop);

        leftPos += colWidths[colIndex];
      });

      currentTop += 25;
    });


    // Finalize the PDF
    doc.end();

  } catch (error) {
    console.error('Error generating PDF report:', error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).send('Error generating PDF report');
  }
};

// Helper function to sum array values
const sum = arr => arr.reduce((a, b) => a + b, 0);

const chart = async (req, res) => {
  try {
    const { filter, startDate, endDate } = req.query;

    let query = {};
    const now = new Date();

    if (filter === "Daily") {
      const startOfDay = new Date(now.setHours(0, 0, 0, 0));
      const endOfDay = new Date(now.setHours(23, 59, 59, 999));
      query.orderDate = { $gte: startOfDay, $lte: endOfDay };
    } else if (filter === "Weekly") {
      const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      query.orderDate = { $gte: startOfWeek, $lte: endOfWeek };
    } else if (filter === "Monthly") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      query.orderDate = { $gte: startOfMonth, $lte: endOfMonth };
    } else if (filter === "Yearly") {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      query.orderDate = { $gte: startOfYear, $lte: endOfYear };
    } else if (filter === "Custom" && startDate && endDate) {
      query.orderDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const orders = await Order.find(query);

    const data = {
      orders: orders.length,
      processing: orders.filter((o) => o.orderStatus === "Processing").length,
      delivered: orders.filter((o) => o.orderStatus === "Delivered").length,
      cancelled: orders.filter((o) => o.orderStatus === "Cancelled").length,
      shipped: orders.filter((o) => o.orderStatus === "Shipped").length,
      returned: orders.filter((o) => o.orderStatus === "Returned").length,
    };

    res.json(data);
  } catch (error) {
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({ error: "Error fetching sales data" });
  }
};

module.exports = {
  loadAdminLogin,
  login,
  loadAdminDash,
  logout,
  getSalesReport,
  downloadExcelReport,
  downloadPdfReport,
  chart,
};
