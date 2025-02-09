const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "User",
  },
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "User",
  },
  messageType: {
    type: String,
    enum: ["text", "image", "video", "file"],
    default: "text",
  },
  mediaType: { type: String }, // e.g., "image", "video", "file"
  text: { type: String },
  createdAt: { type: Date, default: Date.now },
  isRead: { type: Boolean, default: false },
});

module.exports = mongoose.model("Message", messageSchema);
