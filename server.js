const express = require("express");
const http = require("http");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const socketHandler = require("./socket");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use("/api", require("./routes/userRoutes"));

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

const server = http.createServer(app);

// Initialize socket handler
const io = socketHandler(server);

server.listen(5000, () => {
  console.log("Server running on port 5000");
});
