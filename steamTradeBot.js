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
// const TradeResponse = [
//   SteamUser.EEconTradeResponse.TradeBannedInitiator,        // 2
//   SteamUser.EEconTradeResponse.TradeBannedTarget,           // 3
//   SteamUser.EEconTradeResponse.TargetAlreadyTrading,        // 4
//   SteamUser.EEconTradeResponse.Disabled,                    // 5
//   SteamUser.EEconTradeResponse.NotLoggedIn,                 // 6
//   SteamUser.EEconTradeResponse.Cancel,                      // 7
//   SteamUser.EEconTradeResponse.TooSoon,                     // 8
//   SteamUser.EEconTradeResponse.TooSoonPenalty,              // 9
//   SteamUser.EEconTradeResponse.ConnectionFailed,            // 10
//   SteamUser.EEconTradeResponse.AlreadyTrading,              // 11
//   SteamUser.EEconTradeResponse.AlreadyHasTradeRequest,      // 12
//   SteamUser.EEconTradeResponse.NoResponse,                  // 13
//   SteamUser.EEconTradeResponse.CyberCafeInitiator,          // 14
//   SteamUser.EEconTradeResponse.CyberCafeTarget,             // 15
//   SteamUser.EEconTradeResponse.SchoolLabInitiator,          // 16
//   SteamUser.EEconTradeResponse.SchoolLabTarget,             // 16
//   SteamUser.EEconTradeResponse.InitiatorBlockedTarget,      // 18
//   SteamUser.EEconTradeResponse.InitiatorNeedsVerifiedEmail, // 20
//   SteamUser.EEconTradeResponse.InitiatorNeedsSteamGuard,    // 21
//   SteamUser.EEconTradeResponse.TargetAccountCannotTrade,    // 22
//   SteamUser.EEconTradeResponse.InitiatorSteamGuardDuration, // 23
//   SteamUser.EEconTradeResponse.InitiatorPasswordResetProbation, // 24
//   SteamUser.EEconTradeResponse.InitiatorNewDeviceCooldown,  // 25
//   SteamUser.EEconTradeResponse.InitiatorSentInvalidCookie,  // 26
//   SteamUser.EEconTradeResponse.NeedsEmailConfirmation,     // 27
//   SteamUser.EEconTradeResponse.InitiatorRecentEmailChange, // 28
//   SteamUser.EEconTradeResponse.NeedsMobileConfirmation,    // 29
//   SteamUser.EEconTradeResponse.TradingHoldForClearedTradeOffersInitiator, // 30
//   SteamUser.EEconTradeResponse.WouldExceedMaxAssetCount,   // 31
//   SteamUser.EEconTradeResponse.DisabledInRegion,            // 32
//   SteamUser.EEconTradeResponse.DisabledInPartnerRegion,     // 33
// ];
const tradeResponseErrors = [
  "Accepted", // 0
  "Declined", // 1
  "Trade Banned Initiator", // 2
  "Trade Banned Target", // 3
  "Target Already Trading", // 4
  "Disabled", // 5
  "Not Logged In", // 6
  "Cancel", // 7
  "Too Soon", // 8
  "Too Soon Penalty", // 9
  "Connection Failed", // 10
  "Already Trading", // 11
  "Already Has Trade Request", // 12
  "No Response", // 13
  // "Cyber Cafe Initiator", // 14
  // "Cyber Cafe Target", // 15
  // "School Lab Initiator", // 16
  // "School Lab Target", // 16
  // "Initiator Blocked Target", // 18
  // "InitiatorNeedsVerifiedEmail", // 20
  // "InitiatorNeedsSteamGuard", // 21
  // "TargetAccountCannotTrade", // 22
  // "InitiatorSteamGuardDuration", // 23
  // "InitiatorPasswordResetProbation", // 24
  // "InitiatorNewDeviceCooldown", // 25
  // "InitiatorSentInvalidCookie", // 26
  // "NeedsEmailConfirmation", // 27
  // "InitiatorRecentEmailChange", // 28
  // "NeedsMobileConfirmation", // 29
  // "TradingHoldForClearedTradeOffersInitiator", // 30
  // "WouldExceedMaxAssetCount", // 31
  // "Disabled In Region", // 32
  // "Disabled In Partner Region", // 33
  // "OKToDeliver" // 50
];


let isLoggedIn = false;  // Flag to track login state

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
  isLoggedIn = true;  // Set the login state to true
  logger.info('Steam client logged in and online');
  client.setPersona(SteamUser.EPersonaState.Online);
  client.gamesPlayed([252490]); // Example game ID
});

client.on('error', (err) => {
  logger.error(`Steam client encountered an error: ${err}`);

  // Log error result for debugging
  logger.info(`Error result: ${err.eresult}, Error message: ${err.message}`);
  // isLoggedIn = false;
  // Check if the error is a critical error and requires a re-login
  if (criticalErrors.includes(err.eresult)) {
    logger.info('Critical error encountered. Attempting to reconnect...');
    handleReconnect();
  } else {
    logger.info('Non-critical error encountered. No reconnect triggered.');
  }
});

client.on('disconnected', (eresult, msg) => {
  logger.warn(`Disconnected from Steam (${eresult}): ${msg}.`);

  // Log the disconnection reason
  logger.info(`Disconnected due to: ${eresult} - ${msg}`);
  // isLoggedIn = false;
  // Only attempt reconnect if the bot is not logged in
  if (!isLoggedIn) {
    logger.info('Bot is not logged in, attempting reconnect.');
    handleReconnect();  // Attempt re-login after exponential backoff
  } else {
    logger.info('Bot is logged in, not reconnecting.');
  }
});

client.on('webSession', (sessionId, cookies) => {
  logger.info('Web session established.');
  manager.setCookies(cookies);
  community.setCookies(cookies);
  community.startConfirmationChecker(20000, config.identitySecret);
});

// Heartbeat to monitor connection status
const HEARTBEAT_INTERVAL = 60000; // 60 seconds

setInterval(() => {
  // Use the 'isLoggedIn' flag to check bot status
  if (!isLoggedIn) {
    logger.warn('Bot is not logged in. Attempting to reconnect...');
    handleReconnect(); // Attempt re-login if not logged in
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

// Export the necessary components
module.exports = {
  client,
  community,
  manager,
  loginToSteam,
  handleReconnect,
  config,
  logger, // Optionally, export the logger if you want to log errors in other modules
  criticalErrors,
  tradeResponseErrors
};















// const SteamUser = require('steam-user');
// const SteamCommunity = require('steamcommunity');
// const SteamTradeManager = require('steam-tradeoffer-manager');
// const SteamTotp = require('steam-totp');
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

// let loginAttempts = 0;
// let reconnectAttempts = 0;
// const MAX_LOGIN_ATTEMPTS = 10;
// const MAX_RECONNECT_ATTEMPTS = 5;

// // Critical errors that require re-login
// const criticalErrors = [
//   SteamUser.EResult.NotLoggedOn,
//   SteamUser.EResult.NoConnection,
//   SteamUser.EResult.InvalidPassword,
//   SteamUser.EResult.Timeout,
//   SteamUser.EResult.ConnectFailed,
//   SteamUser.EResult.HandshakeFailed,
//   SteamUser.EResult.RemoteDisconnect,
//   SteamUser.EResult.AccountNotFound,
//   SteamUser.EResult.ServiceUnavailable,
//   SteamUser.EResult.RateLimitExceeded,
//   SteamUser.EResult.InvalidLoginAuthCode,
//   SteamUser.EResult.AccountLocked,
//   SteamUser.EResult.InvalidItemType
// ];

// let isLoggedIn = false;  // Flag to track login state

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

// // Retry with exponential backoff
// function handleReconnect() {
//   if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
//     logger.error('Max reconnect attempts reached. Stopping...');
//     process.exit(1); // Exit after max attempts reached
//   }

//   const delay = Math.pow(2, reconnectAttempts) * 1000; // Exponential backoff: 1s, 2s, 4s, 8s...
//   logger.info(`Attempting to reconnect in ${delay / 1000} seconds...`);

//   reconnectAttempts++;
//   setTimeout(loginToSteam, delay); // Retry login with exponential backoff
// }

// // Log in to Steam initially
// loginToSteam();

// // Steam client event handlers
// client.on('loggedOn', () => {
//   loginAttempts = 0; // Reset on successful login
//   isLoggedIn = true;  // Set the login state to true
//   logger.info('Steam client logged in and online');
//   client.setPersona(SteamUser.EPersonaState.Online);
//   client.gamesPlayed([252490]); // Example game ID
// });

// client.on('error', (err) => {
//   logger.error(`Steam client encountered an error: ${err}`);

//   // Log error result for debugging
//   logger.info(`Error result: ${err.eresult}, Error message: ${err.message}`);

//   // Check if the error is a critical error and requires a re-login
//   if (criticalErrors.includes(err.eresult)) {
//     logger.info('Critical error encountered. Attempting to reconnect...');
//     handleReconnect();
//   } else {
//     logger.info('Non-critical error encountered. No reconnect triggered.');
//   }
// });

// client.on('disconnected', (eresult, msg) => {
//   logger.warn(`Disconnected from Steam (${eresult}): ${msg}.`);

//   // Log the disconnection reason
//   logger.info(`Disconnected due to: ${eresult} - ${msg}`);

//   // Only attempt reconnect if the bot is not logged in
//   if (!isLoggedIn) {
//     logger.info('Bot is not logged in, attempting reconnect.');
//     handleReconnect();  // Attempt re-login after exponential backoff
//   } else {
//     logger.info('Bot is logged in, not reconnecting.');
//   }
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
//   // Use the 'isLoggedIn' flag to check bot status
//   if (!isLoggedIn) {
//     logger.warn('Bot is not logged in. Attempting to reconnect...');
//     handleReconnect(); // Attempt re-login if not logged in
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





//error in set interval

// const SteamUser = require('steam-user');
// const SteamCommunity = require('steamcommunity');
// const SteamTradeManager = require('steam-tradeoffer-manager');
// const SteamTotp = require('steam-totp');
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

// let loginAttempts = 0;
// let reconnectAttempts = 0;
// const MAX_LOGIN_ATTEMPTS = 10;
// const MAX_RECONNECT_ATTEMPTS = 5;

// // Critical errors that require re-login
// const criticalErrors = [
//   SteamUser.EResult.NotLoggedOn,
//   SteamUser.EResult.NoConnection,
//   SteamUser.EResult.InvalidPassword,
//   SteamUser.EResult.Timeout,
//   SteamUser.EResult.ConnectFailed,
//   SteamUser.EResult.HandshakeFailed,
//   SteamUser.EResult.RemoteDisconnect,
//   SteamUser.EResult.AccountNotFound,
//   SteamUser.EResult.ServiceUnavailable,
//   SteamUser.EResult.RateLimitExceeded,
//   SteamUser.EResult.InvalidLoginAuthCode,
//   SteamUser.EResult.AccountLocked,
//   SteamUser.EResult.InvalidItemType
// ];

// let isLoggedIn = false;  // New flag to track login state

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

// // Retry with exponential backoff
// function handleReconnect() {
//   if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
//     logger.error('Max reconnect attempts reached. Stopping...');
//     process.exit(1); // Exit after max attempts reached
//   }

//   const delay = Math.pow(2, reconnectAttempts) * 1000; // Exponential backoff: 1s, 2s, 4s, 8s...
//   logger.info(`Attempting to reconnect in ${delay / 1000} seconds...`);

//   reconnectAttempts++;
//   setTimeout(loginToSteam, delay); // Retry login with exponential backoff
// }

// // Log in to Steam initially
// loginToSteam();

// // Steam client event handlers
// client.on('loggedOn', () => {
//   loginAttempts = 0; // Reset on successful login
//   isLoggedIn = true;  // Set the login state to true
//   logger.info('Steam client logged in and online');
//   client.setPersona(SteamUser.EPersonaState.Online);
//   client.gamesPlayed([252490]); // Example game ID
// });

// client.on('error', (err) => {
//   logger.error(`Steam client encountered an error: ${err}`);

//   // Log error result for debugging
//   logger.info(`Error result: ${err.eresult}, Error message: ${err.message}`);

//   // Check if the error is a critical error and requires a re-login
//   if (criticalErrors.includes(err.eresult)) {
//     logger.info('Critical error encountered. Attempting to reconnect...');
//     handleReconnect();
//   } else {
//     logger.info('Non-critical error encountered. No reconnect triggered.');
//   }
// });

// client.on('disconnected', (eresult, msg) => {
//   logger.warn(`Disconnected from Steam (${eresult}): ${msg}.`);

//   // Log the disconnection reason
//   logger.info(`Disconnected due to: ${eresult} - ${msg}`);

//   // Only attempt reconnect if the bot is not logged in
//   if (!isLoggedIn) {
//     logger.info('Bot is not logged in, attempting reconnect.');
//     handleReconnect();  // Attempt re-login after exponential backoff
//   } else {
//     logger.info('Bot is logged in, not reconnecting.');
//   }
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
//   // Log detailed heartbeat
//   if (!client.steamID || client.steamID.getSteamID64() === '0') {
//     console.log(client.steamID, client.steamID.getSteamID64());
//     console.log(client);
    
    
//     console.log(`[${new Date().toISOString()}] Heartbeat: Bot is offline.`);
    
//     logger.warn('Bot is not logged in. Attempting to reconnect...');
//     // handleReconnect();
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










