const mongoose = require('mongoose');
const User = require('./User');
const { DECK_NUM, PLAYABLE } = require('../constants/constants.js');
const randomInt = require('../utils/getRandomInt');

const GameSchema = mongoose.Schema({
    room_id: {
        type: String,
        required: true
    },
    players: {
        type: [String],
        required: true
    },
    started: {
        type: Boolean,
        required: true,
        default: false
    },
    deck: {
        type: [Number],
        required: false,
        default: DECK_NUM
    },
    played_pile: {
        type: [Number],
        required: false
    },
    discard: {
        type: [Number],
        required: false
    },
    turn_at: {
        type: String,
        required: false,
        default: ""
    },
    in_swap_phase: {
        type: Boolean,
        required: false,
        default: true
    },
    time_updated: {
        type: Number,
        required: true,
        default: Date.now()
    }, 
    game_ended : {
        type: Boolean,
        required: false,
        default: false
    }
}); 

GameSchema.statics.getPlayerList = async function(roomId, game=null) {
    if (game == null) {
        try {
            game = await this.findOne({room_id : roomId});
        } catch(error) {
            return [];
        }
    }

    let players = [];

    if (game == null) {
        return players;
    }

    for (let player of game.players) {
        try {
            players.push(await User.findOne({_id : player}));
        } catch(error) {
            return [];
        }
    }
    return players;
};

GameSchema.statics.deleteGame = async function(condition) {
    try {
        let game = await this.findOne(condition);
        for (let player of game.players) {
            //console.log((await User.findOne({_id : player})).username );
            await User.deleteOne({_id : player});
        }
        await this.deleteOne(condition);
    } catch(error) {
        return false;
    } 
    
    return true;
}

GameSchema.statics.drawCard = async function(roomId, numCards, game=null) {
    if (game == null) {
        try {
            game = await this.findOne({room_id : roomId});
        } catch (error) {
            return [];
        }
    } 
    let drawnCards = [];
    let deck = [...game.deck];
    var i;
    for (i = 0; i < numCards; i++) {
        let drawIndex = randomInt(deck.length);
        drawnCards.push(...deck.splice(drawIndex, 1));
    }

    try {
        await this.updateOne(
            {room_id : roomId},
            {$set : {deck : deck}}
        );
        return drawnCards;
    } catch (error) {
        return [];
    }
}

GameSchema.statics.playable = async function(roomId, card, game=null) {
    if (game == null) {
        try {
            game = await this.findOne({room_id : roomId});
        } catch (error) {
            return false;
        }
    }

    if (game.played_pile.length == 0) {
        return true;
    }

    let topCard;
    if (game.played_pile.length > 1) {
        let index = game.played_pile.length - 1;
        topCard = game.played_pile[index];
        while (topCard % 13 == 3) {
            if (index == 0) {
                break;
            }
            index -= 1;
            topCard = game.played_pile[index];
        }
    } else {
        topCard = game.played_pile[0];
    }

    return (PLAYABLE[topCard].indexOf(card) != -1);

}

GameSchema.statics.isBurn = function(play_pile) {

    if (play_pile.length == 0) {
        return false;
    }
 
    if (play_pile[play_pile.length - 1] % 13 == 10) {
        return true;
    }

    if (play_pile.length < 4) {
        return false;
    }

    let newPlayPile = [play_pile[0]];
    let i;
    for (i = 1; i < play_pile.length; i++) {
        if (play_pile[i] % 13 == 3) {
            newPlayPile.push(newPlayPile[newPlayPile.length - 1] % 13);
        } else {
            newPlayPile.push(play_pile[i] % 13);
        }
    }

    let top4 = newPlayPile.slice(newPlayPile.length - 4, newPlayPile.length);

    return (top4[0] == top4[1] && top4[1] == top4[2] && top4[2] == top4[3]);

}

module.exports = mongoose.model('Game', GameSchema); 