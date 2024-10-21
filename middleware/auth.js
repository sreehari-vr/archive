user = require('../models/userSchema')

const userAuth = async (req,res,next) => {
    if(req.session.user){
        user.findById(req.session.user)
        .then((data)=>{
            if (data && !data.isBlocked){
                next();
            }else{
                res.render('/login')
            }
        }).catch(error =>{
            console.log("error in auth middleware",error)
            res.status(500).send("internal server error",error);
        })
    }else{
        res.redirect('/login')
    }
}

const adminAuth = async (req,res,next) => {
    user.findOne({isAdmin:true})
    .then((data)=>{
        if(data){
            next()
        }else{
            res.redirect('/admin/login')
        }
    })
    .catch(error=>{
        console.log("error in auth middleware",error)
        res.status(500).send("internal server error",error);
    })
}


module.exports={adminAuth,userAuth}
