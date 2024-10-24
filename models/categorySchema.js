const mongoose = require("mongoose");
const{Schema} = mongoose

const categorySchema = new mongoose.Schema({
    name: {
      type: String,
      required: false,
      unique: true,
    },
    description: {
      type: String,
      required: false,
    },
    isActive: {
      type: Boolean,
      default: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    deletedAt:{
      type:Date,
      default: null
    }
  });

  const category = mongoose.model("category",categorySchema);
  module.exports = category
