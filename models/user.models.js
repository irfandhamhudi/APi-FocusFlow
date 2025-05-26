import mongoose from "mongoose";

const userSchema = mongoose.Schema(
  {
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isVerified: { type: Boolean, default: false },
    avatar: { type: String },
    otp: { type: String },
    // role: { type: String, default: "user" },
    resetPasswordToken: { type: String },
    resetPasswordExpire: { type: Date },
    firstname: { type: String, default: "" },
    lastname: { type: String, default: "" },
    assignedTasks: [{ type: mongoose.Schema.Types.ObjectId, ref: "Task" }],
    invitations: [
      {
        taskId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Task",
          required: true,
        },
        status: {
          type: String,
          enum: ["pending", "accepted", "declined"],
          default: "pending",
        },
        invitedAt: { type: Date, default: Date.now },
      },
    ],
    isNewUser: {
      type: Boolean,
      default: true, // Default true untuk pengguna baru
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("User", userSchema);

export default User;
