// utils/onlinePlayers.js

let onlinePlayers = 0;

const increment = () => {
    onlinePlayers++;
};

const decrement = () => {
    if (onlinePlayers > 0) onlinePlayers--;
};

const getOnlinePlayers = () => onlinePlayers;

module.exports = {
    increment,
    decrement,
    getOnlinePlayers,
};
