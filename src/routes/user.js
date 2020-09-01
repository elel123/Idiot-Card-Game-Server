const express = require('express');
const router = express.Router();
const User = require('../models/User');
const {PLAYABLE} = require('../constants/constants');

router.get('/user', async (req, res) => {
    try {
        const users = await User.find();
        res.json(users);
    } catch(error) {
        res.json({message:err});
    }
});

router.get('/user/:id', async (req, res) => {
    try {
        const users = await User.findOne({_id: req.params.id});
        res.json(users);
    } catch(error) {
        res.json({message:err});
    }
});

router.post('/user', async (req, res) => {
    const user = new User({
        username: req.body.username
    });

    try {
        const savedPost = await user.save();
        res.json(savedPost);
    } catch(error) {
        res.json({ message: err });
    }
});

router.delete('/user/:id', async (req, res) => {
    try {
        const removedPost = await User.remove({_id: req.params.id});
        res.json(removedPost);
    } catch(error) {
        res.json({message: error});
    }
});

router.patch('/user/:id', async (req, res) => {
    try {
        const updatedPost = await User.updateOne(
            {_id: req.params.id},
            { $set: {username: req.body.username}}
        );
        res.json(updatedPost);
    } catch(error) {
        res.json({message: error});
    }
});

module.exports = router;

