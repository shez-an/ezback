// src/middleware/isAuth.js
const jwt = require('jsonwebtoken');
// const User = require('../models/userSchema')

const isAuth = async (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  // console.log(token);
  console.log("rea");
  
  if (!token) return res.status(401).json({ message: 'No token provided' });

  jwt.verify(token, "somececret", (err, decoded) => {
    if (err) {
      console.log("rea2");
      return res.status(403).json({ message: 'Failed to authenticate token' });
    }
    
    // Check if the client IP matches the one in the token
    const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    if (decoded.ip !== clientIp) {
      return res.status(403).json({ message: 'Token IP mismatch' });
    }

    // If everything is fine, store the decoded information for further use
    req.user = decoded; // Attach user info to the request object
    // console.log(req.user);
    
    next(); // Call the next middleware/route handler
  });
};

module.exports = isAuth;


// const jwt = require('jsonwebtoken');
// const User = require('../models/userSchema');

// const isAuth = async (req, res, next) => {
//   try {
//     // Retrieve the JWT token from the secure cookie
//     const token = req.cookies.FBI;

//     if (!token) {
//       return res.status(401).json({ message: 'Unauthorized: No token found in cookies' });
//     }

//     // Verify and decode the JWT to get the user data
//     jwt.verify(token, "somesecret", async (err, decoded) => {
//       if (err) {
//         return res.status(401).json({ message: 'Unauthorized: Invalid token' });
//       }

//       const steamID64 = decoded.steamID64; // Extract steamID64 from decoded token

//       // Find the user in the database using the steamID64
//       const existingUser = await User.findOne({ steamId: steamID64 });

//       if (!existingUser) {
//         return res.status(401).json({ message: 'Unauthorized: User not found' });
//       }

//       // Get the user's current IP and user-agent
//       const currentIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
//       const currentUserAgent = req.headers['user-agent'];

//       // Check if the stored IP and user-agent match the current ones
//       const { ip: storedIp, userAgent: storedUserAgent } = existingUser.lastLogin;

//       if (currentIp !== storedIp || currentUserAgent !== storedUserAgent) {
//         return res.status(401).json({ message: 'Unauthorized: IP or User-Agent mismatch' });
//       }

//       // Attach the decoded token (user info) to the request object
//       req.user = decoded;
      
//       // Proceed to the next middleware or route handler
//       next();
//     });

//   } catch (error) {
//     console.error('Authentication error:', error);
//     return res.status(500).json({ message: 'Internal Server Error' });
//   }
// };

// module.exports = isAuth;

