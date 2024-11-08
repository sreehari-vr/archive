const mongoose = require("mongoose");
const{Schema} = mongoose

const userSchema = new Schema({
    name:{
        type:String,
        required:true
    },email:{
        type:String,
        required:true,
        unique:true
    },phone:{
        type:String,
        required:false,
        unique:false,
        sparse:true,
        default:null
    },password:{
        type:String,
        required:false
    },googleId:{
        type:String,
        unique: true,
        sparse: true
    },isBlocked:{
        type:Boolean,
        default:false
    },isAdmin:{
        type:Boolean,
        default:false
    }
})

const user = mongoose.model("user",userSchema);
module.exports = user;