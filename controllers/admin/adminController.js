const User = require('../../models/userSchema');
const bcrypt = require('bcrypt')

const loadAdminLogin = async (req,res) => {
        if (req.session.admin) {
            return res.redirect('/admin/adminDash');
        } 
        res.render("adminLogin",{message:null})
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
            if (!req.session.admin) {
                return res.render("adminDash")

            }
        } catch (error) {
            console.error("Error loading admin dashboard:",error)
        } 
    }

    const logout = async (req,res) =>{
        try {
            req.session.admin=null
            res.redirect('/admin/login')
        } catch (error) {
            console.error("Logout not working:",error)
        }
    }

    

module.exports={loadAdminLogin,login,loadAdminDash,logout}