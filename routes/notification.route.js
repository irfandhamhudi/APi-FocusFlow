import express from "express";
import {
  getUserNotifications,
  createNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from "../controllers/notification.controllers.js";
import authMiddleware from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", authMiddleware, getUserNotifications);
router.post("/", authMiddleware, createNotification);
router.patch("/:id", authMiddleware, markNotificationAsRead);
router.put("/mark-all", authMiddleware, markAllNotificationsAsRead); // Ubah ke PUT
router.delete("/:id", authMiddleware, deleteNotification);

export default router;
