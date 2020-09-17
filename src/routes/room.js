const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const Game = require('../models/game.js');

/**
 * Request Body: username 
 */
router.post('/:gameID/join', async (req, res) => {
    res.send(await roomController.joinHandler(req));
});

/**
 * Request Body: username 
 */
router.post('/create', async (req, res) => {
    res.send(await roomController.createHandler(req));
});

/**
 * Request Body: user_id, player_to_be_deleted 
 */
router.post('/:gameID/removePlayer', async (req, res) => {
    res.send(await roomController.removePlayerHandler(req));
});

/**
 * Request Body: user_id
 */
router.post('/:gameID/leaveRoom', async (req, res) => {
    res.send(await roomController.leaveRoomHandler(req));
});

/**
 * Request Body: user_id
 */
router.put('/:gameID/start', async (req, res) => {
    res.send(await roomController.startHandler(req));
});

/**
 * Request Body: user_id
 */
router.get('/:gameID/:user_id/checkInRoom', async (req, res) => {
    res.send(await roomController.checkInRoomHandler(req));
});

module.exports = router;