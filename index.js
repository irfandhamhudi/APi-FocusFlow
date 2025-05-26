import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/database.js";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.routes.js";
import avatarRoutes from "./routes/avatar.routes.js";
import taskRoutes from "./routes/task.routes.js";
import notificationRoutes from "./routes/notification.route.js";

dotenv.config();
connectDB();

const app = express();
app.use(cookieParser());

// Middleware untuk parsing body JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: ["https://focus-flow-app-rho.vercel.app/login"],
    credentials: true, // Membolehkan cookies dikirimkan
  })
);

// Route for users
app.use("/api/v1/auth", authRoutes); // Route for authentication

// Route for avatars
app.use("/api/v1/avatar", avatarRoutes); // Route for avatar upload

// Route for tasks
app.use("/api/v1/tasks", taskRoutes); // Route for tasks

// Route for notifications
app.use("/api/v1/notifications", notificationRoutes); // Route for notifications

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
