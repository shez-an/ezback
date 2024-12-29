// utils/calculateSpinAngle.js

/**
 * Calculates the total rotation angle for the wheel to land on the winner's segment.
 * @param {number} winnerIndex - The index of the winner in the participants array.
 * @param {number} totalSegments - Total number of segments on the wheel.
 * @param {number} rotations - Number of full rotations before landing.
 * @returns {number} The total rotation angle in degrees.
 */
function calculateSpinAngle(winnerIndex, totalSegments, rotations = 3) {
    const segmentAngle = 360 / totalSegments;
    // Calculate the angle to land on the center of the winner's segment
    const targetAngle = (winnerIndex * segmentAngle) + (segmentAngle / 2);
    // Total rotation includes full rotations plus the target angle
    return (rotations * 360) + targetAngle;
  }
  
  module.exports = calculateSpinAngle;
  