const User = require('../../models/userSchema');


const customerInfo = async (req,res) => {
    try {
        let search = "";
        if(req.query.search){
            search = req.query.search;
        }

        let page = 1;
        if(req.query.page){
            page = req.query.page;
        }
        const limit = 3
        const userData = await User.find({
            isAdmin:false,
            $or:[{ name: { $regex: ".*" + search + ".*", $options: 'i' } },{ email: { $regex: ".*" + search + ".*", $options: 'i' } }]
        }).limit(limit)
        .skip((page-1)*limit)
        .exec()

        const count =await User.find({
            isAdmin:false,
            $or:[{ name: { $regex: ".*" + search + ".*", $options: 'i' } },{ email: { $regex: ".*" + search + ".*", $options: 'i' } }]
        }).countDocuments()

        const totalPages = Math.ceil(count / limit);

        res.render('customerManagement',{data: userData,
                                         totalPages: totalPages,
                                         currentPage: page    
                                        })


    } catch (error) {
        console.error('Admin login error:', error);
        res.render('adminDash', { message: 'Login failed. Please try again.' });
    }
}


const unblockCustomer = async (req, res) => {
    try {
        const id = req.query.id;
        await User.updateOne({ _id: id }, { $set: { isBlocked: false } });
        res.status(200).json({ success: true, message: 'User unblocked successfully.' });
    } catch (error) {
        console.error("Error unblocking user:", error);
        res.status(500).json({ success: false, message: 'Failed to unblock user.' });
    }
};

const blockCustomer = async (req, res) => {
    try {
        const id = req.query.id;
        await User.updateOne({ _id: id }, { $set: { isBlocked: true } });
        res.status(200).json({ success: true, message: 'User blocked successfully.' });
    } catch (error) {
        console.error("Error blocking user:", error);
        res.status(500).json({ success: false, message: 'Failed to block user.' });
    }
};


module.exports = {customerInfo,unblockCustomer,blockCustomer}