import asyncHandler from "express-async-handler";
import Notification from "../models/notification.model.js";
import mongoose from "mongoose";
import Task from "../models/task.model.js";

export const getUserNotifications = asyncHandler(async (req, res) => {
  if (!req.user || !req.user._id) {
    res.status(401);
    throw new Error("User not authenticated");
  }

  const notifications = await Notification.find({ user: req.user._id })
    .populate("task", "title")
    .populate("user", "username avatar") // Recipient's data
    .populate("actor", "username avatar") // Actor's data
    .sort({ createdAt: -1 });

  res.json(notifications);
});

export const createNotification = asyncHandler(async (req, res) => {
  const { user, task, message, actionBy } = req.body;

  if (!req.user || !req.user._id) {
    res.status(401);
    throw new Error("User not authenticated");
  }

  if (!user || !mongoose.Types.ObjectId.isValid(user)) {
    res.status(400);
    throw new Error("Valid user ID is required");
  }

  if (!task || !mongoose.Types.ObjectId.isValid(task)) {
    res.status(400);
    throw new Error("Valid task ID is required");
  }

  if (!message || typeof message !== "string" || message.trim() === "") {
    res.status(400);
    throw new Error("Message is required");
  }

  if (!actionBy || !mongoose.Types.ObjectId.isValid(actionBy)) {
    res.status(400);
    throw new Error("Valid actionBy ID is required");
  }

  const existingTask = await Task.findById(task);
  if (!existingTask) {
    res.status(404);
    throw new Error("Task not found");
  }

  const newNotification = await Notification.create({
    user: new mongoose.Types.ObjectId(user),
    task: new mongoose.Types.ObjectId(task),
    message: message.trim(),
    actionBy: new mongoose.Types.ObjectId(actionBy),
  });

  const populatedNotification = await Notification.findById(newNotification._id)
    .populate("task", "title")
    .populate("actionBy", "username avatar");

  res.status(201).json(populatedNotification);
});

export const markNotificationAsRead = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!req.user || !req.user._id) {
    res.status(401);
    throw new Error("User not authenticated");
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error("Invalid notification ID");
  }

  const notification = await Notification.findOne({
    _id: id,
    user: req.user._id,
  });
  if (!notification) {
    res.status(404);
    throw new Error("Notification not found or not authorized");
  }

  notification.read = true;
  const updatedNotification = await notification.save();

  res.json(updatedNotification);
});

export const markAllNotificationsAsRead = asyncHandler(async (req, res) => {
  if (!req.user || !req.user._id) {
    res.status(401);
    throw new Error("User not authenticated");
  }

  const result = await Notification.updateMany(
    { user: req.user._id, read: false },
    { read: true }
  );

  if (result.modifiedCount === 0) {
    res.status(200).json({ message: "No unread notifications to mark" });
  } else {
    res.status(200).json({
      message: `${result.modifiedCount} notifications marked as read`,
    });
  }
});

export const deleteNotification = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!req.user || !req.user._id) {
    res.status(401);
    throw new Error("User not authenticated");
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error("Invalid notification ID");
  }

  const result = await Notification.deleteOne({
    _id: id,
    user: req.user._id,
  });

  if (result.deletedCount === 0) {
    res.status(404);
    throw new Error("Notification not found or not authorized");
  }

  res.status(200).json({ message: "Notification permanently deleted" });
});
