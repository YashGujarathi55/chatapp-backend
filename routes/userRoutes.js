const express = require("express");
const multer = require("multer");
const { verifyToken } = require("../middleware/authMiddleware");
const userController = require("../controllers/userController");
const chatController = require("../controllers/chatController");

const router = express.Router();

// Multer configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// User routes
router.post("/auth/signup", userController.signup);
router.post("/auth/login", userController.login);
router.put(
  "/update-profile-picture",
  verifyToken,
  upload.single("file"),
  userController.updateProfilePicture
);
router.put("/update-password", verifyToken, userController.updatePassword);
router.get("/friends", verifyToken, userController.getFriends);
router.post("/add-friend", verifyToken, userController.addFriend);
router.post("/remove-friend", verifyToken, userController.removeFriend);
router.get("/users", verifyToken, userController.getUsers);
// Chat routes
router.get("/messages/:friendId", verifyToken, chatController.getMessages);
router.post("/messages", verifyToken, chatController.sendMessage);

router.post(
  "/media/upload",
  verifyToken,
  upload.single("file"),
  chatController.uploadMediaMessage
);
// Export the router
module.exports = router;
