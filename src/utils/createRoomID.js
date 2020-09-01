module.exports = function(roomIDList) {
    let room_id = Math.random().toString(36).substring(7);
    while (roomIDList.indexOf(room_id) != -1) {
        room_id = Math.random().toString(36).substring(7);
    }
    return room_id;
}