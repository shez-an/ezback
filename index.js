// server.js

require('dotenv').config(); // Ensure this is at the top
const express = require('express');
const passport = require('passport');
const SteamStrategy = require('passport-steam').Strategy;
const session = require('express-session');
const cors = require('cors');
const cookieParser = require('cookie-parser');
// const Message = require('./models/messageSchema'); // Removed
const mongoose = require('mongoose');
const User = require('./models/userSchema');
const jackpotRoutes = require('./routes/jackpotRoutes');
const apiRoutes = require('./routes/apiRoutes'); // Import the new apiRoutes
const { generateToken } = require('./utils/genertaetoken');

// Initialize the app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: process.env.FRONTEND_URL,
    methods: ['GET', 'POST'],
    credentials: true,
}));

// Socket.io setup
const http = require('http').Server(app);
const io = require('./socket').init(http, {
    cors: {
        origin: process.env.FRONTEND_URL,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'OPTIONS', 'DELETE'],
        credentials: true,
    },
});

// Session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-session-secret',
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax',
    },
}));

app.use(passport.initialize());
app.use(passport.session());

// Passport Steam Strategy
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(
    new SteamStrategy(
        {
            returnURL: `${process.env.BACKEND_URL}/auth/steam/return`,
            realm: `${process.env.BACKEND_URL}/`,
            apiKey: process.env.STEAM_API_KEY,
        },
        async (identifier, profile, done) => {
            try {
                profile.identifier = identifier;
                const steamID64 = profile.id;
                const username = profile.displayName;
                const avatar = {
                    small: profile.photos[0].value,
                    medium: profile.photos[1].value,
                    large: profile.photos[2].value,
                };
                
                // Check if user already exists
                let existingUser = await User.findOne({ steamId: steamID64 });
                if (!existingUser) {
                    const newUser = new User({ steamId: steamID64, username: username, avatar: avatar});
                    await newUser.save();
                    return done(null, newUser);
                }
                return done(null, existingUser);
            } catch (err) {
                return done(err);
            }
        }
    )
);

// Steam Authentication Route
app.get('/auth/steam', passport.authenticate('steam'));

app.get(
    '/auth/steam/return',
    passport.authenticate('steam', { failureRedirect: '/' }),
    (req, res) => {
        const authCode = Math.random().toString(36).substring(7);
        global.authCodes = global.authCodes || {};
        global.authCodes[authCode] = req.user;
        res.redirect(`${process.env.FRONTEND_URL}/auth-callback?code=${authCode}`);
    }
);

// Exchange auth code for JWT
app.post('/auth/exchange', (req, res) => {
    const { code } = req.body;

    if (global.authCodes && global.authCodes[code]) {
        const user = global.authCodes[code];
        const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        const token = generateToken(user, clientIp);
        delete global.authCodes[code];
        res.json({ token });
    } else {
        res.status(400).json({ message: 'Invalid or expired authorization code' });
    }
});

// Use the combined routes
app.use('/api', apiRoutes); // This combines both user and inventory routes

// Use jackpot routes
app.use('/jackpotSystem', jackpotRoutes);

// Connect to MongoDB and start the server
mongoose.connect(process.env.MONGO_DB_URI)
    .then(() => {
        http.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        });

        // Initialize active user count
        let activeUsers = 0;

        // Existing Socket.IO connection handler
        io.on('connection', socket => {
            console.log('Client connected', socket.id);
            activeUsers++;
            io.emit('activeUsers', activeUsers); // Emit to all clients

            socket.on('disconnect', () => {
                console.log('Client disconnected', socket.id);
                activeUsers = Math.max(activeUsers - 1, 0);
                io.emit('activeUsers', activeUsers); // Emit updated count
            });
        });

        // In-memory storage for last 20 messages
        const lastMessages = [];

        // Chat namespace for chat functionality
        const chatNamespace = io.of('/chat');

        // Initialize active user count for chat namespace
        let activeChatUsers = 0;

        chatNamespace.on('connection', (socket) => {
            console.log('Client connected to chat namespace', socket.id);
            activeChatUsers++;
            chatNamespace.emit('activeUsers', activeChatUsers); // Emit to chat clients

            // Send the last 20 messages to the newly connected client
            socket.emit('initialMessages', lastMessages);

            // Listen for chat messages
            socket.on('chatMessage', (msg) => {
                // Ensure the message has a timestamp
                msg.timestamp = msg.timestamp || new Date().toISOString();

                // Add the new message to the lastMessages array
                lastMessages.push(msg);

                // Keep only the last 20 messages
                if (lastMessages.length > 20) {
                    lastMessages.shift(); // Remove the oldest message
                }

                // Emit the new message to all connected clients in the chat namespace
                chatNamespace.emit('chatMessage', msg);
            });

            socket.on('disconnect', () => {
                console.log('Client disconnected from chat namespace', socket.id);
                activeChatUsers = Math.max(activeChatUsers - 1, 0);
                chatNamespace.emit('activeUsers', activeChatUsers); // Emit updated count
            });
        });
    })
    .catch(err => {
        console.error('Database connection error:', err);
    });







