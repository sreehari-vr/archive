const Wishlist = require("../../models/wishlistSchema")

const loadWishlist = async (req,res) => {
    try {
      const userId = req.session.user;
      const wishlist = await Wishlist.findOne({userId}).populate('items.productId');
      res.render('wishList',{wishlist})
    } catch (error) {
      console.error("Error loading page:", error);
  
    }
  }
  
  const addWishlist = async (req,res) => {
    try {
      const userId = req.session.user;
      const productId = req.params.id;
      const userWishlist = await Wishlist.findOne({userId})
      if(userWishlist){
        const already = userWishlist.items.find(item=>item.productId.toString()===productId);
        if(already){
            return res.status(403).json({message:"Product already exists"});
        }
        userWishlist.items.push({ productId });
      await userWishlist.save();
      }else{
        const newWishlist = new Wishlist({
            userId,
            items:[{
                productId
            }]
        })
        await newWishlist.save();
      }
      res.redirect('/wishlist')
    } catch (error) {
      console.error("Error loading page:", error);
  
    }
  }

  const removeWishlist = async (req,res) => {
    try {
        const productId = req.params.id
        const userId = req.session.user
        const wishlist = await Wishlist.findOne({userId})
        const removingProduct = wishlist.items.find(item=>item.productId.toString()===productId)
        await Wishlist.updateOne({userId},{$pull:{items:{_id:removingProduct}}})
        res.redirect('/wishlist')
    } catch (error) {
        
    }
  }

  
  module.exports = ({
    addWishlist,
    loadWishlist,
    removeWishlist
  })