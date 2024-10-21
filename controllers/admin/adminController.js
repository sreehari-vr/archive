const User = require('../../models/userSchema');
const bcrypt = require('bcrypt')

const loadAdminLogin = async (req,res) => {
    try {
        res.render('adminLogin');
        
    } catch (error) {
        console.log("NO adminLogin found");
        res.status(500).send("server error");
    }
}

const login = async (req,res) =>{
    try {
        const{email,password}=req.body;
        const admin = await User.findOne({email: email,isAdmin: true});
        if(!admin){
            return res.render('adminLogin', { message: 'Admin not found' });
        }

        const passwordMatch = await bcrypt.compare(password, admin.password);
        if (!passwordMatch) {
        return res.render('adminLogin', { message: 'Incorrect password' });
        }

        req.session.admin = admin._id; // Set session for the admin
        res.redirect('/admin/adminDash');  // Redirect to the admin dashboard or desired page

    } catch (error) {
        console.error('Admin login error:', error);
        res.render('adminLogin', { message: 'Login failed. Please try again.' });
      }
    };


    const loadAdminDash = async (req,res)=>{
        try {
             res.render("adminDash")
        } catch (error) {
            console.error("Error loading admin dashboard:",error)
        } 
    }

    

module.exports={loadAdminLogin,login,loadAdminDash}