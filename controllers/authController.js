// controllers/authController.js
const passport = require('passport');
const generateToken = require('../utils/genertaetoken');

// Steam login route
// const steamLogin = passport.authenticate('steam');

// Steam login return route
const steamReturn = (req, res) => {
  // Generate a temporary authorization code
  const authCode = Math.random().toString(36).substring(7);
  
  // Store auth code in memory temporarily (you can use Redis or a proper session store in production)
  global.authCodes = global.authCodes || {};
  global.authCodes[authCode] = req.user;

  // Redirect to the frontend with the auth code
  res.redirect(`${process.env.FRONTEND_URL}/auth-callback?code=${authCode}`);
};

// Exchange authorization code for JWT
const exchangeCodeForJwt = (req, res) => {
  const { code } = req.body;

  if (global.authCodes && global.authCodes[code]) {
    const user = global.authCodes[code];

    // Get client IP address
    const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    // Generate JWT with user data and client IP
    const token = generateToken(user, clientIp);

    // Clear the auth code
    delete global.authCodes[code];

    res.json({ token });
  } else {
    res.status(400).json({ message: 'Invalid or expired authorization code' });
  }
};

module.exports = {
  // steamLogin,
  steamReturn,
  exchangeCodeForJwt,
};
