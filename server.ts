import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Configure JSON parser with larger limit for base64 file payloads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // In-memory cloud session store
  // Auto-deletes content upon print completion
  const sessions: Record<
    string,
    {
      id: string;
      file?: { filename: string; fileType: string; fileData: string; pageCount?: number };
      files?: Array<{ filename: string; fileType: string; fileData: string; pageCount?: number }>;
      status: "waiting" | "uploaded" | "completed";
    }
  > = {};

  // API Routes
  app.get("/api/session/create", (req, res) => {
    const sessionId = Math.random().toString(36).substring(2, 8).toUpperCase();
    sessions[sessionId] = { id: sessionId, status: "waiting" };
    res.json({ sessionId });
  });

  app.get("/api/session/:sessionId", (req, res) => {
    const { sessionId } = req.params;
    const session = sessions[sessionId];
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    res.json(session);
  });

  app.post("/api/session/:sessionId/upload", (req, res) => {
    const { sessionId } = req.params;
    const { filename, fileType, fileData, pageCount, files } = req.body;
    const session = sessions[sessionId];
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (files && Array.isArray(files)) {
      session.files = files;
      if (files.length > 0) {
        session.file = files[0];
      }
    } else if (filename && fileData) {
      const singleFile = { filename, fileType: fileType || "application/pdf", fileData, pageCount: pageCount || 1 };
      session.file = singleFile;
      session.files = [singleFile];
    }
    
    session.status = "uploaded";
    res.json({ success: true, status: "uploaded" });
  });

  app.post("/api/session/:sessionId/complete", (req, res) => {
    const { sessionId } = req.params;
    const session = sessions[sessionId];
    if (session) {
      // Clear file contents securely (cloud auto-deletion)
      delete session.file;
      delete session.files;
      session.status = "completed";
    }
    res.json({ success: true });
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
