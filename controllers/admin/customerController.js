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


const unblockCustomer = async (req,res)=>{
    try {
        let id = req.query.id;
        await User.updateOne({_id:id},{$set:{isBlocked:false}})
        res.redirect('/admin/users')
    } catch (error) {
        console.error("Error loading:",error)
    } 
}

const blockCustomer = async (req,res)=>{
    try {
        let id = req.query.id;
        await User.updateOne({_id:id},{$set:{isBlocked:true}})
        res.redirect('/admin/users')
    } catch (error) {
        console.error("Error loading:",error)
    }
}

module.exports = {customerInfo,unblockCustomer,blockCustomer}