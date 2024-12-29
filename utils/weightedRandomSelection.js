// utils/weightedRandomSelection.js

/**
 * Selects a participant based on weighted random selection.
 * @param {Array} participantsWithValue - Array of participants with their total contributions.
 * @param {number} overallTotal - The sum of all participants' contributions.
 * @returns {Object|null} - The selected participant or null if selection fails.
 */
function weightedRandomSelection(participantsWithValue, overallTotal) {
    const random = Math.random() * overallTotal;
    let cumulative = 0;
  
    for (const { participant, totalContribution } of participantsWithValue) {
      cumulative += totalContribution;
      if (random < cumulative) {
        return { participant, totalContribution };
      }
    }
  
    // Fallback in case of rounding errors
    return participantsWithValue.length > 0 ? participantsWithValue[participantsWithValue.length - 1] : null;
  }
  
  module.exports = weightedRandomSelection;
  