const express = require('express');
const router = express.Router()
const adminController = require('../controllers/admin/adminController')
const {adminAuth,userAuth} = require("../middleware/auth")
const customerController = require("../controllers/admin/customerController")
const categoryController = require("../controllers/admin/categoryController")


router.get('/login',adminAuth,adminController.loadAdminLogin);
router.post('/login',adminAuth,adminController.login)
router.get('/adminDash',adminAuth,adminController.loadAdminDash)
router.get('/users',adminAuth,customerController.customerInfo)
router.get('/blockCustomer',adminAuth,customerController.blockCustomer)
router.get('/unblockCustomer',adminAuth,customerController.unblockCustomer)
router.get('/category',adminAuth,categoryController.categoryInfo)
router.post('/category',adminAuth,categoryController.categoryInfo)
router.get('/updateCategory', adminAuth, categoryController.renderUpdateCategoryForm); 
router.post('/updateCategory', adminAuth, categoryController.updateCategory); 
router.get('/delete', adminAuth, categoryController.softDeleteCategory); 
router.get('/restore', adminAuth, categoryController.restoreCategory); 
router.get('/addCategory', adminAuth, categoryController.addCategory);
router.post('/addCategory', adminAuth, categoryController.addCategory);


module.exports=router