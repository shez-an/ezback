const Jackpot = require('../models/jackpotSchema');
const Item = require('../models/itemSchema');
const User = require('../models/userSchema');
const io = require('../socket');
const jackpotManager = require('../jackpotManager');
const generateRandomColor = require('../utils/randcolor');
const { manager } = require('../steamTradeBot'); // Import trade bot manager
const SteamTradeManager = require('steam-tradeoffer-manager');

// Function to send trade offer using user's Trade URL
const sendTradeOfferToUser = async (tradeUrl, items) => {
  // console.log(manager);
  // console.log(items);
  
  // console.log(process.env.TRADE_OFFER_URL);

  const tradeOffer = manager.createOffer(tradeUrl); // Use the user's Trade URL directly
  
  
  // Add the items the bot is requesting from the user
  items.forEach(item => {
    tradeOffer.addTheirItem({
      assetid: item.assetId,
      appid: item.appId,
      contextid: '2', // Context ID (typically '2' for CS:GO)
    });
  });

  tradeOffer.setMessage('You are joining the jackpot.');
  console.log(tradeOffer);
  
  
  // Send the trade offer and return its ID and URL
  return new Promise((resolve, reject) => {
    tradeOffer.send((err, status) => {
      console.log(err)
      if (err) {
      
        
        console.error('Failed to send trade offer:', err);
        return reject(err);
      }

      console.log(`Trade offer sent to user with status: ${status}`);
      resolve({
        offerId: tradeOffer.id,
        offerUrl: `https://steamcommunity.com/tradeoffer/${tradeOffer.id}`, // Trade offer URL
      });
    });
  });
};

// Track trade offer acceptance
const trackTradeOffer = (offerId, userId, itemIds, jackpotId) => {
  manager.getOffer(offerId, async (err, offer) => {
    if (err) {
      console.error(`Failed to get offer: ${err}`);
      return;
    }

    // Poll for trade acceptance status
    const pollTradeStatus = setInterval(async () => {
      offer.update(async (err) => {
        if (err) {
          console.error(`Failed to update offer status: ${err}`);
          return;
        }

        // If the trade is accepted, update the jackpot and allow the user to join
        if (offer.state === SteamTradeManager.ETradeOfferState.Accepted) {
          clearInterval(pollTradeStatus);
          console.log(`Trade offer ${offer.id} was accepted!`);
          
          // Add user to jackpot with items
          await addUserToJackpot(userId, itemIds, jackpotId);

        } else if (offer.state === SteamTradeManager.ETradeOfferState.Declined) {
          clearInterval(pollTradeStatus);
          console.log(`Trade offer ${offer.id} was declined.`);
          // Optionally handle declined trade
        }
      });
    }, 5000); // Poll every 5 seconds
  });
};

// Function to add user to jackpot
const addUserToJackpot = async (userId, itemIds, jackpotId) => {
  try {
    console.log(userId,itemIds,jackpotId);
    
    const jackpot = await Jackpot.findById(jackpotId);

    // Fetch the user and items
    const user = await User.findById(userId);
    const items = await Item.find({ _id: { $in: itemIds } });

    // Calculate total value of items added to the jackpot
    const totalValue = items.reduce((acc, item) => {
      const itemValue = parseFloat(item.price);
      return acc + (isNaN(itemValue) ? 0 : itemValue);
    }, 0);

    // Assign random color for user in the jackpot
    const randomColor = generateRandomColor();

    // Add user to jackpot
    jackpot.participants.push({
      user: user._id,
      items: items.map(item => item._id),
      color: randomColor,
    });

    jackpot.totalValue += totalValue;


    // Update jackpot status to 'in_progress' if criteria met
    if (jackpot.status === 'waiting') {
      // Step 1: Extract all user IDs as strings from participants
      const allUserIds = jackpot.participants.map(participant => participant.user._id.toString());
      
      // Step 2: Create a Set to filter out duplicate user IDs
      const uniqueUserIds = new Set(allUserIds);
      
      // Step 3: Check if there are at least two unique participants
      if (uniqueUserIds.size >= 2) {
        // Optional: Log unique user IDs for debugging
        console.log('Unique Participants IDs:', Array.from(uniqueUserIds));
        
        // Step 4: Update jackpot status to 'in_progress'
        jackpot.status = 'in_progress';
        
        // Step 5: Start the round timer
        jackpotManager.startRoundTimer();
      }
    }
    // if (jackpot.participants.length >= 2 && jackpot.status === 'waiting') {
    //   console.log(jackpot.participants[0].user._id);
      
    //   jackpot.status = 'in_progress';

    //   // Start the round timer
    //   jackpotManager.startRoundTimer();
    // }

    // Save the jackpot
    await jackpot.save();
    // // Remove items from user's inventory
    user.inventory = user.inventory.filter(
      (itemId) => !itemIds.includes(itemId.toString())
    );
    await user.save();

    // Notify clients via Socket.io
    io.getIO().emit('participants', {
      participants: jackpot.participants,
    });

    console.log('User successfully added to jackpot.');

  } catch (error) {
    console.error('Error adding user to jackpot:', error);
  }
};

const joinJackpot = async (req, res) => {
  try {
    const { userId, itemIds } = req.body; // Accept only userId and itemIds from the request

    // Validate user and items
    if (!userId || !itemIds || itemIds.length === 0) {
      return res.status(400).json({ error: 'User ID and item IDs are required' });
    }

    // Find or create the current jackpot (waiting or in-progress)
    let jackpot = await Jackpot.findOne({ status: { $in: ['in_progress', 'waiting'] } });
    if (!jackpot) {
      jackpot =  new Jackpot({ status: 'waiting', totalValue: 0, participants: [] });
      await jackpot.save();
    }

    // Fetch the user
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Check if the user has a trade URL
    const tradeUrl = user.tradeUrl;
    if (!tradeUrl) {
      return res.json({
        msg: 'User does not have a Steam Trade URL. Please update your profile.',
        tradeUrl:false
       });
    }

    // Fetch the items
    const items = await Item.find({ _id: { $in: itemIds } });
    if (items.length === 0) return res.status(404).json({ error: 'No items found' });

    // Send trade offer to the user using their Trade URL from the user schema
    // console.log(process.env.TRADE_OFFER_URL);
    
    try {
    // console.log(manager);
      // console.log(jackpot);
      
      const tradeData = await sendTradeOfferToUser(tradeUrl,items);

      // Send trade URL to user
      // console.log(tradeData);
      // await addUserToJackpot(userId, itemIds, jackpot._id);
      res.json({
        success: true,
        message: 'Trade offer sent. Please accept the offer to join the jackpot.',
        tradeOfferUrl: tradeData.offerUrl,
      });
      trackTradeOffer(tradeData.offerId, userId, itemIds, jackpot._id);
      
      
      // Track trade offer acceptance

    } catch (err) {
      return res.status(500).json({ error: 'Failed to send trade offer to user' });
    }

  } catch (error) {
    console.error('Error joining jackpot:', error);
    res.status(500).json({ error: error.message });
  }
};


// Get Jackpot Status
const getJackpotStatus = async (req, res) => {
  try {
    // Find a jackpot that is either 'in_progress' or 'waiting'
    let jackpot = await Jackpot.findOne({ status: { $in: ['in_progress', 'waiting'] } })
      .populate({
        path: 'participants.user',
        select: '_id username email profileUrl avatar inventory', // Specify fields to include, _id is included by default
      })
      .populate('participants.items')
      .populate('winner');

    // If no jackpot is found, return a 404 error
    if (!jackpot) {
      return res.status(404).json({ error: 'No active jackpot found' });
    }

    // Respond with the jackpot data
    res.json(jackpot);
  } catch (error) {
    console.error('Error fetching jackpot status:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get Jackpot History
const getJackpotHistory = async (req, res) => {
  try {
    
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const jackpots = await Jackpot.find({
      status: 'completed',
      createdAt: { $gte: twentyFourHoursAgo }, // Filter for jackpots created in the last 24 hours
    })
      .populate({
        path: 'participants.user', // Populate the 'user' field within 'participants'
        select: 'username steamId avatar', // Select specific fields (optional)
      })
      .populate({
        path: 'participants.items', // Populate the 'items' array within 'participants'
        select: 'name price iconUrl', // Select specific fields (optional)
      })
      .populate({
        path: 'winner', // Populate the 'winner' field
        select: 'username avatar', // Select specific fields (optional)
      });
      // console.log("jack", jackpots);
    // Check if any jackpots are found
    if (!jackpots || jackpots.length === 0) {
      return res.status(404).json({ error: 'No completed jackpots found in the last 24 hours' });
    }
    
    // Respond with the filtered jackpots data
    res.status(200).json(jackpots);
  } catch (error) {
    console.error('Error fetching jackpot history:', error);
    res.status(500).json({ error: error.message });
  }
};

const getLastFourJackpots = async (req, res) => {
  try {
    const jackpots = await Jackpot.find({ status: 'completed' })
    .sort({ createdAt: -1 }) // Sort by creation date descending
    .limit(4)
    .populate({
      path: 'participants.user',
      select: 'username steamId avatar',  // Select fields you need from User
    })
    .populate({
      path: 'participants.items',
      select: 'name price iconUrl',  // Select fields you need from Item          
    }).populate({
      path: 'winner',
      select: 'username avatar',  // Select fields you need from User
    })
    res.json(jackpots);
  } catch (error) {
    console.error('Error fetching last four jackpots:', error);
    res.status(500).json({ error: error.message });
  }
};

const saveTradeUrl = async (req, res) => {
  try {
    const { tradeUrl } = req.body;
    const steamID64 = req.user.id
    
    console.log(tradeUrl,steamID64);
    
    // Validate userId and tradeUrl
    if (!steamID64 || !tradeUrl) {
      return res.status(400).json({ error: 'User ID and Trade URL are required.' });
    }

    // Find the user by ID
    const user = await User.findOne({ steamId: steamID64 });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Update the user's trade URL
    user.tradeUrl = tradeUrl;
    await user.save();

    res.status(200).json({ success: true, message: 'Trade URL updated successfully.' });
  } catch (error) {
    console.error('Error updating trade URL:', error);
    res.status(500).json({ error: 'Failed to update trade URL.' });
  }
};


const getUserStatistics = async (req, res) => {
  try {
    const userId = req.user.id; // Ensure this is the correct identifier (steamId or _id)

    // Fetch the user with populated game history
    const user = await User.findOne({ steamId: userId }).populate({
      path: 'gameHistory.jackpotId',
      select: 'createdAt', // Select fields you need from Jackpot
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (!Array.isArray(user.gameHistory)) {
      console.error('User gameHistory is not an array:', user.gameHistory);
      return res.status(500).json({ error: 'User game history is invalid.' });
    }

    // Prepare the response data
    const stats = {
      deposited: user.deposited,
      totalWon: user.totalWon,
      profit: user.profit,
      recentWinnings: user.gameHistory
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) // Sort by latest first
        .slice(0, 5) // Get the last 5 entries
        .map(entry => ({
          winner: entry.isWinner ? user.username : "N/A", // Show username if winner, else "N/A" or another indicator
          amount: `$${entry.totalWon.toFixed(2)}`,
          chance: entry.chance,
          gamemode: entry.gamemode,
          winningTrade: entry.isWinner ? entry.winningTrade : "N/A", // Show trade ID/URL if winner
        })),
    };

    res.status(200).json(stats);
  } catch (error) {
    console.error('Error fetching user statistics:', error);
    res.status(500).json({ error: error.message });
  }
};





module.exports = {
  joinJackpot,
  getJackpotStatus,
  getJackpotHistory,
  saveTradeUrl,
  getUserStatistics,
  getLastFourJackpots
};


