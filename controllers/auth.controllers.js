import User from "../models/user.models.js";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import sendEmail from "../utils/send.email.js";
import jwt from "jsonwebtoken";
import cloudinary from "../config/cloudinary.js";
import Notification from "../models/notification.model.js";

// Register User
export const registerUser = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res
        .status(400)
        .json({ success: false, message: "Email Already Exists." });
    }

    const usernameExists = await User.findOne({ username });
    if (usernameExists) {
      return res
        .status(400)
        .json({ success: false, message: "Username Already Exists." });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number.",
      });
    }

    const otp = crypto.randomInt(100000, 999999).toString();

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      otp,
    });

    const subject = "Email Verification";
    const message = otp;
    await sendEmail(email, subject, message, username);

    res.status(201).json({
      success: true,
      message:
        "Registration successful. Please check your email to get the OTP.",
      userId: user._id,
      welcomeMessage: `Welcome to FocusFlow, ${username}! We're excited to have you on board. Please verify your email to get started.`,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Failed to register user." });
  }
};

// Verify OTP
export const verifyOtp = async (req, res) => {
  const { otp } = req.body;

  const user = await User.findOne({ otp });

  if (user && user.otp === otp) {
    user.isVerified = true;
    user.otp = undefined;
    await user.save();

    const userData = user.toObject();
    delete userData.password;

    res.status(200).json({
      success: true,
      data: userData,
      message: "OTP verified successfully",
    });
  } else {
    res.status(400).json({ success: false, message: "Invalid OTP" });
  }
};

// Resend OTP
export const resendOtp = async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  if (user.isVerified) {
    return res
      .status(400)
      .json({ success: false, message: "Account is already verified" });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  user.otp = otp;
  await user.save();

  try {
    const subject = "Email Verification";
    const message = otp;
    await sendEmail(user.email, subject, message, user.username);
    res
      .status(200)
      .json({ success: true, message: "New OTP sent successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to send new OTP" });
  }
};

// Login User
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    if (!user.isVerified) {
      return res
        .status(401)
        .json({ success: false, message: "User not verified" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "30d",
    });

    res.cookie("jwt", token, {
      httpOnly: true,
      secure: true, // Selalu true di produksi untuk HTTPS
      sameSite: "none", // Diperlukan untuk lintas situs
      maxAge: 1000 * 60 * 60 * 24 * 5, // 5 hari
      domain:
        process.env.NODE_ENV === "production" ? ".yourdomain.com" : undefined,
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// Get Me (User Info from Middleware) - Perbaiki Notifikasi Welcome
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Cek apakah ini pengguna baru DAN belum ada notifikasi welcome
    if (user.isNewUser) {
      const existingWelcomeNotification = await Notification.findOne({
        user: user._id,
        message: {
          $regex: `Welcome to FocusFlow, ${user.username}!`,
          $options: "i",
        },
      });

      if (!existingWelcomeNotification) {
        // Buat notifikasi welcome jika belum ada
        await Notification.create({
          user: user._id,
          message: `Welcome to FocusFlow, ${user.username}! We're excited to have you here. Explore your dashboard to get started.`,
          actor: user._id,
        });
      }

      // Tandai pengguna sebagai bukan pengguna baru
      user.isNewUser = false;
      await user.save();
    }

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Failed to retrieve user data" });
  }
};

// Logout User
export const logout = async (req, res) => {
  try {
    res.clearCookie("jwt", {
      httpOnly: true,
      secure: true, // Selalu true di produksi untuk HTTPS
      sameSite: "none", // Diperlukan untuk lintas situs
      maxAge: 0, // Hapus cookie
    });

    res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to logout",
      error: error.message,
    });
  }
};

// Get All Users (Hanya pengguna yang sudah diverifikasi)
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ isVerified: true }).select("-password");
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Failed to retrieve users" });
  }
};

// Update User - Tambahkan Notifikasi Sukses
export const updateUser = async (req, res) => {
  try {
    const { username, firstname, lastname } = req.body;

    if (!username) {
      return res
        .status(400)
        .json({ success: false, message: "Username is required" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const usernameExists = await User.findOne({
      username,
      _id: { $ne: user._id },
    });
    if (usernameExists) {
      return res
        .status(400)
        .json({ success: false, message: "Username already exists" });
    }

    user.username = username;
    user.firstname = firstname || "";
    user.lastname = lastname || "";

    if (req.file) {
      if (user.avatarId) {
        try {
          await cloudinary.uploader.destroy(user.avatarId, {
            resource_type: "image",
          });
        } catch (error) {
          console.error("Failed to delete old avatar from Cloudinary:", error);
        }
      }

      user.avatar = req.file.path;
      user.avatarId = req.file.filename;
    }

    await user.save();

    const userData = user.toObject();
    delete userData.password;

    // Buat notifikasi sukses update
    await Notification.create({
      user: user._id,
      message: `Your profile has been updated successfully, ${user.username}!`,
      actor: user._id,
    });

    res.status(200).json({
      success: true,
      message: "User profile updated successfully!",
      data: userData,
    });
  } catch (error) {
    console.error(error);
    if (error.message.includes("Only JPEG, PNG, and GIF files are allowed!")) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    res.status(500).json({
      success: false,
      message: "Failed to update user",
      error: error.message,
    });
  }
};
