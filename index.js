import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose"; // Import mongoose for connection cleanup
import connectDB from "./config/database.js";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.routes.js";
import avatarRoutes from "./routes/avatar.routes.js";
import taskRoutes from "./routes/task.routes.js";
import notificationRoutes from "./routes/notification.route.js";

dotenv.config();

// Call connectDB and wait for it to complete
const startServer = async () => {
  try {
    await connectDB(); // Wait for DB connection
    const app = express();

    app.use(cookieParser());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    app.use(
      cors({
        origin: "https://focus-flow-app-rho.vercel.app",
        credentials: true,
      })
    );

    // Routes
    app.use("/api/v1/auth", authRoutes);
    app.use("/api/v1/avatar", avatarRoutes);
    app.use("/api/v1/tasks", taskRoutes);
    app.use("/api/v1/notifications", notificationRoutes);

    const PORT = process.env.PORT || 5000;

    const server = app.listen(PORT, () =>
      console.log(`Server running on port ${PORT}`)
    );

    // Handle SIGTERM for graceful shutdown
    process.on("SIGTERM", () => {
      console.log("SIGTERM received. Shutting down gracefully...");
      server.close(() => {
        console.log("HTTP server closed.");
        mongoose.connection.close(false, () => {
          console.log("MongoDB connection closed.");
          process.exit(0);
        });
      });
    });
  } catch (err) {
    console.error("Failed to start server:", err.message);
    process.exit(1);
  }
};

startServer();
