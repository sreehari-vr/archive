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
        if(admin){

        const passwordMatch =  bcrypt.compare(password, admin.password);
        if (passwordMatch) {
            req.session.admin = true;
            return res.redirect('/admin/adminDash')
        }else{
            return res.redirect("/admin/login")
        }

    }else{
        return res.redirect("/admin/login")
    }

    } catch (error) {
        console.error('Admin login error:', error);
        res.render('adminLogin', { message: 'Login failed. Please try again.' });
      }
    };


    const loadAdminDash = async (req,res)=>{
        try {
            if (req.session.admin) {
                return res.render("adminDash")

            }
        } catch (error) {
            console.error("Error loading admin dashboard:",error)
        } 
    }

    const logout = async (req,res)=>{
        try {
          req.session.destroy(err=>{
            if(err){
              console.log("Error destroying session",err);
            }
            res.redirect('/admin/login')
          })
        } catch (error) {
          console.log(error)
        }
      }

    

module.exports={loadAdminLogin,login,loadAdminDash,logout}