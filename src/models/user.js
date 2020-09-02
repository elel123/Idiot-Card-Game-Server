const mongoose = require('mongoose');

const UserSchema = mongoose.Schema({
    username: {
        type: String,
        required: true,
        default: "unnamed player"
    },
    hand: {
        type: [Number],
        required: false
    },
    untouched_hand: {
        type: [Number],
        required: false
    },
    hidden_hand: {
        type: [Number],
        required: false
    },
    swapped: {
        type: Boolean,
        required: false,
        default: false
    },
    failed_hidden_play: {
        type: Boolean,
        required: false,
        default: false
    }   
}); 

module.exports = mongoose.model('User', UserSchema); 