// chat.js
const { Server } = require('socket.io');
const Message = require('../models/messageSchema');

const initChat = (httpServer) => {
    const chatNamespace = new Server(httpServer).of('/chat');

    chatNamespace.on('connection', async (socket) => {
        console.log('Client connected to chat namespace', socket.id);

        try {
            const lastMessages = await Message.find()
                .sort({ timestamp: -1 })
                .limit(20)
                .sort({ timestamp: 1 });

            socket.emit('initialMessages', lastMessages);
        } catch (err) {
            console.error('Error fetching initial messages:', err);
        }

        socket.on('chatMessage', async (msg) => {
            msg.timestamp = msg.timestamp || new Date();

            const message = new Message({
                username: msg.username,
                text: msg.text,
                avatar: msg.avatar,
                timestamp: msg.timestamp,
            });

            try {
                await message.save();
                chatNamespace.emit('chatMessage', message);
            } catch (err) {
                console.error('Error saving message:', err);
            }
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected from chat namespace', socket.id);
        });
    });
};

module.exports = initChat;
