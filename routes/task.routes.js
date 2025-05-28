import express from "express";
import {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
  addComment,
  addCommentReply,
  getRecentActivity,
  downloadFile,
  declineInvitation,
  acceptInvitation,
  editComment,
  deleteComment,
  editCommentReply,
  deleteCommentReply,
  joinTask,

  // joinTask,
} from "../controllers/task.controllers.js";
import authMiddleware from "../middleware/auth.middleware.js";
import uploadMiddleware from "../middleware/upload.middleware.task.js";

const router = express.Router();
router.route("/recent-activity").get(authMiddleware, getRecentActivity);

router.get("/download/:taskId/:fileName", authMiddleware, downloadFile);
// router.post("/:taskId/join", authMiddleware, joinTask);
router.get("/join/:token", authMiddleware, joinTask);

// Task routes
router
  .route("/")
  .post(authMiddleware, uploadMiddleware, createTask)
  .get(authMiddleware, getTasks);

router
  .route("/:id")
  .get(authMiddleware, getTaskById)
  .patch(authMiddleware, uploadMiddleware, updateTask)
  .delete(authMiddleware, deleteTask);

router.route("/:id/comments").post(authMiddleware, addComment);
router
  .route("/:id/comments/:commentId/replies")
  .post(authMiddleware, addCommentReply);

router
  .route("/:id/comments/:commentId/replies/:replyId")
  .patch(authMiddleware, editCommentReply)
  .delete(authMiddleware, deleteCommentReply);

router
  .route("/:id/comments/:commentId")
  .patch(authMiddleware, editComment)
  .delete(authMiddleware, deleteComment);

// Rute untuk accept dan decline invitation
router
  .route("/invitations/accept/:taskId")
  .post(authMiddleware, acceptInvitation);
router
  .route("/invitations/decline/:taskId")
  .post(authMiddleware, declineInvitation);
export default router;
