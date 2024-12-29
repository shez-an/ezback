const SteamUser = require('steam-user');
const SteamCommunity = require('steamcommunity');
const SteamTradeManager = require('steam-tradeoffer-manager');
const SteamTotp = require('steam-totp');
const winston = require('winston');

// Configure Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'bot.log' })
  ],
});

const client = new SteamUser();
const community = new SteamCommunity();
const manager = new SteamTradeManager({
  steam: client,
  community: community,
  language: 'en',
  useAccessToken: true
});

// Steam bot credentials from environment variables
const config = {
  accountName: process.env.STEAM_ACCOUNT_NAME,
  password: process.env.STEAM_PASSWORD,
  sharedSecret: process.env.STEAM_SHARED_SECRET,
  identitySecret: process.env.STEAM_IDENTITY_SECRET
};

// Avoid logging sensitive information
logger.info('Config: Account Name is set.');

// Validate Steam credentials
if (!config.accountName || !config.password || !config.sharedSecret || !config.identitySecret) {
  logger.error('Steam credentials are not fully set in environment variables.');
  process.exit(1);
}

let loginAttempts = 0;
let reconnectAttempts = 0;
const MAX_LOGIN_ATTEMPTS = 10;
const MAX_RECONNECT_ATTEMPTS = 5;

// Critical errors that require re-login
const criticalErrors = [
  SteamUser.EResult.NotLoggedOn,
  SteamUser.EResult.NoConnection,
  SteamUser.EResult.InvalidPassword,
  // SteamUser.EResult.LoggedInElsewhere,
  SteamUser.EResult.Timeout,
  SteamUser.EResult.ConnectFailed,
  SteamUser.EResult.HandshakeFailed,
  SteamUser.EResult.RemoteDisconnect,
  SteamUser.EResult.AccountNotFound,
  SteamUser.EResult.ServiceUnavailable,
  SteamUser.EResult.RateLimitExceeded,
  SteamUser.EResult.InvalidLoginAuthCode,
  SteamUser.EResult.AccountLocked,
  SteamUser.EResult.InvalidItemType
];

// Function to log in to Steam
function loginToSteam() {
  if (loginAttempts >= MAX_LOGIN_ATTEMPTS) {
    logger.error('Max login attempts reached. Exiting...');
    process.exit(1);
  }

  logger.info(`Attempting to log in to Steam (Attempt ${loginAttempts + 1})...`);
  client.logOn({
    accountName: config.accountName,
    password: config.password,
    twoFactorCode: SteamTotp.generateAuthCode(config.sharedSecret)
  });

  loginAttempts += 1;
}

// Retry with exponential backoff
function handleReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    logger.error('Max reconnect attempts reached. Stopping...');
    process.exit(1); // Exit after max attempts reached
  }

  const delay = Math.pow(2, reconnectAttempts) * 1000; // Exponential backoff: 1s, 2s, 4s, 8s...
  logger.info(`Attempting to reconnect in ${delay / 1000} seconds...`);

  reconnectAttempts++;
  setTimeout(loginToSteam, delay); // Retry login with exponential backoff
}

// Log in to Steam initially
loginToSteam();

// Steam client event handlers
client.on('loggedOn', () => {
  loginAttempts = 0; // Reset on successful login
  client.setPersona(SteamUser.EPersonaState.Online);
  client.gamesPlayed([252490]); // Example game ID
  logger.info('Steam client logged in and online');
});

client.on('error', (err) => {
  logger.error(`Steam client encountered an error: ${err}`);

  // Check if the error is a critical error and requires a re-login
  if (criticalErrors.includes(err.eresult)) {
    logger.info('Critical error encountered. Attempting to reconnect...');
    handleReconnect();
  }
});

// client.on('disconnected', (eresult, msg) => {
//   logger.warn(`Disconnected from Steam (${eresult}): ${msg}. Attempting to relog.`);
//   handleReconnect(); // Attempt re-login after exponential backoff
// });

// client.on('loggedOff', (eresult) => {
//   logger.warn(`Logged off from Steam (${eresult}). Attempting to relog.`);
//   handleReconnect(); // Attempt re-login after exponential backoff
// });

client.on('webSession', (sessionId, cookies) => {
  logger.info('Web session established.');
  manager.setCookies(cookies);
  community.setCookies(cookies);
  community.startConfirmationChecker(20000, config.identitySecret);
});

// Heartbeat to monitor connection status
const HEARTBEAT_INTERVAL = 60000; // 60 seconds

setInterval(() => {
  if (!client.steamID || client.steamID.getSteamID64() === '0') {
    logger.warn('Bot is not logged in. Attempting to reconnect...');
    handleReconnect();
  } else {
    logger.info('Heartbeat: Bot is online.');
  }
}, HEARTBEAT_INTERVAL);

// Optional: Graceful shutdown handling
process.on('SIGINT', () => {
  logger.info('Received SIGINT. Shutting down gracefully...');
  client.logOff();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM. Shutting down gracefully...');
  client.logOff();
  process.exit(0);
});

module.exports = { manager };


















// const SteamUser = require('steam-user');
// const SteamCommunity = require('steamcommunity');
// const SteamTradeManager = require('steam-tradeoffer-manager');
// const SteamTotp = require('steam-totp');
// const fs = require('fs');
// const winston = require('winston');

// // Configure Winston logger
// const logger = winston.createLogger({
//   level: 'info',
//   format: winston.format.combine(
//     winston.format.timestamp(),
//     winston.format.printf(({ timestamp, level, message }) => {
//       return `${timestamp} [${level.toUpperCase()}]: ${message}`;
//     })
//   ),
//   transports: [
//     new winston.transports.Console(),
//     new winston.transports.File({ filename: 'bot.log' })
//   ],
// });

// const client = new SteamUser();
// const community = new SteamCommunity();
// const manager = new SteamTradeManager({
//   steam: client,
//   community: community,
//   language: 'en',
//   useAccessToken: true
// });

// // Steam bot credentials from environment variables
// const config = {
//   accountName: process.env.STEAM_ACCOUNT_NAME,
//   password: process.env.STEAM_PASSWORD,
//   sharedSecret: process.env.STEAM_SHARED_SECRET,
//   identitySecret: process.env.STEAM_IDENTITY_SECRET
// };

// // Avoid logging sensitive information
// logger.info('Config: Account Name is set.');

// // Validate Steam credentials
// if (!config.accountName || !config.password || !config.sharedSecret || !config.identitySecret) {
//   logger.error('Steam credentials are not fully set in environment variables.');
//   process.exit(1);
// }

// // Handle uncaught exceptions and unhandled rejections
// process.on('uncaughtException', (err) => {
//   logger.error(`Uncaught Exception: ${err}`);
//   // Optionally, restart or perform other actions
// });

// process.on('unhandledRejection', (reason, promise) => {
//   logger.error(`Unhandled Rejection at: ${promise} reason: ${reason}`);
//   // Optionally, restart or perform other actions
// });

// let loginAttempts = 0;
// const MAX_LOGIN_ATTEMPTS = 10;

// // Function to log in to Steam
// function loginToSteam() {
//   if (loginAttempts >= MAX_LOGIN_ATTEMPTS) {
//     logger.error('Max login attempts reached. Exiting...');
//     process.exit(1);
//   }

//   logger.info(`Attempting to log in to Steam (Attempt ${loginAttempts + 1})...`);
//   client.logOn({
//     accountName: config.accountName,
//     password: config.password,
//     twoFactorCode: SteamTotp.generateAuthCode(config.sharedSecret)
//   });

//   loginAttempts += 1;
// }

// // Log in to Steam initially
// loginToSteam();

// // Steam client event handlers
// client.on('loggedOn', () => {
//   loginAttempts = 0; // Reset on successful login
//   client.setPersona(SteamUser.EPersonaState.Online);
//   client.gamesPlayed([252490]); // Example game ID
//   logger.info('Steam client logged in and online');
// });

// client.on('error', (err) => {
//   logger.error(`Steam client encountered an error: ${err}`);
//   if ([SteamUser.EResult.NotLoggedOn, SteamUser.EResult.NoConnection].includes(err.eresult)) {
//     logger.info('Attempting to reconnect in 5 seconds...');
//     setTimeout(loginToSteam, 2000); // Try re-logging in after 5 seconds
//   } else {
//     // Handle other errors or decide to exit
//     // process.exit(1); // Uncomment if you want to terminate on certain errors
//   }
// });

// client.on('disconnected', (eresult, msg) => {
//   logger.warn(`Disconnected from Steam (${eresult}): ${msg}. Attempting to relog.`);
//   setTimeout(loginToSteam, 5000); // Attempt re-login after 5 seconds
// });

// client.on('loggedOff', (eresult) => {
//   logger.warn(`Logged off from Steam (${eresult}). Attempting to relog.`);
//   setTimeout(loginToSteam, 5000); // Attempt re-login after 5 seconds
// });

// client.on('webSession', (sessionId, cookies) => {
//   logger.info('Web session established.');
//   manager.setCookies(cookies);
//   community.setCookies(cookies);
//   community.startConfirmationChecker(20000, config.identitySecret);
// });

// // Heartbeat to monitor connection status
// const HEARTBEAT_INTERVAL = 60000; // 60 seconds

// setInterval(() => {
//   if (!client.steamID || client.steamID.getSteamID64() === '0') {
//     logger.warn('Bot is not logged in. Attempting to reconnect...');
//     loginToSteam();
//   } else {
//     logger.info('Heartbeat: Bot is online.');
//   }
// }, HEARTBEAT_INTERVAL);

// // Optional: Graceful shutdown handling
// process.on('SIGINT', () => {
//   logger.info('Received SIGINT. Shutting down gracefully...');
//   client.logOff();
//   process.exit(0);
// });

// process.on('SIGTERM', () => {
//   logger.info('Received SIGTERM. Shutting down gracefully...');
//   client.logOff();
//   process.exit(0);
// });

// module.exports = { manager };

















// const SteamUser = require('steam-user');
// const SteamCommunity = require('steamcommunity');
// const SteamTradeManager = require('steam-tradeoffer-manager');
// const SteamTotp = require('steam-totp');
// const fs = require('fs');
// const winston = require('winston');

// // Configure Winston logger
// const logger = winston.createLogger({
//   level: 'info',
//   format: winston.format.combine(
//     winston.format.timestamp(),
//     winston.format.printf(({ timestamp, level, message }) => {
//       return `${timestamp} [${level.toUpperCase()}]: ${message}`;
//     })
//   ),
//   transports: [
//     new winston.transports.Console(),
//     new winston.transports.File({ filename: 'bot.log' })
//   ],
// });

// const client = new SteamUser();
// const community = new SteamCommunity();
// const manager = new SteamTradeManager({
//   steam: client,
//   community: community,
//   language: 'en',
//   useAccessToken: true
// });

// // Steam bot credentials from environment variables
// const config = {
//   accountName: process.env.STEAM_ACCOUNT_NAME,
//   password: process.env.STEAM_PASSWORD,
//   sharedSecret: process.env.STEAM_SHARED_SECRET,
//   identitySecret: process.env.STEAM_IDENTITY_SECRET
// };

// logger.info(`Config: ${JSON.stringify(config)}`);

// // Validate Steam credentials
// if (!config.accountName || !config.password || !config.sharedSecret || !config.identitySecret) {
//   logger.error('Steam credentials are not fully set in environment variables.');
//   process.exit(1);
// }

// // Handle uncaught exceptions and unhandled rejections
// process.on('uncaughtException', (err) => {
//   logger.error(`Uncaught Exception: ${err}`);
//   // Optionally, restart or perform other actions
// });

// process.on('unhandledRejection', (reason, promise) => {
//   logger.error(`Unhandled Rejection at: ${promise} reason: ${reason}`);
//   // Optionally, restart or perform other actions
// });

// let loginAttempts = 0;
// const MAX_LOGIN_ATTEMPTS = 10;

// // Function to log in to Steam
// function loginToSteam() {
//   if (loginAttempts >= MAX_LOGIN_ATTEMPTS) {
//     logger.error('Max login attempts reached. Exiting...');
//     process.exit(1);
//   }

//   logger.info(`Attempting to log in to Steam (Attempt ${loginAttempts + 1})...`);
//   client.logOn({
//     accountName: config.accountName,
//     password: config.password,
//     twoFactorCode: SteamTotp.generateAuthCode(config.sharedSecret)
//   });

//   loginAttempts += 1;
// }

// // Log in to Steam initially
// loginToSteam();

// // Steam client event handlers
// client.on('loggedOn', () => {
//   loginAttempts = 0; // Reset on successful login
//   client.setPersona(SteamUser.EPersonaState.Online);
//   client.gamesPlayed([252490]); // Example game ID
//   logger.info('Steam client logged in and online');
// });

// client.on('error', (err) => {
//   logger.error(`Steam client encountered an error: ${err}`);
//   if ([SteamUser.EResult.LoggedOff, SteamUser.EResult.NoConnection].includes(err.eresult)) {
//     logger.info('Attempting to reconnect in 5 seconds...');
//     setTimeout(loginToSteam, 5000); // Try re-logging in after 5 seconds
//   } else {
//     // Handle other errors or decide to exit
//     // process.exit(1); // Uncomment if you want to terminate on certain errors
//   }
// });

// client.on('disconnected', (eresult, msg) => {
//   logger.warn(`Disconnected from Steam (${eresult}): ${msg}. Attempting to relog.`);
//   setTimeout(loginToSteam, 5000); // Attempt re-login after 5 seconds
// });

// client.on('loggedOff', (eresult) => {
//   logger.warn(`Logged off from Steam (${eresult}). Attempting to relog.`);
//   setTimeout(loginToSteam, 5000); // Attempt re-login after 5 seconds
// });

// client.on('webSession', (sessionId, cookies) => {
//   logger.info('Web session established.');
//   manager.setCookies(cookies);
//   community.setCookies(cookies);
//   community.startConfirmationChecker(20000, config.identitySecret);
// });

// // Heartbeat to monitor connection status
// const HEARTBEAT_INTERVAL = 60000; // 60 seconds

// setInterval(() => {
//   if (!client.steamID || client.steamID.getSteamID64() === '0') {
//     logger.warn('Bot is not logged in. Attempting to reconnect...');
//     loginToSteam();
//   } else {
//     logger.info('Heartbeat: Bot is online.');
//   }
// }, HEARTBEAT_INTERVAL);

// module.exports = { manager };











//server not crash but logged out

// const SteamUser = require('steam-user');
// const SteamCommunity = require('steamcommunity');
// const SteamTradeManager = require('steam-tradeoffer-manager');
// const SteamTotp = require('steam-totp');
// const fs = require('fs');

// const client = new SteamUser();
// const community = new SteamCommunity();
// const manager = new SteamTradeManager({
//   steam: client,
//   community: community,
//   language: 'en',
//   useAccessToken: true,
// });

// // Steam bot credentials from environment variables
// const config = {
//   accountName: process.env.STEAM_ACCOUNT_NAME,
//   password: process.env.STEAM_PASSWORD,
//   sharedSecret: process.env.STEAM_SHARED_SECRET,
//   identitySecret: process.env.STEAM_IDENTITY_SECRET,
// };

// // Validate Steam credentials
// if (!config.accountName || !config.password || !config.sharedSecret || !config.identitySecret) {
//   console.error('Steam credentials are not fully set in environment variables.');
//   process.exit(1);
// }

// let isLoggedIn = false; // Track the bot's login state
// let retryDelay = 5000; // Initial retry delay for login

// // Function to log in to Steam
// function loginToSteam() {
//   if (isLoggedIn) return; // Prevent duplicate login attempts
//   console.log(`[${new Date().toISOString()}] Attempting to log in to Steam...`);
//   try {
//     client.logOn({
//       accountName: config.accountName,
//       password: config.password,
//       twoFactorCode: SteamTotp.generateAuthCode(config.sharedSecret),
//     });
//   } catch (err) {
//     console.error(`[${new Date().toISOString()}] Login failed:`, err);
//     retryDelay = Math.min(retryDelay * 2, 60000); // Exponential backoff capped at 60 seconds
//     setTimeout(loginToSteam, retryDelay);
//   }
// }

// // Log in to Steam initially
// loginToSteam();

// // Event: Successfully logged in
// client.on('loggedOn', () => {
//   isLoggedIn = true;
//   retryDelay = 5000; // Reset retry delay on successful login
//   console.log(`[${new Date().toISOString()}] Successfully logged in to Steam.`);
//   client.setPersona(SteamUser.EPersonaState.Online);
//   client.gamesPlayed([252490]); // Example game ID
// });

// // Event: Error handling
// client.on('error', (err) => {
//   isLoggedIn = false;
//   console.error(`[${new Date().toISOString()}] Steam client encountered an error:`, err);

//   if (err.eresult === SteamUser.EResult.LoggedOff || err.eresult === SteamUser.EResult.NoConnection) {
//     retryDelay = Math.min(retryDelay * 2, 60000); // Increment retry delay
//     console.log(`[${new Date().toISOString()}] Attempting to re-login in ${retryDelay / 1000} seconds...`);
//     setTimeout(loginToSteam, retryDelay);
//   }
// });

// // Event: Disconnected
// client.on('disconnected', (eresult, msg) => {
//   isLoggedIn = false;
//   console.warn(`[${new Date().toISOString()}] Disconnected from Steam (${eresult}): ${msg}`);
//   retryDelay = Math.min(retryDelay * 2, 60000); // Increment retry delay
//   console.log(`[${new Date().toISOString()}] Attempting to re-login in ${retryDelay / 1000} seconds...`);
//   setTimeout(loginToSteam, retryDelay);
// });

// // Event: Web session established
// client.on('webSession', (sessionId, cookies) => {
//   console.log(`[${new Date().toISOString()}] Web session established.`);
//   isLoggedIn = true; // Ensure the bot remains logged in
//   try {
//     manager.setCookies(cookies);
//     community.setCookies(cookies);
//     community.startConfirmationChecker(20000, config.identitySecret);
//   } catch (err) {
//     console.error(`[${new Date().toISOString()}] Error setting cookies:`, err);
//   }
// });

// // Periodic Heartbeat to Check Connection
// setInterval(() => {
//   if (!isLoggedIn) {
//     console.warn(`[${new Date().toISOString()}] Bot is not logged in. Attempting to re-login...`);
//     loginToSteam();
//   } else {
//     console.log(`[${new Date().toISOString()}] Bot is logged in and active.`);
//   }
// }, 60000); // Check every 60 seconds

// // Global Error Handlers
// process.on('uncaughtException', (err) => {
//   console.error(`[${new Date().toISOString()}] Uncaught Exception:`, err);
// });

// process.on('unhandledRejection', (reason, promise) => {
//   console.error(`[${new Date().toISOString()}] Unhandled Rejection:`, reason);
// });

// module.exports = { manager };














//first one logged out error


// const SteamUser = require('steam-user');
// const SteamCommunity = require('steamcommunity');
// const SteamTradeManager = require('steam-tradeoffer-manager');
// const SteamTotp = require('steam-totp');
// const fs = require('fs');

// const client = new SteamUser();
// const community = new SteamCommunity();
// const manager = new SteamTradeManager({
//   steam: client,
//   community: community,
//   language: 'en',
//   useAccessToken: true
// });

// // Steam bot credentials from environment variables
// const config = {
//   accountName: process.env.STEAM_ACCOUNT_NAME,
//   password: process.env.STEAM_PASSWORD,
//   sharedSecret: process.env.STEAM_SHARED_SECRET,
//   identitySecret: process.env.STEAM_IDENTITY_SECRET
// };

// console.log('Config:', config);

// // Validate Steam credentials
// if (!config.accountName || !config.password || !config.sharedSecret || !config.identitySecret) {
//   console.error('Steam credentials are not fully set in environment variables.');
//   process.exit(1);
// }

// // Function to log in to Steam
// function loginToSteam() {
//   client.logOn({
//     accountName: config.accountName,
//     password: config.password,
//     twoFactorCode: SteamTotp.generateAuthCode(config.sharedSecret)
//   });
// }

// // Log in to Steam initially
// loginToSteam();

// client.on('loggedOn', () => {
//   client.setPersona(SteamUser.EPersonaState.Online);
//   client.gamesPlayed([252490]); // Example game ID
//   console.log('Steam client logged in and online');
// });

// // Error handler
// client.on('error', (err) => {
//   console.error('Steam client encountered an error:', err);
//   // Attempt to re-log after error if logged off
//   if (err.eresult === SteamUser.EResult.LoggedOff || err.eresult === SteamUser.EResult.NoConnection) {
//     setTimeout(loginToSteam, 5000); // Try re-logging in after 5 seconds
//   }
// });

// client.on('disconnected', (eresult, msg) => {
//   console.log(`Disconnected from Steam (${eresult}): ${msg}. Attempting to relog.`);
//   setTimeout(loginToSteam, 5000); // Attempt re-login after 5 seconds
// });

// client.on('webSession', (sessionId, cookies) => {
//   console.log('Web session established.');
//   manager.setCookies(cookies);
//   community.setCookies(cookies);
//   community.startConfirmationChecker(20000, config.identitySecret);
// });

// module.exports = { manager };










