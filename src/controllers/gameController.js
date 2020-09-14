const Game = require('../models/game.js');
const User = require('../models/user.js');
const { DECK_NUM, PLAYABLE } = require('../constants/constants.js');

const swapHandler = async function(req) {
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

    //Check if the user exists in the game room
    if (game.players.indexOf(req.body.user_id) == -1) {
        resBody.err_msg = "You are not in this game room!";
        return resBody;
    }

    //Check if the game has started
    if (!game.started) {
        resBody.err_msg = "The game has not started yet!";
        return resBody;
    }

    //Check if it's still the swapping phase
    if (!game.in_swap_phase) {
        resBody.err_msg = "The game is already past the swapping phase."
        return resBody;
    }

    //Check if the user has locked in already
    let user = await User.findOne({_id : req.body.user_id});
    if (user == null) {
        resBody.err_msg = "Can't find user in the database!"
        return resBody;
    }
    if (user.swapped) {
        resBody.err_msg = "You have already locked in your swaps!";
        return resBody;
    }

    //Check if the desired swaps are valid
    if (req.body.hand.length != req.body.untouched.length) {
        resBody.err_msg = "The swap is invalid: the number of cards selected are unequal.";
        return resBody;
    }
    if (req.body.hand.length > 3) {
        resBody.err_msg = "The swap is invalid: You cannot swap more than 3 cards";
        return resBody;
    }

    //Check if the select cards actually exist in the user's hand and untouched hand
    var i;
    for (i = 0; i < req.body.hand.length; i++) {
        if (user.hand.indexOf(req.body.hand[i]) == -1 || 
            user.untouched_hand.indexOf(req.body.untouched[i]) == -1) {
            resBody.err_msg = "The selected cards don't exist in your hand.";
            return resBody;
        }
    }

    //Make the swap
    for (i = 0; i < req.body.hand.length; i++) {
        let handIndex = user.hand.indexOf(req.body.hand[i]);
        let untouchedIndex = user.untouched_hand.indexOf(req.body.untouched[i]);
        if (handIndex == -1 || untouchedIndex == -1) {
            resBody.err_msg = "The selected cards cannot be duplicates.";
            return resBody;
        }
        user.untouched_hand.push(...user.hand.splice(handIndex, 1));
        user.hand.push(...user.untouched_hand.splice(untouchedIndex, 1));
    }
    try {
        await User.updateOne(
            {_id : req.body.user_id},
            {$set : {hand : user.hand, untouched_hand : user.untouched_hand}}  
        );
        await Game.updateOne(
            {room_id : req.params.gameID},
            {$set : {time_updated : Date.now()}}
        );
    } catch (error) {
        resBody.err_msg = "Error with saving the swap to the database!";
        return resBody;
    }

    resBody.success = true;
    return resBody;
}

const lockInHandler = async function(req) {
    const resBody = {
        success : false,
        err_msg : "",
        everyone_ready: false
    }

    //Attempt to find the game
    const game = await Game.findOne({room_id : req.params.gameID});
    if (game == null) {
        resBody.err_msg = "Room does not exist!"
        return resBody;
    }

    //Check if the user exists in the game room
    if (game.players.indexOf(req.body.user_id) == -1) {
        resBody.err_msg = "You are not in this game room!";
        return resBody;
    }

    //Check if the game has started
    if (!game.started) {
        resBody.err_msg = "The game has not started yet!";
        return resBody;
    }

    //Check if it's still the swapping phase
    if (!game.in_swap_phase) {
        resBody.err_msg = "The game is already past the swapping phase."
        return resBody;
    }

    //Update the user's swapped status
    try {
        await User.updateOne(
            {_id : req.body.user_id},
            {$set : {swapped : true}}
        );

    } catch (error) {
        resBody.err_msg = "Error with updating the user swapped status.";
        return resBody;
    }

    //Check if everyone is now locked in
    let playerList = await Game.getPlayerList(req.params.gameID, game);
    resBody.everyone_ready = true;
    for (let player of playerList) {
        if (!player.swapped) {
            resBody.everyone_ready = false;
        }
    }

    //Update game state to reflect everyone being locked in for swapping
    if (resBody.everyone_ready) {
        try {
            await Game.updateOne(
                {room_id : req.params.gameID},
                {$set : {in_swap_phase : false, turn_at : game.players[0], time_updated : Date.now()}}
            );
        } catch (error) {
            resBody.err_msg = "Error with updating the game state (everyone locked in).";
            return resBody;
        }
    }

    resBody.success = true;
    return resBody;
}

const playCardHandler = async function(req) {
    const resBody = {
        success : false,
        err_msg : "",
        is_burn: false,
        go_again: false
    }

    //Attempt to find the game
    const game = await Game.findOne({room_id : req.params.gameID});
    if (game == null) {
        resBody.err_msg = "Room does not exist!"
        return resBody;
    }

    //Check if the user exists in the game room
    if (game.players.indexOf(req.body.user_id) == -1) {
        resBody.err_msg = "You are not in this game room!";
        return resBody;
    }

    //Check if the game has started
    if (!game.started) {
        resBody.err_msg = "The game has not started yet!";
        return resBody;
    }

    //Check if it's still the swapping phase
    if (game.in_swap_phase) {
        resBody.err_msg = "The game is still in the swapping phase. Wait until everyone has locked in."
        return resBody;
    }

    //Check if it's the player's turn
    if (game.turn_at.toString() != req.body.user_id) {
        resBody.err_msg = "It is not your turn to play!";
        return resBody;
    }

    //Check if the card can be played
    if (!(await Game.playable(req.params.gameID, req.body.card_played, game))) {
        resBody.err_msg = "The selected card cannot be played to the center.";
        return resBody;
    } 

    //Check if the selected card exists in the user's hand
    const player = await User.findOne({_id : req.body.user_id});
    if (player == null) {
        resBody.err_msg = "Error: User not found in database.";
        return resBody;
    }
    //First check which hand to look for the selected card (hand or untouched)
    if (req.body.from_untouched) {

        //If from untouched hand, check if the game deck and hand are empty
        if (game.deck.length != 0 || player.hand.length != 0) {
            resBody.err_msg = "You cannot play the cards in your untouched hand yet!";
            return resBody;
        }

        let cardIndex = player.untouched_hand.indexOf(req.body.card_played);
        if (cardIndex == -1) {
            resBody.err_msg = "The card does not exist in the player's untouched hand.";
            return resBody;
        }

        //Remove the card from the player's untouched hand
        player.untouched_hand[cardIndex] = -1;

    } else {

        let cardIndex = player.hand.indexOf(req.body.card_played);
        if (cardIndex == -1) {
            resBody.err_msg = "The card does not exist in the player's hand.";
            return resBody;
        }

        //Remove the card from the player's hand
        player.hand.splice(cardIndex, 1);
    }

    //Add the card to the game play pile
    game.played_pile.push(req.body.card_played);

    //Check for if there is a burn
    if (Game.isBurn(game.played_pile)) {

        resBody.is_burn = true;
        resBody.go_again = true;
        //Move the played pile into the discard pile.
        game.discard = [...game.discard, ...game.played_pile];
        game.played_pile = [];
    }

    //Check if a 2 has been played
    if (req.body.card_played % 13 == 2) {
        resBody.go_again = true;
    }

    //Move the turn_at to the next player 
    if (!resBody.go_again) {
        let playerIndex = game.players.indexOf(req.body.user_id);
        playerIndex = (playerIndex + 1) == game.players.length ? 0 : (playerIndex + 1);
        game.turn_at = game.players[playerIndex];
    }

    //Update the changes to the database
    try {
        let result = await Game.updateOne(
            {room_id : req.params.gameID},
            {$set : {played_pile : game.played_pile, discard : game.discard, turn_at : game.turn_at, time_updated : Date.now()}}
        );
        await User.updateOne(
            {_id : req.body.user_id},
            {$set : {hand : player.hand, untouched_hand : player.untouched_hand}}
        );
    } catch (error) {
        resBody.err_msg = "Error with database when saving the card play.";
        return resBody;
    }

    resBody.success = true;
    return resBody;
}

const playMultipleCardsHandler = async function(req) {
    const resBody = {
        success : false,
        err_msg : "",
        is_burn: false,
        go_again: false
    }

    //Attempt to find the game
    const game = await Game.findOne({room_id : req.params.gameID});
    if (game == null) {
        resBody.err_msg = "Room does not exist!"
        return resBody;
    }

    //Check if the user exists in the game room
    if (game.players.indexOf(req.body.user_id) == -1) {
        resBody.err_msg = "You are not in this game room!";
        return resBody;
    }

    //Check if the game has started
    if (!game.started) {
        resBody.err_msg = "The game has not started yet!";
        return resBody;
    }

    //Check if it's still the swapping phase
    if (game.in_swap_phase) {
        resBody.err_msg = "The game is still in the swapping phase. Wait until everyone has locked in."
        return resBody;
    }

    //Check if it's the player's turn
    if (game.turn_at.toString() != req.body.user_id) {
        resBody.err_msg = "It is not your turn to play!";
        return resBody;
    }        

    //Check if the selected cards has been passed in
    if (req.body.selected_cards === undefined) {
        resBody.err_msg = "Error: no cards selected";
        return resBody;
    }
    
    //Check if the selected card exists in the user's hand
    const player = await User.findOne({_id : req.body.user_id});
    if (player == null) {
        resBody.err_msg = "Error: User not found in database.";
        return resBody;
    }
    if (req.body.selected_cards.length == 0) {
        resBody.success = true;
        return resBody;
    }
    
    //See if untouched cards were selected
    if (req.body.selected_cards.length > player.hand.length) {
        if (game.deck.length !== 0) {
            resBody.err_msg = "You cannot play your untouched cards until the deck runs out.";
            return resBody;
        }
        let firstCard = req.body.selected_cards[0] % 13;
        for (let card of req.body.selected_cards) {
            //Check if all the selected cards are the same
            if (card % 13 !== firstCard) {
                resBody.err_msg = "The selected cards aren't duplicates (not same number)";
                return resBody;
            }

            let handCardIndex = player.hand.indexOf(card);
            let untouchedCardIndex = player.untouched_hand.indexOf(card);

            if (handCardIndex === -1 && untouchedCardIndex === -1) {
                resBody.err_msg = "There is a card that does not exist in your hand.";
                return resBody;
            }

            if (handCardIndex !== -1) {
                //Remove the cards from the player's hand
                player.hand.splice(handCardIndex, 1);
            }

            if (untouchedCardIndex !== -1) {
                //Remove the cards from the untouched hand
                player.untouched_hand[untouchedCardIndex] = -1;
            }
        }


    } else {
        let firstCard = req.body.selected_cards[0] % 13;
        for (let card of req.body.selected_cards) {
            //Check if all the selected cards are the same
            if (card % 13 !== firstCard) {
                resBody.err_msg = "The selected cards aren't duplicates (not same number)";
                return resBody;
            }
    
            let cardIndex = player.hand.indexOf(card);
            if (cardIndex === -1) {
                resBody.err_msg = "There is a card that does not exist in your hand.";
                return resBody;
            }
    
            //Remove the cards from the player's hand
            player.hand.splice(cardIndex, 1);
        }
    }

    //Check if the selected cards are playable
    if (!(await Game.playable(req.params.gameID, req.body.selected_cards[0], game))) {
        resBody.err_msg = "The selected cards cannot be played to the center.";
        return resBody;
    } 

    //Add the cards to the played_pile
    game.played_pile = [...game.played_pile, ...req.body.selected_cards];

    //Check for if there is a burn
    if (Game.isBurn(game.played_pile)) {

        resBody.is_burn = true;
        resBody.go_again = true;
        //Move the played pile into the discard pile.
        game.discard = [...game.discard, ...game.played_pile];
        game.played_pile = [];
    }

    //Check if a 2 has been played
    if (req.body.selected_cards[0] % 13 == 2) {
        resBody.go_again = true;
    }

    //Move the turn_at to the next player 
    if (!resBody.go_again) {
        let playerIndex = game.players.indexOf(req.body.user_id);
        playerIndex = (playerIndex + 1) == game.players.length ? 0 : (playerIndex + 1);
        game.turn_at = game.players[playerIndex];
    }

    //Update the changes to the database
    try {
        await Game.updateOne(
            {room_id : req.params.gameID},
            {$set : {played_pile : game.played_pile, discard : game.discard, turn_at : game.turn_at, time_updated : Date.now()}}
        );
        await User.updateOne(
            {_id : req.body.user_id},
            {$set : {hand : player.hand, untouched_hand : player.untouched_hand}}
        );
    } catch (error) {
        resBody.err_msg = "Error with database when saving the card play.";
        return resBody;
    }

    resBody.success = true;
    return resBody;
}

const playHiddenCardHandler = async function(req) {
    const resBody = {
        success : false,
        err_msg : "",
        is_burn: false,
        go_again: false,
        card_reveal : -1,
        playable : false
    }

    //Attempt to find the game
    const game = await Game.findOne({room_id : req.params.gameID});
    if (game == null) {
        resBody.err_msg = "Room does not exist!"
        return resBody;
    }

    //Check if the user exists in the game room
    if (game.players.indexOf(req.body.user_id) == -1) {
        resBody.err_msg = "You are not in this game room!";
        return resBody;
    }

    //Check if the game has started
    if (!game.started) {
        resBody.err_msg = "The game has not started yet!";
        return resBody;
    }

    //Check if it's still the swapping phase
    if (game.in_swap_phase) {
        resBody.err_msg = "The game is still in the swapping phase. Wait until everyone has locked in."
        return resBody;
    }

    //Check if it's the player's turn
    if (game.turn_at.toString() != req.body.user_id) {
        resBody.err_msg = "It is not your turn to play!";
        return resBody;
    }        
    
    //Check if the selected card exists in the user's hand
    const player = await User.findOne({_id : req.body.user_id});
    if (player == null) {
        resBody.err_msg = "Error: User not found in database.";
        return resBody;
    }
    //Check if the player has no other cards left in their hands
    if (game.deck.length != 0 || player.hand.length != 0) {
        resBody.err_msg = "You cannot play the cards in your hidden hand yet!";
        return resBody;
    }
    for (let card of player.untouched_hand) {
        if (card != -1) {
            resBody.err_msg = "You cannot play the cards in your hidden hand yet!";
            return resBody;           
        }
    }

    //Check if the selected card hasn't been chosen before
    try {
        if (player.hidden_hand[req.body.card_position] == -1) {
            resBody.err_msg = "The chosen card position has already been played";
            return resBody;
        } else {
            resBody.card_reveal = player.hidden_hand[req.body.card_position];
            player.hidden_hand[req.body.card_position] = -1;
        }
    } catch (error) {
        resBody.err_msg = "The chosen card position is invalid.";
        return resBody;
    }

    //Check if the card is playable to the center
    if (!(await Game.playable(req.params.gameID, resBody.card_reveal, game))) {
        //If not playable, put the card in the center for other players to see
        game.played_pile.push(resBody.card_reveal);
        await Game.updateOne(
            {room_id : req.params.gameID},
            {$set : {played_pile : game.played_pile, time_updated : Date.now()}}
        );
        await User.updateOne(
            {_id : req.body.user_id},
            {$set : {hidden_hand : player.hidden_hand, failed_hidden_play : true}}
        );
        resBody.success = true;
        return resBody;

    } 

    resBody.playable = true;

    //If the card is playable, add the card to the game play pile
    game.played_pile.push(resBody.card_reveal);

    //Check for if there is a burn
    if (Game.isBurn(game.played_pile)) {
        resBody.is_burn = true;
        resBody.go_again = true;
        //Move the played pile into the discard pile.
        game.discard = [...game.discard, ...game.played_pile];
        game.played_pile = [];
    }

    //Check if a 2 has been played
    if (resBody.card_reveal % 13 == 2) {
        resBody.go_again = true;
    }

    //Move the turn_at to the next player 
    if (!resBody.go_again) {
        let playerIndex = game.players.indexOf(req.body.user_id);
        playerIndex = (playerIndex + 1) == game.players.length ? 0 : (playerIndex + 1);
        game.turn_at = game.players[playerIndex];
    }

    //Update the changes to the database
    try {
        await Game.updateOne(
            {room_id : req.params.gameID},
            {$set : {
                played_pile : game.played_pile, 
                discard : game.discard, 
                turn_at : game.turn_at, 
                time_updated : Date.now()
            }}
        );
        await User.updateOne(
            {_id : req.body.user_id},
            {$set : {hand : player.hand, hidden_hand : player.hidden_hand}}
        );
    } catch (error) {
        resBody.err_msg = "Error with database when saving the card play.";
        return resBody;
    }

    resBody.success = true;
    return resBody;
}

const takeFromCenterHandler = async function(req) {
    const resBody = {
        success : false,
        err_msg : ""
    }

    let fromUntouched = false;

    //Attempt to find the game
    const game = await Game.findOne({room_id : req.params.gameID});
    if (game == null) {
        resBody.err_msg = "Room does not exist!"
        return resBody;
    }

    //Check if the user exists in the game room
    if (game.players.indexOf(req.body.user_id) == -1) {
        resBody.err_msg = "You are not in this game room!";
        return resBody;
    }

    //Check if the game has started
    if (!game.started) {
        resBody.err_msg = "The game has not started yet!";
        return resBody;
    }

    //Check if it's still the swapping phase
    if (game.in_swap_phase) {
        resBody.err_msg = "The game is still in the swapping phase. Wait until everyone has locked in."
        return resBody;
    }

    //Check if it's the player's turn
    if (game.turn_at.toString() != req.body.user_id) {
        resBody.err_msg = "It is not your turn to play!";
        return resBody;
    }  

    //Check if the chosen card exists in either the user's hand or the center
    const player = await User.findOne({_id : req.body.user_id});
    if (player == null) {
        resBody.err_msg = "Error: User not found in database.";
        return resBody;
    }
    if (player.hand.indexOf(req.body.chosen_card) == -1 && 
        game.played_pile.indexOf(req.body.chosen_card) == -1) {

        if (player.untouched_hand.indexOf(req.body.chosen_card) != -1 && player.hand.length == 0) {
            fromUntouched = true;
        } else {
            resBody.err_msg = "The selected card doesn't exist in your hand!";
            return resBody;
        }
        
    }

    //Add the cards to the players hand and remove the chosen card
    if (fromUntouched) {
        player.untouched_hand = player.untouched_hand.map((card) => {return (card == req.body.chosen_card) ? -1 : card});
        player.hand = [req.body.chosen_card, ...game.played_pile];
    } else {
        player.hand = [...player.hand, ...game.played_pile];
    }
    game.played_pile = [...player.hand.splice(player.hand.indexOf(req.body.chosen_card), 1)];
     

    //Update the turn to the next player
    let playerIndex = game.players.indexOf(req.body.user_id);
    playerIndex = (playerIndex + 1) == game.players.length ? 0 : (playerIndex + 1);
    game.turn_at = game.players[playerIndex];    

    //Check if the player is fixing their failed hidden play
    if (player.failed_hidden_play) {
        player.failed_hidden_play = false;
    }

    //Update the database with the changes
    try {
        await User.updateOne(
            {_id : req.body.user_id},
            {$set : {
                hand : player.hand, 
                failed_hidden_play : player.failed_hidden_play,
                untouched_hand : player.untouched_hand
            }}
        );
        await Game.updateOne(
            {room_id : req.params.gameID},
            {$set : {
                played_pile : game.played_pile,
                turn_at : game.turn_at,
                time_updated : Date.now()
            }}
        );
    } catch (error) {
        resBody.err_msg = "Error with updating the player hand in the database";
        return resBody;
    }

    resBody.success = true;
    return resBody;

}


const drawCardHandler = async function(req) {
    const resBody = {
        success : false,
        err_msg : "",
        card_drawn : -1
    }

    //Attempt to find the game
    const game = await Game.findOne({room_id : req.params.gameID});
    if (game == null) {
        resBody.err_msg = "Room does not exist!"
        return resBody;
    }

    //Check if the user exists in the game room
    if (game.players.indexOf(req.body.user_id) == -1) {
        resBody.err_msg = "You are not in this game room!";
        return resBody;
    }

    //Check if the game has started
    if (!game.started) {
        resBody.err_msg = "The game has not started yet!";
        return resBody;
    }

    //Check if it's still the swapping phase
    if (game.in_swap_phase) {
        resBody.err_msg = "The game is still in the swapping phase. Wait until everyone has locked in."
        return resBody;
    } 

    //Check if the draw pile has any cards left
    if (game.deck.length == 0) {
        resBody.err_msg = "The draw pile has no more cards.";
        return resBody;
    }

    //Draw the card into the user's hand
    const player = await User.findOne({_id : req.body.user_id});
    if (player == null) {
        resBody.err_msg = "Error: User not found in database.";
        return resBody;
    }
    let drawnCard = await Game.drawCard(req.params.gameID, 1, game);
    if (drawnCard.length == 0) {
        resBody.err_msg = "Error when drawing card from the database";
        return resBody;
    }
    player.hand.push(drawnCard[0]);
    resBody.card_drawn = drawnCard[0];

    //Update the game state 
    try {
        await User.updateOne(
            {_id : req.body.user_id},
            {$set : {hand : player.hand}}
        );
        await Game.updateOne(
            {room_id : req.params.gameID},
            {$set : {time_updated : Date.now()}}
        );
    } catch (error) {
        resBody.err_msg = "Error with saving the card to the player's hand";
        return resBody;
    }

    resBody.success = true;
    return resBody;
}

const getGameStateHandler = async function(req) {
    const resBody = {
        found : true,
        err_msg : "",
        other_players : [],
        everyone_swapped : false,
        hand : [],
        untouched_hand : [],
        hidden_hand : [],
        draw_deck_size : 0,
        discard_pile : [],
        played_pile : [],
        turn_at : "",
        playable_cards : [],
        is_burn : false,
        is_won : false,
        winner : ""
    }


    //Attempt to find the game
    const game = await Game.findOne({room_id : req.params.gameID});
    if (game == null) {
        resBody.err_msg = "Room does not exist!";
        resBody.found = false;
        return resBody;
    }

    const user_id = req.body.user_id === undefined ? req.params.user_id : req.body.user_id;

    //Check if the user exists in the game room
    if (game.players.indexOf(user_id) == -1) {
        resBody.err_msg = "You are not in this game room!";
        return resBody;
    }    

    //Attempt to find the user
    const player = await User.findOne({_id : user_id});
    if (player == null) {
        resBody.err_msg = "Cannot find the user in the database!";
        return resBody;
    }    

    //Get the list of players
    const playerList = await Game.getPlayerList(req.params.gameID, game);
    resBody.everyone_swapped = true;
    for (let plyr of playerList) {
        resBody.other_players.push({
            player : plyr.username,
            num_hand_cards : plyr.hand.length,
            untouched_hand : plyr.untouched_hand,
            hidden_hand : plyr.hidden_hand.map((val) => {return (val == -1)}),
            swapped : plyr.swapped
        });

        if (game.turn_at == plyr._id.toString()) {
            resBody.turn_at = plyr.username;
        }

        if (!plyr.swapped) {
            resBody.everyone_swapped = false;
        }
    }

    resBody.hand = player.hand;
    resBody.untouched_hand = player.untouched_hand;
    resBody.hidden_hand = player.hidden_hand.map((val) => {return (val == -1)});
    resBody.draw_deck_size = game.deck.length;
    resBody.discard_pile = game.discard;
    resBody.played_pile = game.played_pile;
    resBody.is_burn = Game.isBurn(game.played_pile);

    if (game.played_pile.length == 0) {
        resBody.playable_cards = [...DECK_NUM];
    } else if (game.played_pile.length == 1) {
        resBody.playable_cards = PLAYABLE[game.played_pile[0]];
    } else {
        let index = game.played_pile.length - 1;
        let topCard = game.played_pile[index];
        while (topCard % 13 == 3) {
            if (index == 0) {
                break;
            }
            index -= 1;
            topCard = game.played_pile[index];
        }
        resBody.playable_cards = PLAYABLE[topCard];
    }


    //Check for if a player has won already
    if (game.deck.length == 0) {

        for (let plyr of playerList) {
            let newUntouched = plyr.untouched_hand.map((val) => {return (val == -1 ? true : false)});
            let newHidden = plyr.hidden_hand.map((val) => {return (val == -1 ? true : false)})
            if (plyr.hand.length == 0 && !plyr.failed_hidden_play && newUntouched.indexOf(false) == -1 && newHidden.indexOf(false) == -1) {
                resBody.is_won = true;
                resBody.winner = plyr.username;
            }
        }
        
    }

    if (resBody.is_won) {
        await Game.updateOne(
            {room_id : req.params.gameID},
            {$set : {game_ended : true}}
        );
    }

    return resBody;

}

const deleteGameHandler = async function(req) {
    const resBody = {
        success : false,
        err_msg : ""
    }

    const user_id = req.body.user_id === undefined ? req.params.user_id : req.body.user_id;

    //Attempt to find the game
    const game = await Game.findOne({room_id : req.params.gameID});
    if (game == null) {
        resBody.err_msg = "Room does not exist!"
        return resBody;
    }

    //Check if the user exists in the game room
    if (game.players.indexOf(user_id) == -1) {
        resBody.err_msg = "You are not in this game room!";
        return resBody;
    }
    
    //Attempt to delete the game
    try {
        if (await Game.deleteGame({room_id : req.params.gameID})) {
            resBody.success = true;
            return resBody;
        } 
    } catch (error) {
        resBody.err_msg = "Error with removing the game and users from the database.";
        return resBody;
    }

    resBody.success = true;
    return resBody;
}



module.exports = { 
    swapHandler, 
    lockInHandler, 
    playCardHandler, 
    playMultipleCardsHandler,
    playHiddenCardHandler, 
    takeFromCenterHandler,
    drawCardHandler,
    getGameStateHandler,
    deleteGameHandler 
};