const Message = require("../models/Message");
const User = require("../models/User");
const Friend = require("../models/Friend");

// Get Messages Between Friends
exports.getMessages = async (req, res) => {
  try {
    const { friendId } = req.params;
    if (!friendId)
      return res.status(400).json({ message: "Friend ID is required" });

    const messages = await Message.find({
      $or: [
        { senderId: req.userId, receiverId: friendId },
        { senderId: friendId, receiverId: req.userId },
      ],
    }).sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Send Message to a Friend
exports.sendMessage = async (req, res) => {
  try {
    const { content, receiverId } = req.body;
    if (!content || !receiverId)
      return res
        .status(400)
        .json({ message: "Message content and receiver ID are required" });

    const newMessage = new Message({
      senderId: req.userId,
      receiverId,
      content,
    });

    await newMessage.save();
    res.status(201).json(newMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const AWS = require("aws-sdk");

require("dotenv").config();

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.S3_REGION,
});

exports.uploadMediaMessage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const fileContent = req.file.buffer;
    const fileKey = `media/${Date.now()}-${req.file.originalname}`;

    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: fileKey,
      Body: fileContent,
      ContentType: req.file.mimetype,
    };

    const uploadResult = await s3.upload(params).promise();

    // Save media message to DB
    const message = new Message({
      senderId: req.user.id,
      recipientId: req.body.recipientId,
      mediaUrl: uploadResult.Location,
      mediaType: req.file.mimetype.startsWith("image") ? "image" : "file",
    });

    await message.save();
    res.status(200).json(message);
  } catch (error) {
    console.error("Error uploading media:", error);
    res.status(500).json({ error: "Failed to upload media" });
  }
};
