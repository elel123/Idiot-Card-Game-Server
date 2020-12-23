const express = require('express');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const cors = require('cors');
const mongoose = require('mongoose');
const socketio = require('socket.io');

const { DATABASE_URL, SERVER_PORT } = require("./constants/envConstants.js");
const userRoutes = require('./routes/user.js');
const roomRoutes = require('./routes/room.js');
const gameRoutes = require('./routes/game.js');
const { emit } = require('./models/user.js');


//App setup
const app = express();

app.use(morgan('dev'));

app.use(cors());

app.use(bodyParser.json());

app.use('/', userRoutes);

app.use('/room', roomRoutes);

app.use('/game', gameRoutes);

//Connect to DB
mongoose.connect(DATABASE_URL, { useNewUrlParser: true, useUnifiedTopology: true })
.catch(error => {
    console.log("error: ", error);
})
.then( async () => {

    console.log('Connected to DB!'); 
    var server = app.listen(SERVER_PORT, function() {
        console.log(`listening to requests on port ${SERVER_PORT}`);
    });

    const io =  socketio(server);
    //Socket setup
    io.on('connection', (socket) => {
        console.log("We have a new connection!");

        socket.on('join', ({username, game_id}) => {
            console.log(username, game_id);
            socket.join(game_id);
            socket.to(game_id).emit('player-join', {username: username});
        })

        socket.on('leave', ({username, game_id}) => {
            console.log(username, game_id);
            socket.to(game_id).emit('player-leave', {username: username});
        });

        socket.on('leave-game', ({username, game_id}) => {
            socket.to(game_id).emit('player-left-game', {username: username});
        });

        socket.on('remove', ({removed_player, game_id}) => {
            socket.to(game_id).emit('removed-player', {removed_player : removed_player});
        });

        socket.on('start', ({game_id}) => {
            socket.to(game_id).emit('game-start');
        });

        socket.on('edit-settings', ({game_id, settings}) => {
            socket.to(game_id).emit('settings-changed', {settings : settings});
        });

        socket.on('swap', ({game_id, username}) => {
            socket.to(game_id).emit('player-swap', {username : username});
        });

        socket.on('lock-in', ({game_id, username}) => {
            socket.to(game_id).emit('player-ready', {username : username});
        });

        socket.on('play-card', ({game_id, card, username, playable, is_burn}) => {
            socket.to(game_id).emit('player-played', {card : card, username : username, playable : playable, is_burn : is_burn});
        });

        socket.on('play-multiple', ({game_id, cards, username, is_burn}) => {
            socket.to(game_id).emit('player-played-mult', {cards : cards, username : username, is_burn : is_burn});
        });

        socket.on('take-center', ({game_id, username, is_burn}) => {
            socket.to(game_id).emit('player-took-center', {username : username, is_burn});
        });

        socket.on('draw-card', ({game_id, username}) => {
            socket.to(game_id).emit('player-drew-card', {username : username});
        });

        socket.on('send-message', ({game_id, username, message}) => {
            socket.to(game_id).emit('sent-message', {username : username, message : message});
        });

        socket.on('ping-user', ({game_id, username, pinger}) => {
            socket.to(game_id).emit('user-pinged', {username : username, pinger : pinger});
        });

        socket.on('new-room', ({game_id, new_game_id}) => {
            console.log("new room: " + new_game_id);
            socket.to(game_id).emit('created-new-room', {new_game_id : new_game_id});
        });

        socket.on('disconnect-from-room', ({game_id}) => {
            socket.leave(game_id);
        });

        socket.on('data-lost', ({game_id}) => {
            socket.to(game_id).emit('game-data-lost');
        });

        socket.on('disconnect', () => {
            console.log('User has left.');
        });
    })

});

