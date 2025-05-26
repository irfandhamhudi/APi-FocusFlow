// Routes
import express from "express";
import {
  registerUser,
  verifyOtp,
  resendOtp,
  getAllUsers,
  loginUser,
  getMe,
  logout,
  updateUser,
} from "../controllers/auth.controllers.js";
import authMiddleware from "../middleware/auth.middleware.js";
import upload from "../middleware/upload.middleware.js";
const router = express.Router();

// Register User
router.post("/register", registerUser);

// Verify OTP
router.post("/verify-otp", verifyOtp);

// Resend OTP
router.post("/resend-otp", resendOtp);

// Login User
router.post("/login", loginUser);

// Get All Users
router.get("/users", authMiddleware, getAllUsers);

// Update User
router.put("/update", authMiddleware, upload, updateUser);

// Logout User
router.post("/logout", logout);

// Get Me
router.get("/me", authMiddleware, getMe);

export default router;
