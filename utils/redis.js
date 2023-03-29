const redis = require("redis");
const { promisify } = require("util");


class RedisClient {
  constructor() {
    this.client = redis.createClient();
    this.client.on('error', (err) => { console.log(err); });
  }

  isAlive() {
    return this.client.connected;
  }

  async get(key) {
    const getKey = promisify(this.client.get).bind(this.client);
    return getKey(key);
  }

  async set(key, value, duration) {
    const setKey = promisify(this.client.set).bind(this.client);
    return setKey(key, value, 'EX', duration);
  }

  async del(key) {
    const deleteKey = promisify(this.client.del).bind(this.client);
    return deleteKey(key);
  }
}

const redisClient = new RedisClient();
module.exports = redisClient;
