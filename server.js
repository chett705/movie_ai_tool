const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const BASE_DIR = __dirname;

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

  // API Endpoint: Native Khmer Audio TTS Streaming Proxy
  if (reqPath === "/api/tts") {
    const urlObj = new URL(req.url, `http://${req.headers.host || "localhost:3000"}`);
    const text = urlObj.searchParams.get("text");
    if (!text || !text.trim()) {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Missing text parameter");
      return;
    }

    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=km&client=tw-ob&q=${encodeURIComponent(text.trim())}`;
    
    https.get(ttsUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://translate.google.com/"
      }
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 200, {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*"
      });
      proxyRes.pipe(res);
    }).on("error", (err) => {
      console.error("[TTS Error]:", err.message);
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("TTS Proxy Error: " + err.message);
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
  console.log(`🎙️ Native Khmer TTS Audio API: http://localhost:${PORT}/api/tts?text=សួស្តី`);
  console.log(`======================================================\n`);
});
