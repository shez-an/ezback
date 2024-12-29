// utils/colorGenerator.js

/**
 * Generates a random HEX color string.
 * @returns {string} A HEX color string (e.g., '#A1B2C3').
 */
const generateRandomColor = () => {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  };
  
  module.exports = generateRandomColor;
  