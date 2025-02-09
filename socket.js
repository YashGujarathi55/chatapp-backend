const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const Message = require("./models/Message");
const User = require("./models/User");

let onlineUsers = {};

const initSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "http://localhost:3000",
      methods: ["GET", "POST"],
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.query.token;
    if (!token) {
      return next(new Error("Authentication error"));
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return next(new Error("Authentication error"));
      }
      socket.userId = decoded.userId;
      next();
    });
  });

  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.userId}`);
    onlineUsers[socket.userId] = socket.id;

    // Emit online status to friends
    socket.broadcast.emit("userOnline", { userId: socket.userId });

    // Handle joining chat rooms
    socket.on("joinRoom", (friendId) => {
      const roomId = [socket.userId, friendId].sort().join("-");
      socket.join(roomId);
      console.log(`User ${socket.userId} joined room ${roomId}`);
    });

    // Handle sending messages
    socket.on("sendMessage", async (data) => {
      const { recipientId, text } = data;
      const message = new Message({
        senderId: socket.userId,
        recipientId,
        text,
      });
      await message.save();

      const roomId = [socket.userId, recipientId].sort().join("-");
      io.to(roomId).emit("newMessage", message);

      // Notify the recipient if offline
      if (!onlineUsers[recipientId]) {
        console.log(`User ${recipientId} is offline. Message saved.`);
      }
    });

    socket.on("sendMediaMessage", async (data) => {
      const { recipientId, mediaUrl, mediaType } = data;

      // Save media message in MongoDB
      const message = new Message({
        senderId: socket.userId,
        recipientId,
        mediaUrl,
        mediaType,
      });
      await message.save();

      const roomId = [socket.userId, recipientId].sort().join("-");
      io.to(roomId).emit("newMediaMessage", message);

      if (!onlineUsers[recipientId]) {
        console.log(`User ${recipientId} is offline. Media message saved.`);
      }
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.userId}`);
      delete onlineUsers[socket.userId];
      socket.broadcast.emit("userOffline", { userId: socket.userId });
    });
  });

  return io;
};

module.exports = initSocket;
