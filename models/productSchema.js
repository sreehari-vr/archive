const mongoose = require('mongoose');
const{Schema} = mongoose;


const productSchema = new mongoose.Schema({
  productName: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
  },
  regularPrice: {
    type: Number,
    required: true,
  },
  salePrice: {
    type: Number,
    required: true,
  },
  productOffer: {
    type: Number,
    default: 0,
  },
  quantity: {
    type:Number,
    default: 0,
  },
  productImage: {
    type:[String],
    required:true
  },
  isActive:{
    type:Boolean,
    default:true
  },
  deletedAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  status:{
    type:String,
    enum:["Available","Out of stock"],
    required:true,
    default:"Available",
  }
});


const product = mongoose.model("product", productSchema);
module.exports = product