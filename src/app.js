const express = require("express");
const crypto = require("crypto"); // For generating unique IDs
const connectDB = require("./utils/db");
const logger = require("./utils/logger");
const { MASTER_KEY } = require("./config");
const VideoService = require("./lib/VideoService");

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// In-memory store to track events and their logs
const events = new Map();

// Connect to MongoDB
connectDB();

// Basic route to check if the server is running
app.get("/", (_, res) => {
  logger.info("Server health check endpoint hit.");
  res.status(200).json({
    status: "success",
    message: "Server is running!",
  });
});

app.post("/generate_video", async (req, res) => {
  try {
    const { user, app_master_key, additionalConfig = {} } = req.body;

    // Validate the master key and user
    if (app_master_key !== MASTER_KEY || !user) {
      return res
        .status(401)
        .json({ error: "Unauthorized! Invalid Master Key" });
    }
    // Generate a unique ID for this event
    const eventId = crypto.randomUUID();
    // Initialize VideoService with user and additionalConfig
    const videoService = new VideoService(user, additionalConfig);
    // Store the event in memory (for SSE logging)
    events.set(eventId, { logs: [], status: "in_progress", clients: new Set() });
    // Respond with the event ID
    res.status(202).json({ eventId, message: "Video generation started." });

    // Start the video generation process (in the background)
    (async () => {
      try {
        // Override console.log to capture logs for this event
        const originalConsoleLog = console.log;
        console.log = (...args) => {
          originalConsoleLog(...args); // Keep original console.log functionality
          const logMessage = args.join(" ");
          const event = events.get(eventId);
          if (event) {
            event.logs.push(logMessage); // Store logs for this event

            // Send the log to all connected clients
            event.clients.forEach((client) => {
              client.write(`data: ${JSON.stringify({ message: logMessage })}\n\n`);
            });
          }
        };

        // Generate the video
        const videoData = await videoService.postVideoToInstagram();

        // Restore original console.log
        console.log = originalConsoleLog;

        // Mark the event as completed
        events.set(eventId, { ...events.get(eventId), status: "completed", videoData });

        // Notify all clients that the event is completed
        const event = events.get(eventId);
        event.clients.forEach((client) => {
          client.write(`data: ${JSON.stringify({ videoData, message: "Video generation completed!" })}\n\n`);
          client.end(); // Close the connection
        });
      } catch (error) {
        logger.error(error);

        // Mark the event as failed
        events.set(eventId, { ...events.get(eventId), status: "failed", error: error.message });

        // Notify all clients that the event failed
        const event = events.get(eventId);
        event.clients.forEach((client) => {
          client.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
          client.end(); // Close the connection
        });
      }
    })();
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// SSE endpoint to stream logs for a specific event
app.get("/events/:eventId", (req, res) => {
  const { eventId } = req.params;

  // Set headers for SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders(); // Flush the headers to establish the SSE connection

  // Check if the event exists
  const event = events.get(eventId);
  if (!event) {
    res.write(`data: ${JSON.stringify({ error: "Event not found" })}\n\n`);
    res.end();
    return;
  }

  // Add this client to the event's clients set
  event.clients.add(res);

  // Send existing logs
  event.logs.forEach((log) => {
    res.write(`data: ${JSON.stringify({ message: log })}\n\n`);
  });

  // Handle client disconnect
  req.on("close", () => {
    event.clients.delete(res); // Remove the client from the set
    res.end();
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});
