const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');

/**
 * Request Body: user_id, untouched ([Number]), hand ([Number]) 
 */
router.put('/:gameID/swap', async (req, res) => {
    res.send(await gameController.swapHandler(req));
});

/**
 * Request Body: user_id 
 */
router.put('/:gameID/ready', async (req, res) => {
    res.send(await gameController.lockInHandler(req));
});

/**
 * Request Body: user_id, card_played, from_untouched 
 */
router.put('/:gameID/playCard', async (req, res) => {
    res.send(await gameController.playCardHandler(req));
});

/**
 * Request Body: user_id, selected_cards ([Number])
 */
router.put('/:gameID/playMultipleCards', async (req, res) => {
    res.send(await gameController.playMultipleCardsHandler(req));
});

/**
 * Request Body: user_id, card_position (0, 1, or 2) 
 */
router.put('/:gameID/playHidden', async (req, res) => {
    res.send(await gameController.playHiddenCardHandler(req));
});

/**
 * Request Body: user_id, chosen_cards ([Number]) 
 */
router.put('/:gameID/takeFromCenter', async (req, res) => {
    res.send(await gameController.takeFromCenterHandler(req));
});

/**
 * Request Body: user_id 
 */
router.put('/:gameID/drawCard', async (req, res) => {
    res.send(await gameController.drawCardHandler(req));
});

/**
 * Request Body: user_id 
 */
router.get('/:gameID/:user_id/state', async (req, res) => {
    res.send(await gameController.getGameStateHandler(req));
});

/**
 * Request Body: user_id 
 */
router.delete('/:gameID/:user_id/deleteGame', async (req, res) => {
    res.send(await gameController.deleteGameHandler(req));
});

module.exports = router;