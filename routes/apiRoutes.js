// routes/apiRoutes.js

const express = require('express');
const User = require('../models/userSchema');
const Item = require('../models/itemSchema');
const { getInventory } = require('../utils/getInventory');
const isAuth = require('../middleware/isAuth');

const router = express.Router();

// Protected user route
router.get('/user', isAuth, async (req, res) => {
  const user = await User.findOne({ steamId: req.user.id });

  if (!user) return res.status(404).json({ message: 'User not found' });

  // Respond with user data
  res.json({ steamID64: user.steamId, username: user.username, avatar: user.avatar });
});



// router.js (or the file where your routes are defined)

  router.get('/inventory', isAuth, async (req, res) => {
    console.log(req.user.id);
    try {
      const steamID64 = req.user.id;
      const appId = 252490;
      const contextId = 2;
  
      if (!steamID64) {
        return res.status(400).json({ error: 'Missing SteamID64 parameter.' });
      }
  
      // Fetch the inventory from Steam
      const inventory = await getInventory(appId, steamID64, contextId);
      if (!inventory || !inventory.items || inventory.items.length === 0) {
        return res.status(404).json({ error: 'No inventory found.' });
      }
  
      // Find the user in the database and populate the current inventory
      const user = await User.findOne({ steamId: steamID64 }).populate('inventory');
      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }
  
      // Gather all assetIds from the Steam inventory
      const steamAssetIds = inventory.items.flatMap(item => item.assetIds);
  
      // Map current inventory items by assetId for quick lookup
      const currentInventoryItems = {};
      user.inventory.forEach(item => {
        currentInventoryItems[item.assetId] = item;
      });

      
  
      // Determine which assetIds to remove (items no longer in Steam inventory)
      const assetIdsToRemove = [];
      for (const assetId in currentInventoryItems) {
        if (!steamAssetIds.includes(assetId)) {
          assetIdsToRemove.push(assetId);
        }
      }
  
      // Remove items that are no longer in the Steam inventory from user's inventory
      if (assetIdsToRemove.length > 0) {
        // Update the user's inventory by removing items not in Steam inventory
        user.inventory = user.inventory.filter(item => !assetIdsToRemove.includes(item.assetId));
        await user.save();
        
        
  
        // Update the items in the Item collection to disassociate them from the user
        await Item.updateMany(
          { assetId: { $in: assetIdsToRemove }, owner: user._id },
          { $set: { owner: null } } // Or set an 'isActive' flag to false if preferred
        );
      }
  
      // Determine new assetIds to add (items in Steam inventory but not in current inventory)
      const newAssetIds = steamAssetIds.filter(assetId => !(assetId in currentInventoryItems));
  
      // Prepare new items to insert
      const newItems = [];
      const newInventoryItemIds = [];
  
      // Process each inventory item from Steam
      inventory.items.forEach(item => {
        // Extract the numeric part from the price string
        const priceString = item.price;
        const priceMatch = priceString.match(/\d+(\.\d+)?/);
        const price = priceMatch ? parseFloat(priceMatch[0]) : 0;
  
        // For each assetId, check if it is new
        item.assetIds.forEach(assetId => {
          if (newAssetIds.includes(assetId)) {
            // Prepare new item
            const newItem = new Item({
              name: item.market_hash_name,
              iconUrl: item.icon_url,
              price: `${price} USD`, // Save the numeric value
              owner: user._id,
              assetId,
              appId,
              contextId
            });
            newItems.push(newItem);
          }
        });
      });
  
      // Insert new items into the Item collection and update user's inventory
      if (newItems.length > 0) {
        const insertedItems = await Item.insertMany(newItems);
        const insertedItemIds = insertedItems.map(item => item._id);
  
        // Add new items to the user's inventory
        user.inventory.push(...insertedItemIds);
        await user.save();
      }
      console.log("user inventory2",user.inventory);
      
      // Return the updated user's inventory
      const updatedUser = await User.findOne({ steamId: steamID64 }).populate('inventory');
      res.json({ items: updatedUser.inventory });
  
    } catch (error) {
      console.error("Error in /api/inventory:", error);
      res.status(500).json({ error: error.message });
    }
  });
  


// Protected inventory route
// router.get('/inventory', isAuth, async (req, res) => {
//   console.log(req.user.id);
//   try {
//     const steamID64 = req.user.id;
//     const appId = 252490;
//     const contextId = 2;

//     if (!steamID64) {
//       return res.status(400).json({ error: 'Missing SteamID64 parameter.' });
//     }

//     // Fetch the inventory
//     const inventory = await getInventory(appId, steamID64, contextId);
//     if (!inventory || !inventory.items || inventory.items.length === 0) {
//       return res.status(404).json({ error: 'No inventory found.' });
//     }

//     // Find the user in the database
//     const user = await User.findOne({ steamId: steamID64 });
//     if (!user) {
//       return res.status(404).json({ error: 'User not found.' });
//     }

//     // Gather all assetIds to check for existing items in one query
//     const allAssetIds = inventory.items.flatMap(item => item.assetIds);

//     // Fetch all existing items in one query
//     const existingItems = await Item.find({
//       owner: user._id,
//       appId,
//       contextId,
//       assetId: { $in: allAssetIds }
//     });

//     // Create a Set of assetIds that already exist
//     const existingAssetIds = new Set(existingItems.map(item => item.assetId));

//     // Prepare an array for new items to insert
//     const newItems = [];
//     const newInventoryItemIds = [];

//     // Process each inventory item
//     inventory.items.forEach(item => {
//       // Extract the numeric part from the price string
//       const priceString = item.price;
//       const priceMatch = priceString.match(/\d+(\.\d+)?/);
//       const price = priceMatch ? parseFloat(priceMatch[0]) : 0;

//       // For each assetId, check if it already exists in the database
//       item.assetIds.forEach(assetId => {
//         if (!existingAssetIds.has(assetId)) {
//           // If the item doesn't exist, prepare it for insertion
//           const newItem = {
//             name: item.market_hash_name,
//             iconUrl: item.icon_url,
//             price: `${price} USD`,  // Save the numeric value
//             owner: user._id,
//             assetId,
//             appId,
//             contextId
//           };

//           newItems.push(newItem);
//         }
//       });
//     });

//     // Bulk insert new items if there are any
//     if (newItems.length > 0) {
//       const insertedItems = await Item.insertMany(newItems);
//       newInventoryItemIds.push(...insertedItems.map(item => item._id));
//     }

//     // Add new items to the user's inventory and save user in one operation
//     if (newInventoryItemIds.length > 0) {
//       user.inventory.push(...newInventoryItemIds);
//       await user.save();
//     }

//     // Return the updated user's inventory
//     const userInventory = await User.findOne({ steamId: steamID64 }).populate('inventory');
//     res.json({ items: userInventory.inventory });

//   } catch (error) {
//     console.error("Error in /api/inventory:", error);
//     res.status(500).json({ error: error.message });
//   }
// });



module.exports = router;
