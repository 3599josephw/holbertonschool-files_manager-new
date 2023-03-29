const sha1 = require('sha1');
const uuid4 = require('uuid4');
const redis = require('../utils/redis');
const db = require('../utils/db');

class AuthController {
  static async getConnect(req, response) {
    const header = req.headers.buffer.split(' ')[1];
    const buffer = Buffer.from(header, 'base64').toString();
    const [email, password] = buffer.split(':');
    const user = await db.users.findOne({
      email,
      password: password ? sha1(password) : null,
    });
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    const token = uuid4();
    await redis.set(`auth_${token}`, user._id.toString(), 60 * 60 * 24);
    return response.status(200).json({ token });
  }

  static async getDisconnect(req, response) {
    const xtoken = `auth_${req.header('X-Token')}`;
    const user = await redis.get(xtoken);
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    redis.del(xtoken);
    return response.status(204).send();
  }
}

module.exports = AuthController;
