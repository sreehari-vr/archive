const express = require("express");
const app = express();
const session = require('express-session');
const passport = require('./config/passport');
const path = require("path")
const bodyParser = require('body-parser');
const env = require("dotenv").config();
const db = require("./config/db");
const userRouter = require("./routes/userRouter.js");
const adminRouter = require("./routes/adminRouter.js")
db();


app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(session({
    secret:process.env.SESSION_SECRET,
    resave:false,
    saveUninitialized:true,
    cookie:{
        secure:false,
        httpOnly:true,
        maxAge:1000 * 60 * 60 * 24
    }
    
}))

app.use(passport.initialize());
app.use(passport.session());

app.use((req,res,next)=>{
    res.set('cache-control','no-store')
    next();
})

app.set("view engine","ejs")
app.set("views",[path.join(__dirname,'views/user'),
    path.join(__dirname,'views/admin')])
app.use(express.static(path.join(__dirname,"public")))

app.use("/",userRouter);
app.use("/admin",adminRouter);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/css', express.static(path.join(__dirname, 'css')));

 
app.listen(process.env.PORT,()=>{
    console.log(`Server running on http://localhost:${process.env.PORT}`);
})

module.exports = app;