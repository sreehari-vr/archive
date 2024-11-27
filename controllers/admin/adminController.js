const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const bcrypt = require("bcrypt");
const path = require('path');



const loadAdminLogin = async (req, res) => {
  if (req.session.admin) {
    return res.redirect("/admin/adminDash");
  }
  res.render("adminLogin", { message: null });
};



const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await User.findOne({ email: email, isAdmin: true });
    if (admin) {
      const passwordMatch = bcrypt.compare(password, admin.password);
      if (passwordMatch) {
        req.session.admin = true;
        return res.redirect("/admin/adminDash");
      } else {
        return res.redirect("/admin/login");
      }
    } else {
      return res.redirect("/admin/login");
    }
  } catch (error) {
    console.error("Admin login error:", error);
    res.render("adminLogin", { message: "Login failed. Please try again." });
  }
};



const loadAdminDash = async (req, res) => {
  try {
    if (req.session.admin) {
      return res.render("adminDash");
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

    if (filter === 'Daily') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      query.orderDate = { $gte: startOfDay, $lte: endOfDay };
    } else if (filter === 'Weekly') {
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      query.orderDate = { $gte: startOfWeek, $lte: endOfWeek };
    } else if (filter === 'Yearly') {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      query.orderDate = { $gte: startOfYear, $lte: endOfYear };
    } else if (filter === 'Custom' && startDate && endDate) {
      query.orderDate = { 
        $gte: new Date(startDate), 
        $lte: new Date(endDate) 
      };
    }
    

    const orders = await Order.find(query);
    const products = await Product.find();
    const carts = await Cart.find();

    const totalOrders = orders.length;
    const totalAmount = orders.reduce((sum, order) => sum + order.totalAmount, 0);

    const totalCouponOffers = carts.reduce((sum, cart) => sum + cart.discount, 0);
    const totalOffers = products.reduce((sum, product) => {
      return sum + (product.regularPrice - product.salePrice);
    }, 0);

    const totalDelivered = orders.filter(order => order.orderStatus === "Delivered").length;
    const totalShipped = orders.filter(order => order.orderStatus === "Shipped").length;
    const totalReturned = orders.filter(order => order.orderStatus === "Returned").length;
    const totalCancelled = orders.filter(order => order.orderStatus === "Cancelled").length;

    res.render('report', {
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
      endDate
    });

  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching sales report");
  }
};


const downloadExcelReport = async (req, res) => {
  try {
    const { filter, startDate, endDate } = req.query;

    const now = new Date();
    let query = {};
    if (filter === 'Daily') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      query.orderDate = { $gte: startOfDay, $lte: endOfDay };
    } else if (filter === 'Weekly') {
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      query.orderDate = { $gte: startOfWeek, $lte: endOfWeek };
    } else if (filter === 'Yearly') {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      query.orderDate = { $gte: startOfYear, $lte: endOfYear };
    } else if (filter === 'Custom' && startDate && endDate) {
      query.orderDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const orders = await Order.find(query);
    const totalOrders = orders.length;
    const totalAmount = orders.reduce((sum, order) => sum + order.totalAmount, 0);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sales Report');

    sheet.columns = [
      { header: 'Order ID', key: '_id', width: 20 },
      { header: 'Order Date', key: 'orderDate', width: 15 },
      { header: 'Total Amount', key: 'totalAmount', width: 15 }
    ];

    orders.forEach(order => {
      sheet.addRow({
        _id: order._id.toString(),
        orderDate: order.orderDate.toLocaleDateString(),
        totalAmount: order.totalAmount.toFixed(2)
      });
    });

    sheet.addRow({});
    sheet.addRow({ _id: 'Summary', totalAmount: `Total: Rs. ${totalAmount.toFixed(2)}` });

    const fileName = `Sales_Report_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).send('Error generating Excel report');
  }
};





const downloadPdfReport = async (req, res) => {
  try {
    const { filter, startDate, endDate } = req.query;

    const now = new Date();
    let query = {};
    if (filter === 'Daily') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      query.orderDate = { $gte: startOfDay, $lte: endOfDay };
    } else if (filter === 'Weekly') {
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      query.orderDate = { $gte: startOfWeek, $lte: endOfWeek };
    } else if (filter === 'Yearly') {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      query.orderDate = { $gte: startOfYear, $lte: endOfYear };
    } else if (filter === 'Custom' && startDate && endDate) {
      query.orderDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const orders = await Order.find(query)
      .populate({
        path: 'items.productId', 
        model: 'product', 
      })
      .populate('userId'); 

    const totalOrders = orders.length;
    const totalAmount = orders.reduce((sum, order) => sum + order.totalAmount, 0);

    const doc = new PDFDocument();
    const fileName = `Sales_Report_${Date.now()}.pdf`;
    const reportDir = path.join(__dirname, 'reports');

    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const filePath = path.join(reportDir, fileName);

    doc.pipe(fs.createWriteStream(filePath)); 
    doc.pipe(res); 

    doc.fontSize(18).text('Sales Report', { align: 'center' });
    doc.fontSize(12).text(`Filter: ${filter}`);
    doc.text(`Start Date: ${startDate || 'N/A'} | End Date: ${endDate || 'N/A'}`);
    doc.text(`Total Orders: ${totalOrders}`);
    doc.text(`Total Amount: Rs. ${totalAmount.toFixed(2)}`);
    
    doc.text('\n\nOrder Details:');

    orders.forEach(order => {
      doc.text(`\nOrder ID: ${order._id}`);
      doc.text(`User: ${order.userId.name || 'N/A'}`);
      doc.text(`Address: ${order.address.name}, ${order.address.city}, ${order.address.state} - ${order.address.pincode}`);
      doc.text(`Payment Method: ${order.paymentMethod}`);
      doc.text(`Payment Status: ${order.paymentStatus}`);
      doc.text(`Order Status: ${order.orderStatus}`);

      order.items.forEach(item => {
        doc.text(`Product: ${item.productId.name || 'N/A'}`);
        doc.text(`Quantity: ${item.quantity}`);
        doc.text(`Price: Rs. ${item.price}`);
        doc.text(`Subtotal: Rs. ${(item.price * item.quantity).toFixed(2)}`);
      });

      doc.text(`\nOrder Total: Rs. ${order.totalAmount.toFixed(2)}`);
      doc.text('-------------------------------------');
    });

    doc.end();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error generating PDF report');
  }
};




module.exports = { loadAdminLogin, login, loadAdminDash, logout, getSalesReport, downloadExcelReport, downloadPdfReport };
