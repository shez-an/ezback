
// jackpotManager.js
require('dotenv').config(); // Ensure this is at the top
const Jackpot = require('./models/jackpotSchema');
const io = require('./socket');
const weightedRandomSelection = require('./utils/weightedRandomSelection');
const { manager } = require('./steamTradeBot'); // Import Steam trade bot manager
const User = require('./models/userSchema');

/**
 * Timer settings
 */
let roundDuration = 120; // in seconds (adjust as needed)
let roundStartTime = null;
let timerInterval = null;

/**
 * Spin settings
 */
const spinDuration = 5000; // Spin duration in milliseconds (e.g., 5 seconds)
const spinStartDelay = 1000; // Delay before spin starts in milliseconds (e.g., 1 second)

/**
 * Time between rounds
 */
const timeBetweenRounds = 10000; // 10 seconds in milliseconds

/**
 * Calculates the time left in the current round.
 * @returns {number} Time left in seconds.
 */
function getTimeLeft() {
  if (!roundStartTime) return roundDuration;
  const elapsed = Math.floor((Date.now() - roundStartTime) / 1000);
  return Math.max(roundDuration - elapsed, 0);
}

/**
 * Starts the round timer.
 */
function startRoundTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
  }

  roundStartTime = Date.now();

  io.getIO().emit('timer', { timeLeft: roundDuration });

  timerInterval = setInterval(async () => {
    const timeLeft = getTimeLeft();
    io.getIO().emit('timer', { timeLeft });

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      roundStartTime = null;
      timerInterval = null;
      // End the round
      await endRound();
    }
  }, 1000);
}

/**
 * Send trade offer with Promises
 */
const sendTradeOffer = (offer) => {
  return new Promise((resolve, reject) => {
    offer.send((err, status) => {
      if (err) {
        console.error('Trade offer failed:', err);
        return reject(new Error('Failed to send trade offer.'));
      }

      if (status === 'pending') {
        console.log('Trade offer sent, awaiting mobile confirmation.');
      } else {
        console.log('Trade offer sent successfully.');
      }

      resolve(status);
    });
  });
};

/**
 * Transfer items to the winner by matching item names.
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const transferWinnings = async (winner, winnerItems) => {
  try {
    // Validate Winner's Trade URL
    if (!winner.tradeUrl) {
      throw new Error('Winner does not have a valid trade offer URL.');
    }
    console.log('Winner Items:', winnerItems);
    console.log('.......................................');

    // Fetch the bot's inventory contents
    manager.getUserInventoryContents(
      manager.steamID,
      '252490',
      '2',
      false,
      async (err, inventory) => {
        if (err) {
          console.error('Error fetching inventory:', err);
          return;
        }

        try {
          // Log the fetched inventory for debugging
          console.log('Inventory fetched:', inventory);

          if (!inventory || inventory.length === 0) {
            throw new Error("No items found in the bot's inventory.");
          }

          // Build a mapping of winner items by name and their counts
          const winnerItemCounts = {};
          winnerItems.forEach((item) => {
            winnerItemCounts[item.name] =
              (winnerItemCounts[item.name] || 0) + 1;
          });

          // Collect items from bot's inventory to send to the winner
          const winnerInventoryItems = [];
          const inventoryItemCounts = {};

          // Iterate over the bot's inventory to match items by name
          for (const item of inventory) {
            const itemName = item.name;
            if (
              winnerItemCounts[itemName] && // The item is needed by the winner
              (inventoryItemCounts[itemName] || 0) <
                winnerItemCounts[itemName] // We haven't collected enough of this item yet
            ) {
              // Add the item to the winner's inventory items
              winnerInventoryItems.push(item);
              inventoryItemCounts[itemName] =
                (inventoryItemCounts[itemName] || 0) + 1;
            }
          }

          // Check if all required items have been collected
          let allItemsCollected = true;
          for (const itemName in winnerItemCounts) {
            if (
              (inventoryItemCounts[itemName] || 0) <
              winnerItemCounts[itemName]
            ) {
              allItemsCollected = false;
              console.error(
                `Not enough items of "${itemName}" in bot's inventory. Needed: ${winnerItemCounts[itemName]}, Found: ${
                  inventoryItemCounts[itemName] || 0
                }`
              );
            }
          }

          if (!allItemsCollected) {
            throw new Error(
              "Not all winner items could be matched in the bot's inventory."
            );
          }

          // Create Trade Offer for Winner
          const winnerOffer = manager.createOffer(winner.tradeUrl);
          winnerInventoryItems.forEach((item) => {
            // Log item details
            console.log(
              `Processing item for Winner: ${item.name} (ID: ${item.assetid})`
            );

            // Ensure all required properties are present and item is tradable
            if (item.tradable && item.assetid && item.appid && item.contextid) {
              winnerOffer.addMyItem({
                assetid: item.assetid,
                appid: item.appid,
                contextid: item.contextid,
              });
            } else {
              console.error(
                `Skipping item (Not tradable or missing parameters): ${JSON.stringify(
                  item
                )}`
              );
            }
          });
          winnerOffer.setMessage('Congratulations! You have won the jackpot!');

          // Send Trade Offer to Winner
          console.log('Sending trade offer to Winner...');
          await sendTradeOffer(winnerOffer);
          console.log(
            `Trade offer sent to winner (${winner._id}) successfully.`
          );

          console.log(
            `All trade offers sent successfully to Winner (${winner._id}).`
          );
        } catch (innerError) {
          console.error(
            'Error processing inventory and sending trade offers:',
            innerError
          );
        }
      }
    );
  } catch (error) {
    console.error('Error transferring winnings:', error);
  }
};

async function endRound() {
  try {
    // Retrieve the current jackpot in progress
    let jackpot = await Jackpot.findOne({ status: 'in_progress' })
      .populate('participants.user')
      .populate('participants.items');

    if (!jackpot) {
      console.log('No active jackpot to end.');
      return;
    }

    // Calculate each participant's total contribution
    const participantsWithValue = jackpot.participants.map((participant) => {
      const totalContribution = participant.items.reduce((acc, item) => {
        const itemValue = parseFloat(item.price);
        return acc + (isNaN(itemValue) ? 0 : itemValue);
      }, 0);
      return {
        participant,
        totalContribution,
      };
    });

    // Calculate the overall total value
    const overallTotal = participantsWithValue.reduce(
      (acc, p) => acc + p.totalContribution,
      0
    );

    if (overallTotal === 0) {
      console.log('No valid contributions to determine a winner.');
      jackpot.status = 'completed';
      await jackpot.save();
      return;
    }

    // Select the winner based on weighted random selection
    const winnerParticipant = weightedRandomSelection(
      participantsWithValue,
      overallTotal
    );

    if (!winnerParticipant) {
      console.log('Failed to select a winner.');
      jackpot.status = 'completed';
      await jackpot.save();
      return;
    }

    // ** Corrected Section Starts Here **

    // Collect all items from all participants
    let allItems = [];
    jackpot.participants.forEach((participant) => {
      allItems = allItems.concat(participant.items);
    });

    // Distribute items between winner (90%) and bot (10%)
    const totalItems = allItems;
    const itemSplitIndex = Math.floor(totalItems.length * 0.9); // Winner gets 90%
    const winnerItems = totalItems.slice(0, itemSplitIndex);

    // ** Corrected Section Ends Here **

    // Transfer winnings to winner by matching items
    await transferWinnings(winnerParticipant.participant.user, winnerItems);

    // Update the jackpot with the winner
    jackpot.status = 'completed';
    jackpot.winner = winnerParticipant.participant.user._id;
    await jackpot.save();

    // Update all participants' statistics and game history
    for (const p of participantsWithValue) {
      const user = await User.findById(p.participant.user._id);
      if (!user) {
        console.error(`User with ID ${p.participant.user._id} not found.`);
        continue;
      }

      let deposited = user.deposited + p.totalContribution;
      let totalWon = user.totalWon;
      let profit = user.profit;

      let isWinner = false;
      let gameTotalWon = 0;
      let winningTrade = '';

      if (
        p.participant.user._id.toString() ===
        winnerParticipant.participant.user._id.toString()
      ) {
        totalWon += jackpot.totalValue;
        profit = totalWon - deposited;
        isWinner = true;
        gameTotalWon = jackpot.totalValue;

        // Add game history entry for the winner
        const gameHistoryEntryWinner = {
          jackpotId: jackpot._id,
          deposited: p.totalContribution,
          totalWon: jackpot.totalValue,
          profit: profit,
          chance: `${((p.totalContribution / overallTotal) * 100).toFixed(
            2
          )}%`,
          gamemode: 'Classic', // Adjust as needed or fetch from jackpot details
          winningTrade: 'Trade ID 123456', // Replace with actual trade ID or URL
          isWinner: true,
          timestamp: new Date(),
        };
        user.gameHistory.push(gameHistoryEntryWinner);
      } else {
        // For non-winners
        profit = profit - p.totalContribution; // Assuming they lose their contribution
        totalWon += 0; // No winnings

        // Add game history entry for the participant
        const gameHistoryEntryParticipant = {
          jackpotId: jackpot._id,
          deposited: p.totalContribution,
          totalWon: 0,
          profit: -p.totalContribution,
          chance: `${((p.totalContribution / overallTotal) * 100).toFixed(
            2
          )}%`,
          gamemode: 'Classic', // Adjust as needed or fetch from jackpot details
          winningTrade: '', // No trade for non-winners
          isWinner: false,
          timestamp: new Date(),
        };
        user.gameHistory.push(gameHistoryEntryParticipant);
      }

      user.deposited = deposited;
      user.totalWon = totalWon;
      user.profit = profit;

      await user.save();
    }

    // Emit the 'spin' event to synchronize the wheel spin across all clients
    io.getIO().emit('spin', {
      winnerId: {
        id: winnerParticipant.participant.user._id,
        username: winnerParticipant.participant.user.username,
        items: winnerItems,
        totalValue: winnerParticipant.totalContribution,
        skinCount: winnerItems.length,
        img:
          winnerParticipant.participant.user.avatar.small ||
          '/default-avatar.png',
        color: winnerParticipant.participant.color,
      },
      startTime: Date.now() + spinStartDelay, // Scheduled start time
      duration: spinDuration, // Spin duration in milliseconds
    });
    io.getIO().emit('newJackPot', {
      msg: 'success',
    });
    // Emit 'nextRound' event with the start time of the next round (10 seconds after spin ends)
    const nextRoundStartTime = Date.now() + spinDuration + timeBetweenRounds;
    io.getIO().emit('nextRound', { startTime: nextRoundStartTime });

    // Start a 10-second countdown for the next round and emit 'nextRoundTimer' every second
    let countdown = timeBetweenRounds / 1000; // 10 seconds
    let newJackpot;

    const countdownInterval = setInterval(async () => {
      countdown -= 1;
      if (countdown <= 0) {
        clearInterval(countdownInterval);
        io.getIO().emit('nextRoundTimer', { timeLeft: 0 });
        io.getIO().emit('newRoundStarted'); // Inform clients that a new round has started
        newJackpot = new Jackpot({
          status: 'waiting',
          totalValue: 0,
          participants: [],
        });
        await newJackpot.save();
      } else {
        io.getIO().emit('nextRoundTimer', { timeLeft: countdown });
      }
    }, 1000);
  } catch (error) {
    console.error('Error ending round:', error);
  }
}

module.exports = {
  startRoundTimer,
  getTimeLeft,
  endRound,
};
























