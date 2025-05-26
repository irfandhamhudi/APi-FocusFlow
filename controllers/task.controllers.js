import Task from "../models/task.model.js";
import User from "../models/user.models.js";
import asyncHandler from "express-async-handler";
import cloudinary from "../config/cloudinary.js";
import mongoose from "mongoose";
import Notification from "../models/notification.model.js";

// Create a new task
export const createTask = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    status,
    priority,
    tags,
    startDate,
    dueDate,
    assignedTo,
    subtask,
  } = req.body;

  if (!title) {
    res.status(400);
    throw new Error("Title is required");
  }

  let parsedAssignedTo = [];
  if (assignedTo) {
    try {
      if (typeof assignedTo === "string") {
        parsedAssignedTo = JSON.parse(assignedTo);
      } else if (Array.isArray(assignedTo)) {
        parsedAssignedTo = assignedTo;
      }
    } catch (err) {
      console.error("Error parsing assignedTo:", err.message);
      res.status(400);
      throw new Error("Invalid assignedTo format");
    }
  }

  parsedAssignedTo = parsedAssignedTo.filter((id) =>
    mongoose.Types.ObjectId.isValid(id)
  );

  let parsedSubtask = [];
  if (subtask) {
    try {
      if (typeof subtask === "string") {
        parsedSubtask = JSON.parse(subtask);
      } else if (Array.isArray(subtask)) {
        parsedSubtask = subtask;
      }
    } catch (err) {
      console.error("Error parsing subtask:", err.message);
      res.status(400);
      throw new Error("Invalid subtask format");
    }
  }

  parsedSubtask = parsedSubtask
    .filter(
      (sub) =>
        sub &&
        typeof sub === "object" &&
        sub.title &&
        typeof sub.title === "string" &&
        sub.title.trim() !== ""
    )
    .map((sub) => ({
      title: sub.title.trim(),
      completed: typeof sub.completed === "boolean" ? sub.completed : false,
    }));

  let attachments = [];
  if (req.files && req.files.length > 0) {
    attachments = req.files.map((file) => {
      const fileType = file.mimetype.startsWith("image/")
        ? "image"
        : file.mimetype === "application/pdf"
        ? "pdf"
        : "document";
      const fileSizeInMB = (file.size / (1024 * 1024)).toFixed(2);

      return {
        url: file.path,
        originalName: file.originalname,
        publicId: file.filename,
        type: fileType,
        size: parseFloat(fileSizeInMB),
      };
    });
  }

  if (!req.user || !req.user._id) {
    res.status(401);
    throw new Error("User not authenticated");
  }

  const activityLog = [
    {
      user: req.user._id,
      action: `${req.user.username} created task ${title}`,
      createdAt: new Date(),
    },
  ];

  if (attachments.length > 0) {
    const fileNames = attachments.map((file) => file.originalName).join(", ");
    activityLog.push({
      user: req.user._id,
      action: `${req.user.username} uploaded file(s): ${fileNames}`,
      createdAt: new Date(),
    });
  }

  const task = await Task.create({
    title,
    description,
    status,
    priority,
    tags,
    startDate,
    dueDate,
    owner: req.user._id,
    assignedTo: [], // Tidak langsung assign
    subtask: parsedSubtask,
    attachment: attachments,
    activity: activityLog,
  });

  // Buat undangan dan notifikasi untuk pengguna yang diundang
  if (parsedAssignedTo.length > 0) {
    try {
      await User.updateMany(
        { _id: { $in: parsedAssignedTo } },
        {
          $push: {
            invitations: {
              taskId: task._id,
              status: "pending",
              invitedAt: new Date(),
            },
          },
        }
      );

      // Buat notifikasi untuk setiap pengguna yang diundang
      const notifications = parsedAssignedTo.map((userId) => ({
        user: userId,
        actor: req.user._id,
        task: task._id, // Pastikan ini adalah string ObjectId
        message: `${req.user.username} invited you to join ${task.title}.`,
        read: false,
      }));
      await Notification.insertMany(notifications);
    } catch (err) {
      console.error(
        "Error creating invitations or notifications:",
        err.message
      );
      res.status(500);
      throw new Error(
        "Failed to create invitations or notifications for users"
      );
    }
  }

  const populatedTask = await Task.findById(task._id)
    .populate("owner", "username email avatar")
    .populate("assignedTo", "username email avatar")
    .populate("activity.user", "username email avatar")
    .populate("comments.user", "username email avatar")
    .populate("comments.replies.user", "username email avatar");

  if (!populatedTask) {
    res.status(500);
    throw new Error("Failed to populate task");
  }

  res.status(201).json(populatedTask);
});

// Get all tasks for the authenticated user
export const getTasks = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const tasks = await Task.find({
    $or: [
      { owner: req.user._id },
      { _id: { $in: user.assignedTasks } }, // Hanya task yang sudah diterima
    ],
  })
    .populate("owner", "username email avatar")
    .populate("assignedTo", "username email avatar")
    .populate("activity.user", "username email avatar")
    .populate("comments.user", "username email avatar")
    .populate("comments.replies.user", "username email avatar");

  res.json(tasks);
});

// Get single task by ID for the authenticated user
export const getTaskById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const task = await Task.findOne({
    _id: req.params.id,
    $or: [
      { owner: req.user._id },
      { _id: { $in: user.assignedTasks } }, // Hanya task yang sudah diterima
    ],
  })
    .populate("owner", "username email avatar")
    .populate("assignedTo", "username email avatar")
    .populate("activity.user", "username email avatar")
    .populate("comments.user", "username email avatar")
    .populate("comments.replies.user", "username email avatar");

  if (!task) {
    res.status(404);
    throw new Error("Task not found or you are not authorized to view it");
  }

  res.json(task);
});

// Update a task
export const updateTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);

  if (!task) {
    res.status(404);
    throw new Error("Task not found");
  }

  if (
    task.owner.toString() !== req.user._id.toString() &&
    !task.assignedTo.some((id) => id.toString() === req.user._id.toString())
  ) {
    res.status(401);
    throw new Error("Not authorized to update this task");
  }

  let updatedAssignedTo = [...task.assignedTo]; // Mulai dengan assignedTo saat ini
  let assignedToUpdated = false;
  let usersToInvite = [];
  let usersToRemove = [];

  if (req.body.assignedTo !== undefined) {
    try {
      const inputAssignedTo =
        typeof req.body.assignedTo === "string"
          ? JSON.parse(req.body.assignedTo)
          : req.body.assignedTo;

      const validAssignedTo = inputAssignedTo
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));

      const operation = req.body.assignedToOperation || "replace";
      if (operation === "add") {
        usersToInvite = validAssignedTo.filter(
          (id) => !task.assignedTo.some((existingId) => existingId.equals(id))
        );
        assignedToUpdated = true;
      } else if (operation === "remove") {
        usersToRemove = validAssignedTo;
        updatedAssignedTo = task.assignedTo
          .map((id) => id.toString())
          .filter(
            (id) => !validAssignedTo.map((id) => id.toString()).includes(id)
          )
          .map((id) => new mongoose.Types.ObjectId(id));
        assignedToUpdated = true;
      } else {
        usersToInvite = validAssignedTo.filter(
          (id) => !task.assignedTo.some((existingId) => existingId.equals(id))
        );
        usersToRemove = task.assignedTo.filter(
          (id) => !validAssignedTo.some((newId) => newId.equals(id))
        );
        assignedToUpdated = true;
      }
    } catch (err) {
      console.error("Error processing assignedTo:", err);
      updatedAssignedTo = task.assignedTo;
    }
  }

  // Buat undangan dan notifikasi untuk pengguna baru yang diundang
  if (usersToInvite.length > 0) {
    try {
      await User.updateMany(
        { _id: { $in: usersToInvite } },
        {
          $push: {
            invitations: {
              taskId: task._id,
              status: "pending",
              invitedAt: new Date(),
            },
          },
        }
      );

      const notifications = usersToInvite.map((userId) => ({
        user: userId,
        actor: req.user._id,
        task: task._id,
        message: `${req.user.username} invited you to join ${task.title}.`,
        read: false,
      }));
      await Notification.insertMany(notifications);
    } catch (err) {
      console.error(
        "Error creating invitations or notifications:",
        err.message
      );
      res.status(500);
      throw new Error(
        "Failed to create invitations or notifications for users"
      );
    }
  }

  // Hapus undangan untuk pengguna yang dihapus
  if (usersToRemove.length > 0) {
    try {
      await User.updateMany(
        { _id: { $in: usersToRemove } },
        {
          $pull: {
            invitations: { taskId: task._id },
            assignedTasks: task._id,
          },
        }
      );
      await Notification.deleteMany({
        user: { $in: usersToRemove },
        task: task._id,
      });
    } catch (err) {
      console.error(
        "Error removing invitations or notifications:",
        err.message
      );
      res.status(500);
      throw new Error(
        "Failed to remove invitations or notifications for users"
      );
    }
  }

  let updatedSubtask = task.subtask;
  let subtaskUpdated = false;
  if (req.body.subtask !== undefined) {
    try {
      const inputSubtask =
        typeof req.body.subtask === "string"
          ? JSON.parse(req.body.subtask)
          : req.body.subtask;

      updatedSubtask = inputSubtask
        .filter(
          (sub) =>
            sub &&
            typeof sub === "object" &&
            sub.title &&
            typeof sub.title === "string" &&
            sub.title.trim() !== ""
        )
        .map((sub) => ({
          title: sub.title.trim(),
          completed: typeof sub.completed === "boolean" ? sub.completed : false,
        }));
      subtaskUpdated = true;
    } catch (err) {
      console.error("Error processing subtask:", err);
      updatedSubtask = task.subtask;
    }
  }

  let updatedAttachments = task.attachment;
  let attachmentsUpdated = false;
  let uploadedFiles = [];
  let uploadedImages = []; // Untuk menyimpan gambar yang baru diunggah
  if (req.files && req.files.length > 0) {
    const newAttachments = req.files.map((file) => {
      const fileType = file.mimetype.startsWith("image/")
        ? "image"
        : file.mimetype === "application/pdf"
        ? "pdf"
        : "document";
      const fileSizeInMB = (file.size / (1024 * 1024)).toFixed(2);

      // Jika file adalah gambar, tambahkan ke uploadedImages
      if (fileType === "image") {
        uploadedImages.push(file.originalname);
      }

      return {
        url: file.path,
        originalName: file.originalname,
        publicId: file.filename,
        type: fileType,
        size: parseFloat(fileSizeInMB),
        uploadedAt: new Date(),
      };
    });

    if (req.body.attachmentOperation === "append") {
      updatedAttachments = [...task.attachment, ...newAttachments];
    } else {
      updatedAttachments = newAttachments;
    }
    attachmentsUpdated = true;
    uploadedFiles = newAttachments.map((file) => file.originalName);
  }

  const activityLogs = [];

  // Tambahkan log aktivitas jika ada file yang diunggah
  if (uploadedFiles.length > 0) {
    const fileNames = uploadedFiles.join(", ");
    activityLogs.push({
      user: req.user._id,
      action: `${req.user.username} uploaded file(s): ${fileNames}`,
      createdAt: new Date(),
    });
  }

  // Tambahkan notifikasi jika ada gambar yang diunggah
  if (uploadedImages.length > 0) {
    const imageNames = uploadedImages.join(", ");
    const recipients = [
      task.owner.toString(),
      ...task.assignedTo.map((id) => id.toString()),
    ].filter((id) => id !== req.user._id.toString()); // Kecualikan pengguna yang melakukan update

    const notifications = recipients.map((userId) => ({
      user: userId,
      actor: req.user._id,
      task: task._id,
      message: `${req.user.username} updated image(s) ${imageNames} for task ${task.title}.`,
      read: false,
    }));

    try {
      await Notification.insertMany(notifications);
    } catch (err) {
      console.error("Error creating image update notifications:", err.message);
      // Tidak melempar error karena ini bukan operasi kritis
    }
  }

  // Tambahan logika untuk activity logs lainnya (misalnya, jika status atau priority diubah)
  if (req.body.status && req.body.status !== task.status) {
    activityLogs.push({
      user: req.user._id,
      action: `${req.user.username} changed status from ${task.status} to ${req.body.status}`,
      createdAt: new Date(),
    });
  }

  if (req.body.priority && req.body.priority !== task.priority) {
    activityLogs.push({
      user: req.user._id,
      action: `${req.user.username} changed priority from ${task.priority} to ${req.body.priority}`,
      createdAt: new Date(),
    });
  }

  if (assignedToUpdated && usersToInvite.length > 0) {
    const invitedUsers = await User.find(
      { _id: { $in: usersToInvite } },
      "username"
    );
    const usernames = invitedUsers.map((user) => user.username).join(", ");
    activityLogs.push({
      user: req.user._id,
      action: `${req.user.username} invited ${usernames} to join ${task.title}`,
      createdAt: new Date(),
    });
  }

  if (assignedToUpdated && usersToRemove.length > 0) {
    const removedUsers = await User.find(
      { _id: { $in: usersToRemove } },
      "username"
    );
    const usernames = removedUsers.map((user) => user.username).join(", ");
    activityLogs.push({
      user: req.user._id,
      action: `${req.user.username} removed ${usernames} from ${task.title}`,
      createdAt: new Date(),
    });
  }

  const updateData = {
    ...req.body,
    assignedTo: updatedAssignedTo,
    subtask: updatedSubtask,
    attachment: updatedAttachments,
    $push: { activity: { $each: activityLogs } },
  };

  delete updateData.assignedToOperation;
  delete updateData.attachmentOperation;

  const updatedTask = await Task.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true,
  })
    .populate("owner", "username email avatar")
    .populate("assignedTo", "username email avatar")
    .populate("activity.user", "username email avatar")
    .populate("comments.user", "username email avatar")
    .populate("comments.replies.user", "username email avatar");

  res.json(updatedTask);
});

// Delete a task
export const deleteTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);

  if (!task) {
    res.status(404);
    throw new Error("Task not found");
  }

  if (task.owner.toString() !== req.user._id.toString()) {
    res.status(401);
    throw new Error("Not authorized to delete this task");
  }

  task.activity.push({
    user: req.user._id,
    action: `${req.user.username} deleted task ${task.title}`,
    createdAt: new Date(),
  });

  await task.save();

  if (task.attachment && task.attachment.length > 0) {
    await Promise.all(
      task.attachment.map(async (attachment) => {
        if (attachment.publicId) {
          await cloudinary.uploader.destroy(attachment.publicId);
        }
      })
    );
  }

  if (task.assignedTo && task.assignedTo.length > 0) {
    try {
      await User.updateMany(
        { _id: { $in: task.assignedTo } },
        { $pull: { assignedTasks: task._id } }
      );
    } catch (err) {
      console.error("Error removing assignedTasks for users:", err.message);
    }
  }

  await Task.findByIdAndDelete(req.params.id);
  res.json({ message: "Task deleted successfully" });
});

// Add a comment
export const addComment = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) {
    res.status(404);
    throw new Error("Task not found");
  }

  if (
    task.owner.toString() !== req.user._id.toString() &&
    !task.assignedTo.some((id) => id.toString() === req.user._id.toString())
  ) {
    res.status(401);
    throw new Error("Not authorized to add comment to this task");
  }

  const newComment = {
    user: req.user._id,
    comment: req.body.comment,
    createdAt: new Date(),
  };

  task.comments.push(newComment);

  task.activity.push({
    user: req.user._id,
    action: `${req.user.username} added comment : ${req.body.comment}`,
    createdAt: new Date(),
  });

  const updatedTask = await task.save();
  await updatedTask.populate("owner", "username email avatar");
  await updatedTask.populate("assignedTo", "username email avatar");
  await updatedTask.populate("activity.user", "username email avatar");
  await updatedTask.populate("comments.user", "username email avatar");
  await updatedTask.populate("comments.replies.user", "username email avatar");

  res.json(updatedTask);
});

// Add a comment reply
export const addCommentReply = asyncHandler(async (req, res) => {
  const { id: taskId, commentId } = req.params;
  const task = await Task.findById(taskId);
  if (!task) {
    res.status(404);
    throw new Error("Task not found");
  }

  const comment = task.comments.id(commentId);
  if (!comment) {
    res.status(404);
    throw new Error("Comment not found");
  }

  if (
    task.owner.toString() !== req.user._id.toString() &&
    !task.assignedTo.some((id) => id.toString() === req.user._id.toString())
  ) {
    res.status(401);
    throw new Error("Not authorized to reply to this comment");
  }

  // Populate comment.user untuk mendapatkan informasi pengguna yang membuat komentar awal
  await Task.populate(task, {
    path: "comments.user",
    select: "username email avatar",
  });

  // Ambil username pengguna yang membuat komentar awal
  const commentedUser = comment.user;
  const commentedUsername = commentedUser ? commentedUser.username : "Unknown";

  comment.replies = comment.replies || [];
  const newReply = {
    user: req.user._id,
    comment: req.body.comment,
    createdAt: new Date(),
  };
  comment.replies.push(newReply);

  // Tambahkan aksi dengan format yang diinginkan
  task.activity.push({
    user: req.user._id,
    action: `${req.user.username} replied to comment ( ${commentedUsername} ) : ${req.body.comment}`,
    createdAt: new Date(),
  });

  // Simpan perubahan dan populate data terkait
  const updatedTask = await task.save();
  await updatedTask.populate("owner", "username email avatar");
  await updatedTask.populate("assignedTo", "username email avatar");
  await updatedTask.populate("activity.user", "username email avatar");
  await updatedTask.populate("comments.user", "username email avatar");
  await updatedTask.populate("comments.replies.user", "username email avatar");

  res.json(updatedTask);
});

// Get recent activity
export const getRecentActivity = asyncHandler(async (req, res) => {
  const tasks = await Task.find({
    $or: [{ owner: req.user._id }, { assignedTo: req.user._id }],
  })
    .populate("activity.user", "username email avatar")
    .select("title activity attachment");

  const activities = [];
  tasks.forEach((task) => {
    task.activity.forEach((activity) => {
      let files = [];
      if (activity.action.includes("uploaded file(s):")) {
        const activityTime = new Date(activity.createdAt).getTime();
        files = task.attachment
          .filter((attachment) => {
            const attachmentTime = new Date(
              attachment.uploadedAt || activity.createdAt
            ).getTime(); // Fallback jika uploadedAt tidak ada
            return Math.abs(attachmentTime - activityTime) <= 1000;
          })
          .map((attachment) => ({
            name: attachment.originalName,
            url: attachment.url,
            size: attachment.size,
          }));
      }

      // Penanganan jika activity.user adalah null atau undefined
      const userData = activity.user || {};
      const username = userData.username || "Unknown";
      const avatar = userData.avatar || "";

      activities.push({
        taskId: task._id,
        taskTitle: task.title,
        user: username,
        avatar: avatar,
        action: activity.action,
        createdAt: activity.createdAt,
        files: files,
      });
    });
  });

  activities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const limit = parseInt(req.query.limit) || 10;
  const recentActivities = activities.slice(0, limit);

  res.json(recentActivities);
});

// Download file
export const downloadFile = asyncHandler(async (req, res) => {
  const { taskId, fileName } = req.params;
  const task = await Task.findOne({
    _id: taskId,
    $or: [{ owner: req.user._id }, { assignedTo: req.user._id }],
  });

  if (!task) {
    res.status(404);
    throw new Error("Task not found or you are not authorized to access it");
  }

  const attachment = task.attachment.find(
    (file) => file.originalName === fileName
  );

  if (!attachment) {
    res.status(404);
    throw new Error("File not found");
  }

  try {
    const response = await fetch(attachment.url); // Atau signed URL versi terbaru
    if (!response.ok) {
      throw new Error(
        `Failed to fetch file from Cloudinary: ${response.statusText}`
      );
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.setHeader(
      "Content-Type",
      response.headers.get("content-type") || "application/octet-stream"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${attachment.originalName}`
    );
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
  } catch (err) {
    console.error("Download error:", err.message);
    res.status(500).json({ message: "Failed to download file" });
  }
});

// Accept an invitation
export const acceptInvitation = asyncHandler(async (req, res) => {
  const { taskId } = req.params;

  const user = await User.findById(req.user._id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const invitation = user.invitations.find(
    (inv) => inv.taskId.toString() === taskId && inv.status === "pending"
  );
  if (!invitation) {
    console.log(
      `Invitation not found for user ${req.user._id} with taskId ${taskId}. Current invitations:`,
      user.invitations
    );
    res.status(404);
    throw new Error("Invitation not found or already processed");
  }

  const task = await Task.findById(taskId);
  if (!task) {
    res.status(404);
    throw new Error("Task not found");
  }

  // Perbarui status undangan
  invitation.status = "accepted";
  user.assignedTasks.push(taskId);
  await user.save();

  // Tambahkan pengguna ke task.assignedTo
  task.assignedTo.push(user._id);
  task.activity.push({
    user: req.user._id,
    action: `${req.user.username} accepted invitation to join ${task.title}`,
    createdAt: new Date(),
  });
  const updatedTask = await task.save();

  // Perbarui notifikasi menjadi dibaca
  await Notification.updateMany(
    { user: req.user._id, task: taskId },
    { read: true }
  );

  const populatedTask = await Task.findById(taskId)
    .populate("owner", "username email avatar")
    .populate("assignedTo", "username email avatar")
    .populate("activity.user", "username email avatar")
    .populate("comments.user", "username email avatar")
    .populate("comments.replies.user", "username email avatar");

  res.json(populatedTask);
});

// Decline an invitation
export const declineInvitation = asyncHandler(async (req, res) => {
  const { taskId } = req.params;

  const user = await User.findById(req.user._id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const invitation = user.invitations.find(
    (inv) => inv.taskId.toString() === taskId && inv.status === "pending"
  );
  if (!invitation) {
    console.log(
      `Invitation not found for user ${req.user._id} with taskId ${taskId}. Current invitations:`,
      user.invitations
    );
    res.status(404);
    throw new Error("Invitation not found or already processed");
  }

  const task = await Task.findById(taskId);
  if (!task) {
    res.status(404);
    throw new Error("Task not found");
  }

  // Perbarui status undangan
  invitation.status = "declined";
  await user.save();

  task.activity.push({
    user: req.user._id,
    action: `${req.user.username} declined invitation to join ${task.title}`,
    createdAt: new Date(),
  });
  await task.save();

  // Perbarui notifikasi menjadi dibaca
  await Notification.updateMany(
    { user: req.user._id, task: taskId },
    { read: true }
  );

  res.json({ message: "Invitation declined successfully" });
});
