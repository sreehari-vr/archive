const HTTP_STATUS_CODES = require("../utils/httpStatusCodes");

const userNotFound = (req, res, next) => {
    if (req.originalUrl.startsWith('/admin')) {
      next();
      return;
    }
    res.status(HTTP_STATUS_CODES.NOT_FOUND).render("404"); // User 404 page
  };
  
  const adminNotFound = (req, res, next) => {
    if (!req.originalUrl.startsWith('/admin')) {
      next();
      return;
    }
    res.status(HTTP_STATUS_CODES.NOT_FOUND).render("admin404"); // Admin 404 page
  };
  
  const userErrorHandler = (err, req, res, next) => {
    if (req.originalUrl.startsWith('/admin')) {
      next(err);
      return;
    }
    console.error(err.stack);
    res.status(err.status || 500).render("error", {
      message: "Something went wrong. We're working on it!",
      error: process.env.NODE_ENV === "development" ? err : {},
    });
  };
  
  const adminErrorHandler = (err, req, res, next) => {
    if (!req.originalUrl.startsWith('/admin')) {
      next(err);
      return;
    }
    console.error(err.stack);
    res.status(err.status || 500).render("adminError", {
      message: "Admin Panel Error. Please contact technical support.",
      error: process.env.NODE_ENV === "development" ? err : {},
    });
  };



  
  module.exports = {
    userNotFound,
    adminNotFound,
    userErrorHandler,
    adminErrorHandler,
  };