const express = require('express');
const router = express.Router();
const jackpotController = require('../controllers/jackpotController');
const isAuth = require('../middleware/isAuth');

// Route to join the jackpot
router.post('/join', isAuth, jackpotController.joinJackpot);

// Route to get the current jackpot status
router.get('/status', jackpotController.getJackpotStatus);
router.get('/history', jackpotController.getJackpotHistory);
router.post('/save-trade-url', isAuth, jackpotController.saveTradeUrl);
router.get("/statistics", isAuth, jackpotController.getUserStatistics);
router.get("/last-four-jackpots", jackpotController.getLastFourJackpots);


module.exports = router;
