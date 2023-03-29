const mongodb = require('mongodb');
const uuid4 = require('uuid4');
const fs = require('fs');
const db = require('../utils/db');
const redis = require('../utils/redis');

class FilesController {
  static async postUpload(req, response) {
    const xtoken = `auth_${req.header('X-Token')}`;
    const key = await redis.get(xtoken);
    if (!key) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const { name, type, parentId = 0, isPublic = false, data } = req.body;

    if (!name) {
      return response.status(400).json({ error: 'Missing name' });
    }

    if (!type || !(['folder', 'file', 'image'].includes(type))) {
      return response.status(400).json({ error: 'Missing type' });
    }

    if (!data && type !== 'folder') {
      return response.status(400).json({ error: 'Missing data' });
    }

    if (parentId !== 0) {
      const project = new mongodb.ObjectId(parentId);
      const file = await db.files.findOne({ _id: project });

      if (!file) {
        return response.status(400).json({ error: 'Parent not found' });
      }
      if (file.type !== 'folder') {
        return response.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    let newFile;
    if (type === 'folder') {
      newFile = await db.files.insertOne({
        userId: new mongodb.ObjectId(key),
        name,
        type,
        isPublic,
        parentId,
      });
    } else {
      const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';
      if (!fs.existsSync(FOLDER_PATH)) {
        fs.mkdirSync(FOLDER_PATH);
      }
      const localPath = `${FOLDER_PATH}/${uuid4()}`;
      const buffer = Buffer.from(req.body.data, 'base64').toString('utf-8');
      await fs.promises.writeFile(localPath, buffer);
      newFile = await db.files.insertOne({
        userId: new mongodb.ObjectId(key),
        name,
        type,
        isPublic,
        parentId,
        localPath,
      });
    }
    return response.status(201).send({
      id: newFile.insertedId, userId: key, name, type, isPublic, parentId,
    });
  }

  static async getShow(req, response) {
    const xtoken = `auth_${req.header('X-Token')}`;
    const key = await redis.get(xtoken);
    if (!key) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    const file = await db.files.findOne({
      _id: new mongodb.ObjectId(req.params.id),
    });
    if (!file || key.toString() !== file.userId.toString()) {
      return response.status(404).json({ error: 'Not found' });
    }
    return response.json({ ...file });
  }

  static async getIndex(req, response) {
    const xtoken = `auth_${req.header('X-Token')}`;
    const key = await redis.get(xtoken);

    if (!key) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const { parentId, page = 0 } = req.query;

    let files;

    if (parentId) {
      files = await db.files.aggregate([
        { $match: { parentId: new mongodb.ObjectId(parentId) } },
        { $skip: page * 20 },
        { $limit: 20 },
      ]).toArray();
    } else {
      files = await db.files.aggregate([
        { $match: { userId: new mongodb.ObjectId(new mongodb.ObjectId(key)) } },
        { $skip: page * 20 },
        { $limit: 20 },
      ]).toArray();
    }
    return response.json(files.map((file) => ({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    })));
  }

  static async putPublish(req, response) {
    const xtoken = `auth_${req.header('X-Token')}`;
    const key = await redis.get(xtoken);
    if (!key) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    const file = await db.files.findOne({
      _id: new mongodb.ObjectId(req.params.id),
    });
    if (!file || key.toString() !== file.userId.toString()) {
      return response.status(404).json({ error: 'Not found' });
    }
    file.isPublic = true;
    await db.files.updateOne({ _id: file._id }, { $set: { isPublic: true } });
    return response.json({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    });
  }

  static async putUnpublish(req, response) {
    const xtoken = `auth_${req.header('X-Token')}`;
    const key = await redis.get(xtoken);
    if (!key) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    const file = await db.files.findOne({
      _id: new mongodb.ObjectId(req.params.id),
    });
    if (!file || key.toString() !== file.userId.toString()) {
      return response.status(404).json({ error: 'Not found' });
    }
    file.isPublic = false;
    await db.files.updateOne({ _id: file._id }, { $set: { isPublic: true } });
    return response.json({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    });
  }

  static async getFile(req, response) {
    const file = await db.files.findOne({
      _id: new mongodb.ObjectId(req.params.id),
    });
    const xtoken = `auth_${req.header('X-Token')}`;
    const key = await redis.get(xtoken);
    if (!file || (!file.isPublic && (!key
      || file.userId.toString() !== key.toString()))) {
      return response.status(404).json({ error: 'Not found' });
    }
    if (file.type === 'folder') {
      return response.status(400).json({ error: "A folder doesn't have content" });
    }
    if (!fs.existsSync(file.localPath)) {
      return response.status(404).json({ error: 'Not found' });
    }
    const text = fs.readFileSync(file.localPath);
    return response.status(200).send(text);
  }
}

module.exports = FilesController;
