const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const BASE_DIR = __dirname;
const CACHE_DIR = path.join(BASE_DIR, "cache_audio");

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".srt": "text/plain; charset=utf-8",
  ".vtt": "text/vtt; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg"
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURI(req.url.split("?")[0]);

  // CORS Headers for all endpoints
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // API Endpoint: Native Khmer Neural Text-To-Speech (TTS)
  // Supports: /api/tts?text=...&voice=piseth|sreymom
  if (reqPath === "/api/tts") {
    const urlObj = new URL(req.url, `http://${req.headers.host || "localhost:3000"}`);
    const text = urlObj.searchParams.get("text");
    const voice = urlObj.searchParams.get("voice") || "piseth";

    if (!text || !text.trim()) {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Missing text parameter");
      return;
    }

    const cleanText = text.trim();
    // Generate deterministic hash for audio caching
    const hash = crypto.createHash("md5").update(`${voice}_${cleanText}`).digest("hex");
    const cachedFilePath = path.join(CACHE_DIR, `${hash}.mp3`);

    // Helper to stream MP3 file back to client
    const streamAudio = (filePath) => {
      fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile() || stats.size === 0) {
          res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Audio file corrupted or empty");
          return;
        }

        res.writeHead(200, {
          "Content-Type": "audio/mpeg",
          "Content-Length": stats.size,
          "Cache-Control": "public, max-age=604800",
          "Access-Control-Allow-Origin": "*"
        });
        fs.createReadStream(filePath).pipe(res);
      });
    };

    // If already generated and cached, stream immediately
    if (fs.existsSync(cachedFilePath) && fs.statSync(cachedFilePath).size > 0) {
      streamAudio(cachedFilePath);
      return;
    }

    // Otherwise, generate audio using native Khmer Neural engine (tts_helper.py)
    const helperScript = path.join(BASE_DIR, "tts_helper.py");
    execFile("python", [helperScript, cleanText, cachedFilePath, voice], { timeout: 25000 }, (error, stdout, stderr) => {
      if (error) {
        console.error("[TTS Generation Error]:", error, stderr);
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("TTS Generation Error: " + (stderr || error.message));
        return;
      }
      streamAudio(cachedFilePath);
    });
    return;
  }

  // Static File Serving
  if (reqPath === "/") reqPath = "/index.html";

  const safePath = path.normalize(path.join(BASE_DIR, reqPath));
  if (!safePath.startsWith(BASE_DIR)) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("Access Denied");
    return;
  }

  fs.stat(safePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 File Not Found");
      return;
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*"
    });

    const stream = fs.createReadStream(safePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🎬 CineKhmer AI Studio running at:`);
  console.log(`👉 http://localhost:${PORT}`);
  console.log(`🎙️ Native Neural Khmer TTS API:`);
  console.log(`   - Male (Piseth):  http://localhost:${PORT}/api/tts?text=សួស្តី&voice=piseth`);
  console.log(`   - Female (Sreymom): http://localhost:${PORT}/api/tts?text=សួស្តី&voice=sreymom`);
  console.log(`======================================================\n`);
});
