const user = require("../models/userSchema");
const HTTP_STATUS_CODES = require("../utils/httpStatusCodes");


const userAuth = async (req, res, next) => {
  if (req.session.user) {
    try {
      const data = await user.findById(req.session.user);
      if (data && !data.isBlocked) {
        return next(); // Proceed to the next middleware or route
      } else {
        delete req.session.user; // Clear the session if the user is blocked
        return res.render("login", { message: "User is blocked by admin" });
      }
    } catch (error) {
      console.error("Error in auth middleware:", error);
      return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).render("login", {
        message: "Internal server error. Please try again later.",
      });
    }
  } else {
    return res.redirect("/login"); // Redirect to login if the session is not active
  }
};

const adminAuth = (req, res, next) => {
  if (req.session && req.session.admin) {
    return next();
  }
  return res.redirect("/admin/login"); // Redirect to admin login if session is missing
};

module.exports = { adminAuth, userAuth };
