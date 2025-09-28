// server.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

// Routes
const authRoutes = require("./routes/auth");
const courseRoutes = require("./routes/courseRoutes");
const quizRoutes = require("./routes/quizRoutes");
const sessionRoutes = require("./routes/quizSessionRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const studentRoutes = require("./routes/students"); // <-- students API
const analyticsRoutes = require("./routes/analyticsRoutes");
// Services
const SocketService = require("./services/socketService");

// Dev auth middleware (reads x-user-id/x-user-role or query/body)
const devAuth = require("./middleware/auth");

const app = express();
const server = http.createServer(app);

const rawOrigins = process.env.CORS_ORIGIN || "http://localhost:5173";
const ALLOWED_ORIGINS = rawOrigins.split(",").map((s) => s.trim());

// Socket.IO
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  },
});

// Express CORS
app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Attach io so controllers can use it if needed
app.set("io", io);

// ✅ IMPORTANT: mount dev auth BEFORE the routes so req.user is available
app.use(devAuth);

// Init sockets
new SocketService(io);

// API routes
app.use("/api/students", studentRoutes); // must come after devAuth
app.use("/api/auth", authRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/quizzes", quizRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api/uploads", uploadRoutes);
app.use("/api/analytics", analyticsRoutes);
// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Safe 404 handler (no wildcard string that crashes path-to-regexp)
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: "Something went wrong!",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// DB + starts
const PORT = process.env.PORT || 5000;
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/course-engagement-system";

mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("✅ MongoDB connected successfully");
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🔗 Socket.IO ready for connections`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  server.close(() => {
    mongoose.connection.close();
    process.exit(0);
  });
});
