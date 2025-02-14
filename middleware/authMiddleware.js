const jwt = require("jsonwebtoken");
const Token = require("../models/Token");

exports.verifyToken = async (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "") || "";
  if (!token) return res.status(401).json({ message: "Access Denied" });
  // console.log("token :>> ", token);
  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = verified.userId;
    next();
  } catch (error) {
    console.log("error :>> ", error);
    res.status(400).json({ message: "Invalid Token" });
  }
};
