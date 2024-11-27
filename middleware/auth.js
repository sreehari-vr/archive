user = require("../models/userSchema");

const userAuth = async (req, res, next) => {
  if (req.session.user) {
    user
      .findById(req.session.user)
      .then((data) => {
        if (data && !data.isBlocked) {
          next();
        } else {
          delete req.session.user;
          res.render("login", { message: "User is blocked by admin" });
        }
      })
      .catch((error) => {
        console.log("error in auth middleware", error);
        res.status(500).send("internal server error", error);
      });
  } else {
    res.redirect("/login");
  }
};

const adminAuth = (req, res, next) => {
  if (req.session && req.session.admin) {
    return next();
  }
  res.redirect("/admin/login");
};

module.exports = { adminAuth, userAuth };
