let io;

module.exports = {
    
    init: (httpServer,cors) => {
        io = require('socket.io')(httpServer,cors)
        return io;
    },
    getIO: ()=>{
        if (!io) {
            throw new Error ('socket io is not initialized')
        }
        return io;
    }
}