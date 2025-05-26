import jwt from "jsonwebtoken";
import User from "../models/user.models.js";

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies.jwt; // Mendapatkan token dari cookie
    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "No token provided, unauthorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id); // Ambil user berdasarkan ID dari token

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    req.user = user; // Menyimpan data user di req
    next();
  } catch (error) {
    res
      .status(401)
      .json({ success: false, message: "Invalid token", error: error.message });
  }
};

export default authMiddleware;
