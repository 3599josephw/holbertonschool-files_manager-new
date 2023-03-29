const sha1 = require('sha1');
const mongodb = require('mongodb');
const redis = require('../utils/redis');
const db = require('../utils/db');

class UsersContoller {
  static async postNew(req, response) {
    const { email, password } = req.body;
    if (!email) {
      response.status(400).json({ error: 'Missing email' });
    }
    if (!password) {
      response.status(400).json({ error: 'Missing password' });
    }
    if (await db.users.findOne({ email })) {
      return response.status(400).json({ error: 'Already exist' });
    }
    const newUser = await db.users.insertOne({email, password: sha1(password) });
    return response.status(201).json({ id: newUser.insertedId, email });
  }

  static async getMe(req, response) {
    const xtoken = `auth_${req.header('X-Token')}`;
    const key = await redis.get(xtoken);
    if (!key) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    const user = await db.users.findOne({ _id: new mongodb.ObjectId(key) });
    return response.status(200).json({ id: user._id, email: user.email });
  }
}

module.exports = UsersContoller;
