const User = require("../models/User");
const Token = require("../models/Token");
const Friend = require("../models/Friend");
const Message = require("../models/Message");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const dotenv = require("dotenv");

dotenv.config();

const s3 = new S3Client({
  region: "me-central-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = "profound-storage";

// User Signup
exports.signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword });
    await user.save();
    res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// User Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    await new Token({ userId: user._id, token }).save();
    res.status(200).json({ token, user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Profile Picture
exports.updateProfilePicture = async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ message: "No file uploaded" });

    const key = `profile-pictures/${Date.now()}-${file.originalname}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    await s3.send(command);

    const user = await User.findById(req.userId);
    user.profilePicture = `https://${BUCKET_NAME}.s3.me-central-1.amazonaws.com/${key}`;
    await user.save();

    res
      .status(200)
      .json({
        message: "Profile picture updated successfully",
        profilePicture: user.profilePicture,
      });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add Friend
exports.addFriend = async (req, res) => {
  try {
    const { friendId } = req.body;
    if (!friendId)
      return res.status(400).json({ message: "Friend ID is required" });

    const friendExists = await Friend.findOne({ userId: req.userId, friendId });
    if (friendExists)
      return res.status(400).json({ message: "Already friends" });

    await new Friend({ userId: req.userId, friendId }).save();
    await new Friend({ userId: friendId, friendId: req.userId }).save();

    res.status(201).json({ message: "Friend added successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Remove Friend
exports.removeFriend = async (req, res) => {
  try {
    const { friendId } = req.body;
    await Friend.deleteOne({ userId: req.userId, friendId });
    await Friend.deleteOne({ userId: friendId, friendId: req.userId });

    res.status(200).json({ message: "Friend removed successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Friends List
exports.getFriends = async (req, res) => {
  try {
    const friends = await Friend.find({ userId: req.userId }).populate(
      "friendId",
      "name profilePicture"
    );
    res.status(200).json(friends);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Password
exports.updatePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Old password is incorrect" });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
