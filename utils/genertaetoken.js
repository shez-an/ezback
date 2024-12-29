
const jwt = require('jsonwebtoken')

const generateToken = (user, ip) => {
    return jwt.sign(
      { id: user.steamId, username: user.username, ip }, // Include client IP in the payload
      "somececret",
      { expiresIn: '1h' }
    );
  };

  module.exports = {
    generateToken
}