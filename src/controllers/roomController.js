const Game = require('../models/game.js');
const User = require('../models/user.js');
const { ACTIVE_TIME_GAP, TOTAL_NUM_GAME, WIN_TIME_GAP } = require('../constants/constants.js');
const createRoomID = require('../utils/createRoomID');
const { drawCardHandler } = require('./gameController');

const joinHandler = async function(req) {
    const resBody = {
        success : false,
        err_msg : "",
        user_id : "",
        players_in_room : []
    }

    //Attempt to find the game
    const game = await Game.findOne({room_id : req.params.gameID});
    if (game == null) {
        resBody.err_msg = "Room does not exist!"
        return resBody;
    }

    //Check if the game has started
    if (game.started) {
        resBody.err_msg = "This room has already started their game.";
        return resBody;
    }
 
    //Check if the username is already used
    const playerList = await Game.getPlayerList(game.room_id);
    let username = req.body.username;
    if (username == undefined) {
        username = "unnamed player";
    }
    for (let player of playerList) {
        if (username == player.username) {
            resBody.err_msg = "Username already exists in the room! Please choose another name.";
            return resBody;
        }
        resBody.players_in_room.push(player.username);
    }

    //Create the user
    const user = new User({
        username: username
    });
    try {
        const savedUser = await user.save();
        resBody.user_id = savedUser._id.toString();
    } catch (error) {
        resBody.err_msg = "Error when saving user to database.";
        return resBody;
    }
    
    //Add the user to the game room
    try {
        await Game.updateOne(
            {room_id : req.params.gameID},
            {$set : {players : [...game.players, resBody.user_id], time_updated : Date.now()}}
        );
    } catch (error) {
        await User.deleteOne({_id : resBody.user_id});
        resBody.err_msg = "Error when saving user to database.";
        return resBody;
    }

    //Return success
    resBody.success = true;

    return resBody;
}

const createHandler = async function(req) {
    const resBody = {
        success : false,
        err_msg : "",
        user_id : "",
        room_id : ""
    } 

    const games = await Game.find();
    let numGames = games.length;
    let time = Date.now();
    let roomIDList = [];
    for (let game of games) {
        //Delete games from the database that haven't been updated in the past 10 mins
        if (time - game.time_updated > ACTIVE_TIME_GAP) {
            if (!(await Game.deleteGame({_id : game._id}))) {
                resBody.err_msg = "Database error when deleting expired games.";
                return resBody;
            }
            numGames--;
        } else if (game.game_ended && time - game.time_updated > WIN_TIME_GAP) {
            if (!(await Game.deleteGame({_id : game._id}))) {
                resBody.err_msg = "Database error when deleting expired games.";
                return resBody;
            }
            numGames--;
        } else {
            roomIDList.push(game.room_id);
        }
    }

    //Check if there's enough space to create a new game.
    if (numGames >= TOTAL_NUM_GAME) {
        resBody.err_msg = `Total number of games exceeded: ${TOTAL_NUM_GAME}`;
        return resBody;
    }

    if (req.body.username === 'cardi' && roomIDList.indexOf('wapwap') === -1) {
        resBody.room_id = 'wapwap';
    } else {
        resBody.room_id = createRoomID(roomIDList);
    }

    //Create the user
    const user = new User({
        username: req.body.username
    });
    const savedUser = await user.save();
    resBody.user_id = savedUser._id.toString();

    //Create the game
    const game = new Game({
        room_id : resBody.room_id,
        players : [resBody.user_id]          
    });
    await game.save();
    
    resBody.success = true;

    return resBody;
}

const removePlayerHandler = async function(req) {
    const resBody = {
        success : false,
        err_msg : ""
    } 

    //Attempt to find the game
    const game = await Game.findOne({room_id : req.params.gameID});
    if (game == null) {
        resBody.err_msg = "Room does not exist!"
        return resBody;
    }

    //Check if the game has started
    if (game.started) {
        resBody.err_msg = "You can't remove a player when the game already started";
        return resBody;
    }

    //Check if the user exists in the game room
    if (game.players.indexOf(req.body.user_id) == -1) {
        resBody.err_msg = "You are not in this game room!";
        return resBody;
    }

    //Check if the user is the room creator
    if (game.players[0] != req.body.user_id) {
        resBody.err_msg = "User is not the room creator.";
        return resBody;
    }

    //Check if the person to be deleted is valid
    const playerList = await Game.getPlayerList(game.room_id);
    let foundPlayer = false;
    let playerID;
    for (let player of playerList) {        
        if (player.username == req.body.player_to_be_deleted) {
            if (player._id.toString() == req.body.user_id) {
                resBody.err_msg = "Cannot delete yourself from the room!";
                return resBody;
            } else {
                foundPlayer = true;
                playerID = player._id.toString();
                break;
            }
        }
    }
    if (!foundPlayer) {
        resBody.err_msg = "Player not found!";
        return resBody;
    }

    //Attempt to delete the player 
    try {
        await User.deleteOne({username : req.body.player_to_be_deleted});
    } catch (error) {
        resBody.err_msg = "Error with deleting the player from the database";
        return resBody;
    }

    //Update the game to remove the player
    try {
        game.players.splice(game.players.indexOf(playerID), 1);
        await Game.updateOne(
            {room_id : req.params.gameID},
            {$set : {players : game.players, time_updated : Date.now()}}
        );
    } catch (error) {
        resBody.err_msg = "Error with removing the player from the game";
        return resBody;
    }

    resBody.success = true;
    return resBody;

}


const leaveRoomHandler = async function(req) {
    const resBody = {
        success : false,
        err_msg : ""
    } 

    //Attempt to find the game
    const game = await Game.findOne({room_id : req.params.gameID});
    if (game == null) {
        resBody.err_msg = "Room does not exist!";
        return resBody;
    }

    //Check if the game has started
    if (game.started) {
        resBody.err_msg = "You can't leave the room when the game already started";
        return resBody;
    }

    //Check if the user exists in the game room
    if (game.players.indexOf(req.body.user_id) == -1) {
        resBody.err_msg = "You are not in this game room!";
        return resBody;
    }

    //Remove the user from the database
    try {
        await User.deleteOne({_id : req.body.user_id});
    } catch (error) {
        resBody.err_msg = "Error with removing you from the database";
        return resBody;
    }

    //Update the game to remove the player
    try {
        game.players.splice(game.players.indexOf(req.body.user_id), 1);
        if (game.players.length > 0) {
            await Game.updateOne(
                {room_id : req.params.gameID},
                {$set : {players : game.players, time_updated : Date.now()}}
            );
        } else {
            await Game.deleteGame({room_id : req.params.gameID});
        }
    } catch (error) {
        resBody.err_msg = "Error with removing you from the game room";
        return resBody;
    }

    resBody.success = true;
    return resBody;

}

const startHandler = async function(req) {
    const resBody = {
        success : false,
        err_msg : ""
    } 

    //Attempt to find the game
    let game = await Game.findOne({room_id : req.params.gameID});
    if (game == null) {
        resBody.err_msg = "Room does not exist!";
        return resBody;
    }

    //Check if the game has started
    if (game.started) {
        resBody.err_msg = "The game has already started.";
        return resBody;
    }

    //Check if the user exists in the game room
    let playerIndex = game.players.indexOf(req.body.user_id);
    if (playerIndex == -1) {
        resBody.err_msg = "You are not in this game room!";
        return resBody;
    }

    //Check if the user is the room creator
    if (playerIndex != 0) {
        resBody.err_msg = "You are not the room creator!";
        return resBody;
    }


    //Deal the cards to each player
    let playerList = await Game.getPlayerList(req.params.gameID);
    
    if (playerList.length == 1) {
        resBody.err_msg = "There are not enough people in the lobby to start a game!";
        return resBody;
    }

    for (let player of playerList) {
        let drawnCards = await Game.drawCard(req.params.gameID, 10, game);
        //Get updated game object from db
        game = await Game.findOne({room_id : req.params.gameID});
        if (drawnCards.length == 0) {
            resBody.err_msg = "Error when drawing cards from database.";
            return resBody;
        }
        //Add the cards to each players hand
        try {
            await User.updateOne(
                {_id : player._id},
                {$set : {
                    hand : drawnCards.slice(0, 4), 
                    untouched_hand : drawnCards.slice(4, 7), 
                    hidden_hand : drawnCards.slice(7, drawnCards.length)
                }}
            );
        } catch (error) {
            resBody.err_msg = `Error when dealing cards to ${player.username}'s hand.`;
            return resBody;
        }
    }

    //Draw a card for the center to begin
    let startCard = await Game.drawCard(req.params.gameID, 1, game);

    //Attempt to update the game state 
    try {
        await Game.updateOne(
            {room_id : req.params.gameID},
            {$set : {started : true, played_pile : startCard, time_updated : Date.now()}}
        );
    } catch(error) {
        resBody.err_msg = "Error with starting the game in the database";
        return resBody;        
    }

    resBody.success = true;
    return resBody;

}

module.exports = { joinHandler, createHandler, removePlayerHandler, leaveRoomHandler, startHandler };