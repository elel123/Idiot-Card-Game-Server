exports.DATABASE_URL = process.env.MONGO_URL || this.LOCAL_DB_URL;
exports.LOCAL_DB_URL = "mongodb://localhost:27017/cardgame";
exports.SERVER_PORT = process.env.PORT || 4000;

