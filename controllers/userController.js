const User = require("../models/User");
const Token = require("../models/Token");
const Friend = require("../models/Friend");
const Message = require("../models/Message");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const dotenv = require("dotenv");
const AWS = require("aws-sdk");
const { Types } = require("mongoose");
const mongoose = require("mongoose");
dotenv.config();
const ObjectID = Types.ObjectId;
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.S3_REGION,
});
async function testHash() {
  let password = "yash5555";
  const hashedPassword = await bcrypt.hash(password, 10);
  const enteredPassword = "yash5555";
  const storedHash =
    "$2b$10$pzVoq0NA1UeG7HEqT0tz7.Y56qIX1ZShENiu18muVDO0I8YuZfbua";

  const isMatch = await bcrypt.compare(enteredPassword, storedHash);
  console.log("Password Match Test:", isMatch);
  console.log("hashedPassword :>> ", hashedPassword);
}

exports.signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword });
    await user.save();

    // Generate token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    // Save token in DB
    await new Token({ userId: user._id, token }).save();

    res.status(201).json({ token, user });
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

    console.log("User found:", user); // Debugging
    console.log("Entered Password:", password);
    console.log("Stored Hashed Password:", user.password);
    testHash();

    const isMatch = await bcrypt.compare(password, user.password);
    console.log("Password Match:", isMatch);

    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    // Remove old tokens before saving a new one
    await Token.deleteMany({ userId: user._id });
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
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    await s3.send(command);

    const user = await User.findById(req.userId);
    // user.profilePicture = `https://${BUCKET_NAME}.s3.me-central-1.amazonaws.com/${key}`;
    await user.save();

    res.status(200).json({
      message: "Profile picture updated successfully",
      profilePicture: `/${key}`,
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
    const friends = await Friend.find({ userId: req.userId })
      .populate("friendId", "name profilePicture")
      .lean(); // Convert Mongoose docs to plain objects

    // Filter out any null friendId values
    const friendList = friends
      .filter((f) => f.friendId) // Ensure friendId is not null
      .map((f) => ({
        _id: f.friendId._id,
        name: f.friendId.name,
        profilePicture: f.friendId.profilePicture,
      }));

    res.status(200).json(friendList);
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

// Get Users List

exports.getUsers = async (req, res) => {
  try {
    const userId = req.userId;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    const objectIdUserId = new mongoose.Types.ObjectId(userId); // Convert properly

    // console.log("req.userId :>> ", objectIdUserId);

    // Find all friends where userId is the current user
    const friends = await Friend.find({ userId: objectIdUserId }).select(
      "friendId"
    );

    // Extract only friend IDs into an array
    const friendIds = friends.map(
      (friend) => new mongoose.Types.ObjectId(friend.friendId)
    );
    const matchFilter = {
      _id: { $ne: objectIdUserId }, // Exclude yourself
    };

    // Add friends to exclusion if they exist
    if (friendIds.length > 0) {
      matchFilter._id.$nin = friendIds.map(
        (id) => new mongoose.Types.ObjectId(id)
      );
    }
    const pipeline = [
      {
        $match: matchFilter,
      },
    ];

    // Apply search filter if query exists
    if (req.query.search) {
      pipeline.push({
        $match: { name: { $regex: req.query.search, $options: "i" } },
      });
    }

    pipeline.push(
      { $project: { name: 1, profilePicture: 1 } }, // Select only required fields
      { $limit: 10 },
      { $skip: 0 }
    );

    // console.log("Pipeline :>> ", JSON.stringify(pipeline));
    const users = await User.aggregate(pipeline);
    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: error.message });
  }
};
