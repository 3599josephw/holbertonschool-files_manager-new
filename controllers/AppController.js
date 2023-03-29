const redis = require('../utils/redis');
const db = require('../utils/db');

class AppController {
  static async getStatus(req, response) {
    const status = {
      redisAlive: redis.isAlive(),
      dbAlive: db.isAlive(),
    };
    response.status(200).json(status);
  }

  static async getStats(req, response) {
    const statCounts = {
      userCount: await db.nbUsers(),
      fileCount: await db.nbFiles(),
    };
    response.status(200).json(statCounts);
  }
}

module.exports = AppController;
