const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const { adminAuth, userAuth } = require("../middleware/auth");
const customerController = require("../controllers/admin/customerController");
const categoryController = require("../controllers/admin/categoryController");
const productController = require("../controllers/admin/productController");
const orderController = require("../controllers/admin/orderController");
const couponController = require("../controllers/admin/couponController");

router.get("/login", adminController.loadAdminLogin);
router.post("/login", adminController.login);
router.get("/logout", adminController.logout);
router.get("/adminDash", adminAuth, adminController.loadAdminDash);
router.get("/users", adminAuth, customerController.customerInfo);
router.get("/blockCustomer", adminAuth, customerController.blockCustomer);
router.get("/unblockCustomer", adminAuth, customerController.unblockCustomer);
//category
router.get("/category", adminAuth, categoryController.categoryInfo);
router.post("/category", adminAuth, categoryController.categoryInfo);
router.get("/addCategory", adminAuth, categoryController.addCategory);
router.post("/addCategory", adminAuth, categoryController.check);
router.get(
  "/updateCategory",
  adminAuth,
  categoryController.renderUpdateCategoryForm
);
router.post("/updateCategory", adminAuth, categoryController.updateCategory);
router.get("/unlist", adminAuth, categoryController.unlistCategory);
router.get("/list", adminAuth, categoryController.listCategory);
router.get(
  "/softDeleteCategory",
  adminAuth,
  categoryController.softDeleteCategory
);
//products
router.get("/products", adminAuth, productController.productInfo);
router.get("/addProduct", adminAuth, productController.getAddProduct);
router.post(
  "/addProduct",
  adminAuth,
  productController.upload.array("images", 4),
  productController.addProducts
);
router.get("/unlistProduct", adminAuth, productController.unlistProduct);
router.get("/listProduct", adminAuth, productController.listProduct);
router.get(
  "/softDeleteProduct",
  adminAuth,
  productController.softDeleteProduct
);

router.post(
  "/updateProduct",
  adminAuth,
  productController.upload.array("images", 4),
  productController.updateProduct
);

router.get(
  "/updateProduct",
  adminAuth,
  productController.renderUpdateProductForm
);

router.get("/orders", adminAuth, orderController.listOrders);

router.get("/orders/:id", adminAuth, orderController.viewOrder);

router.post(
  "/orders/:orderId/update-order-status",
  adminAuth,
  orderController.updateOrderStatus
);

// router.post(
//   "/orders/:orderId/update-payment-status",
//   adminAuth,
//   orderController.updatePaymentStatus
// );

router.post('/orders/:orderId/items/:itemId/update-status',adminAuth,
  orderController.updateItemStatus
); 

// router.post('/orders/:orderId/items/:itemId/update-payment-status',adminAuth,
//   orderController.updateItemPaymentStatus
// );  




router.get("/coupon", adminAuth, couponController.loadCoupon);
router.get("/addCoupon", adminAuth, couponController.loadAddCoupon);
router.post("/addCoupon", adminAuth, couponController.addCoupon);
router.get("/inactivateCoupon", adminAuth, couponController.inactivateCoupon);
router.get("/activateCoupon", adminAuth, couponController.activateCoupon);
router.get("/softDeleteCoupon", adminAuth, couponController.softDeleteCoupon);
router.get("/updateCoupon", adminAuth, couponController.loadUpdateCoupon);
router.post("/updateCoupon", adminAuth, couponController.updateCoupon);

router.get("/report", adminAuth, adminController.getSalesReport);
router.get("/report/pdf", adminAuth, adminController.downloadPdfReport);
router.get("/report/excel", adminAuth, adminController.downloadExcelReport);

router.get("/chart", adminAuth, adminController.chart);
router.get("/notifications", adminAuth, orderController.notifications);
router.post('/orderReturnApprove/:orderId',adminAuth,
  orderController.orderReturnApprove
); 

router.post('/orderReturnReject/:orderId',adminAuth,
  orderController.orderReturnReject
); 

router.post('/itemReturnApprove/:orderId/:itemId',adminAuth,
  orderController.itemReturnApprove
); 

router.post('/itemReturnReject/:orderId/:itemId',adminAuth,
  orderController.itemReturnReject
); 

module.exports = router;
