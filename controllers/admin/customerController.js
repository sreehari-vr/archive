const User = require("../../models/userSchema");

const customerInfo = async (req, res) => {
  try {
    const search = req.query.search || ""; 
    const page = parseInt(req.query.page) || 1; 
    const limit = 3; 

    const filterCondition = {
      isAdmin: false,
      $or: [
        { name: { $regex: ".*" + search + ".*", $options: "i" } },
        { email: { $regex: ".*" + search + ".*", $options: "i" } },
      ],
    };

    const userData = await User.find(filterCondition)
      .limit(limit)
      .skip((page - 1) * limit)
      .sort({ _id: -1 });

    const count = await User.countDocuments(filterCondition);

    const totalPages = Math.ceil(count / limit);

    res.render("customerManagement", {
      data: userData,          
      totalPages: totalPages,  
      currentPage: page,       
      search: search,          
    });
  } catch (error) {
    console.error("Error fetching customer info:", error);
    res.render("adminDash", { message: "Something went wrong. Please try again." });
  }
};


const unblockCustomer = async (req, res) => {
  try {
    const id = req.query.id;
    await User.updateOne({ _id: id }, { $set: { isBlocked: false } });
    res
      .status(200)
      .json({ success: true, message: "User unblocked successfully." });
  } catch (error) {
    console.error("Error unblocking user:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to unblock user." });
  }
};

const blockCustomer = async (req, res) => {
  try {
    const id = req.query.id;
    await User.updateOne({ _id: id }, { $set: { isBlocked: true } });
    res
      .status(200)
      .json({ success: true, message: "User blocked successfully." });
  } catch (error) {
    console.error("Error blocking user:", error);
    res.status(500).json({ success: false, message: "Failed to block user." });
  }
};

module.exports = { customerInfo, unblockCustomer, blockCustomer };
