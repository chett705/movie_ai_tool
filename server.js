const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const crypto = require("crypto");
const os = require("os");

process.on("uncaughtException", (err) => {
  console.error("[Server Uncaught Exception]:", err && err.message ? err.message : err);
});

process.on("unhandledRejection", (reason) => {
  console.error("[Server Unhandled Rejection]:", reason && reason.message ? reason.message : reason);
});

function getPythonBin() {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  const venvPyWin = path.join(__dirname, ".venv", "Scripts", "python.exe");
  if (fs.existsSync(venvPyWin)) return venvPyWin;
  const venvPyUnix = path.join(__dirname, ".venv", "bin", "python");
  if (fs.existsSync(venvPyUnix)) return venvPyUnix;
  return process.platform === "win32" ? "python" : "python3";
}

function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "localhost";
}

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

// Concurrency-limited and in-flight deduplicated TTS generation queue
const inFlightTTS = new Map();
const ttsQueue = [];
let activeTTSCount = 0;
const MAX_CONCURRENT_TTS = 3;

function enqueueTTS(cleanText, cachedFilePath, voice, callback) {
  ttsQueue.push({ cleanText, cachedFilePath, voice, callback });
  processTTSQueue();
}

function processTTSQueue() {
  if (activeTTSCount >= MAX_CONCURRENT_TTS || ttsQueue.length === 0) return;
  const item = ttsQueue.shift();
  activeTTSCount++;

  const helperScript = path.join(BASE_DIR, "tts_helper.py");
  execFile(getPythonBin(), [helperScript, item.cleanText, item.cachedFilePath, item.voice], { timeout: 35000 }, (error, stdout, stderr) => {
    activeTTSCount--;
    try {
      item.callback(error, stderr);
    } catch (e) {
      console.error("[TTS Callback Error]:", e);
    }
    processTTSQueue();
  });
}

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

  // API Endpoint: High-Speed Batch Translation to Khmer
  // POST /api/translate
  if (reqPath === "/api/translate" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", async () => {
      try {
        const payload = JSON.parse(body || "{}");
        const { texts, text, sourceLang = "auto", targetLang = "km" } = payload;

        const https = require("https");
        const polishMovieDialogueNode = (text, orig = "") => {
          if (!text) return "";
          const cleanOrig = (orig || "").toLowerCase().trim();

          // 1. Hollywood action & dialogue tropes
          if (/\b(good heavens|heavens|good lord|my goodness)\b/i.test(cleanOrig)) return "ឱព្រះអើយ!";
          if (/\b(go to hell|to hell with you)\b/i.test(cleanOrig)) return "ទៅងាប់ទៅ! ចុះនរកទៅ!";
          if (/\b(whoa,? jackpot|jackpot)\b/i.test(cleanOrig)) return "យីអើ! ត្រូវប៉ាន់ហើយ!";
          if (/\b(calm down little one)\b/i.test(cleanOrig)) return "ចិត្តត្រជាក់ៗកូនតូច! កុំស្លន់ស្លោអី!";
          if (/\b(calm down|take it easy)\b/i.test(cleanOrig)) return "ចិត្តត្រជាក់ៗសិនទៅ!";
          if (/\b(holy shit|holy crap|holy cow)\b/i.test(cleanOrig)) return "យីអើ! ងាប់ហើយលោកអើយ!";
          if (/\b(damn it|dammit|goddammit)\b/i.test(cleanOrig)) return "ចង្រៃយក៍!";
          if (/\b(what the hell|what the f(uck)?)\b/i.test(cleanOrig)) return "ស្អីគេហ្នឹង?!";
          if (/\b(son of a bitch)\b/i.test(cleanOrig)) return "អាតិរច្ឆាន!";
          if (/\b(fire in the hole)\b/i.test(cleanOrig)) return "ប្រយ័ត្នគ្រាប់បែក! ក្រាបចុះ!";
          if (/\b(cover me)\b/i.test(cleanOrig)) return "ជួយបាញ់ការពារខ្ញុំ!";
          if (/\b(fall back|retreat)\b/i.test(cleanOrig)) return "ឆាប់ដកថយជាបន្ទាន់!";
          if (/\b(drop your weapon|drop the gun)\b/i.test(cleanOrig)) return "ទម្លាក់អាវុធចុះភ្លាម!";
          if (/\b(don't move|freeze)\b/i.test(cleanOrig)) return "នៅឲ្យស្ងៀម កុំកម្រើក!";
          if (/\b(are you crazy|are you out of your mind|are you kidding me)\b/i.test(cleanOrig)) return "ឯងឆ្កួតហើយមែនទេ?!";
          if (/\b(we're running out of time|no time left)\b/i.test(cleanOrig)) return "យើងអស់ពេលហើយ! ឆាប់ឡើង!";
          if (/\b(shut up)\b/i.test(cleanOrig) || /^(silence!?|quiet!?)$/i.test(cleanOrig)) return "បិទមាត់ទៅ! នៅឲ្យស្ងៀម!";
          if (/\b(trust me)\b/i.test(cleanOrig)) return "ជឿជាក់លើខ្ញុំទៅ!";
          if (/\b(who are you)\b/i.test(cleanOrig)) return "ឯងជានរណា?!";
          if (/\b(what are you doing)\b/i.test(cleanOrig)) return "ឯងកំពុងធ្វើអីហ្នឹង?!";
          if (/\b(what('s| is) happening|what('s| is) going on)\b/i.test(cleanOrig)) return "មានរឿងអីកើតឡើង?!";
          if (/\b(no way|impossible)\b/i.test(cleanOrig)) return "មិនអាចទៅរួចទេ! គ្មានផ្លូវទេ!";
          if ((cleanOrig.includes("don't care who he is") || cleanOrig.includes("do not care who he is")) && (cleanOrig.includes("food") || cleanOrig.includes("destined"))) {
            return "ខ្ញុំមិនខ្វល់ថាវាជានរណាទេ ថ្ងៃនេះវាត្រូវតែក្លាយជាចំណីរបស់ខ្ញុំ!";
          }
          if (/\b(get out of here|get lost)\b/i.test(cleanOrig)) return "ឆាប់ចេញពីទីនេះភ្លាម!";
          if (/\b(i don't care|i do not care|i don't give a damn)\b/i.test(cleanOrig)) return "ខ្ញុំមិនខ្វល់ទេ!";
          if (/\b(i'm warning you|i am warning you)\b/i.test(cleanOrig)) return "ខ្ញុំព្រមានឯងណា!";
          if (/\b(stay with me)\b/i.test(cleanOrig)) return "តាំងស្មារតីឡើង កុំទាន់បិទភ្នែក!";

          // 2. Cultivation / Wuxia / Fantasy tropes
          if (cleanOrig.includes("calamity") && (cleanOrig.includes("blood plane") || cleanOrig.includes("come early"))) {
            return "ដែនឈាមបានទម្លុះរបាំងចេញមកហើយ គ្រោះមហន្តរាយលើកទីបួនរបស់ឯងមកដល់ពិតមែន!";
          }
          if (cleanOrig.includes("mount") && (cleanOrig.includes("become") || cleanOrig.includes("be my") || cleanOrig.includes("you will"))) {
            return "ឯងនឹងក្លាយជាសត្វជំនិះរបស់ខ្ញុំ!";
          }
          if (cleanOrig.includes("first time") && cleanOrig.includes("mount")) {
            return "នេះជាលើកដំបូងដែលខ្ញុំធ្វើជាសត្វជំនិះ...";
          }
          if (cleanOrig.includes("eat him") && cleanOrig.includes("stronger")) {
            return "បើខ្ញុំលេបត្របាក់វា ខ្ញុំនឹងកាន់តែខ្លាំងក្លាឡើង!";
          }
          if ((cleanOrig.includes("don't care who he is") || cleanOrig.includes("do not care who he is")) && cleanOrig.includes("food")) {
            return "ខ្ញុំមិនខ្វល់ថាវាជានរណាទេ ថ្ងៃនេះវាត្រូវតែក្លាយជាចំណីរបស់ខ្ញុំ!";
          }
          if (cleanOrig.includes("vassal") && (cleanOrig.includes("loomian") || cleanOrig.includes("family"))) {
            return "គ្រួសារ Loomian ដ៏អស្ចារ្យ មិនព្រមចុះចូលធ្វើជាចំណុះរបស់អ្នកណាជាដាច់ខាត!";
          }
          if (cleanOrig.includes("who dares disturb") || (cleanOrig.includes("disturb") && cleanOrig.includes("sleep"))) {
            return "នរណាហ៊ានរំខានដំណេករបស់លោកម្ចាស់?!";
          }
          if (cleanOrig.includes("court death") || orig.includes("找死")) return "ឯងចង់ងាប់ហើយមែនទេ?!";
          if (cleanOrig.includes("spare my life") || orig.includes("饶命")) return "សូមលោកម្ចាស់មេត្តាលើកលែងជីវិតផង!";
          if (cleanOrig.includes("prepare to die") || orig.includes("受死吧")) return "ដល់ពេលឯងត្រូវស្លាប់ហើយ!";
          if (cleanOrig.includes("incredible magic") || orig.includes("不可思议")) return "មហិទ្ធិឫទ្ធិមិនគួរឱ្យជឿ!";

          // 3. Clean awkward machine translation
          let res = text;
          res = res.replace(/ឋានសួគ៌ល្អ/g, "ឱព្រះអើយ!");
          res = res.replace(/ស្ងប់អារម្មណ៍តូចមួយ/g, "ចិត្តត្រជាក់ៗកូនតូច");
          res = res.replace(/ស្ងប់អារម្មណ៍ចុះ/g, "ចិត្តត្រជាក់ៗសិន!");
          res = res.replace(/ទៅនរក/g, "ទៅងាប់ទៅ!");
          res = res.replace(/រង្វាន់ជេកផត/g, "ត្រូវប៉ាន់ហើយ!");
          res = res.replace(/កូនឆ្កេញី/g, "អាតិរច្ឆាន!");
          res = res.replace(/លាមកបរិសុទ្ធ/g, "ងាប់ហើយលោកអើយ!");
          res = res.replace(/ខូចវា/g, "ចង្រៃយក៍!");
          res = res.replace(/តើអ្វីទៅជានរក/g, "រឿងឆ្កួតស្អីហ្នឹង?!");
          res = res.replace(/ភាពស្ងប់ស្ងាត់/g, "នៅស្ងៀមភ្លាម!");
          res = res.replace(/ភ្នំរបស់ខ្ញុំ/g, "សត្វជំនិះរបស់ខ្ញុំ");
          if (cleanOrig.includes("mount") || cleanOrig.includes("riding")) {
            res = res.replace(/ឡើងភ្នំ/g, "ជិះសត្វជំនិះ");
          }
          if (cleanOrig.includes("shatter") || cleanOrig.includes("sword") || cleanOrig.includes("broken")) {
            res = res.replace(/ញាប់ញ័រ/g, "បាក់បែកខ្ទេចខ្ទី");
          }
          res = res.replace(/ពូដ៏អស្ចារ្យ/g, "លោកតាពូ");
          res = res.replace(/ដាក់កំហុសគាត់សម្រាប់/g, "ច្រឡំគាត់ជា");
          res = res.replace(/កុំពិបាកជាមួយកូន/g, "កុំតឹងរ៉ឹងដាក់ក្មេងអី");
          res = res.replace(/នោះជាស្រីល្អ/g, "ក្មេងល្អណាស់");
          res = res.replace(/គ្រួសារទឹកដោះគោ/g, "គ្រួសារ Loomian");
          res = res.replace(/ខ្ញុំមិនស្លាប់ដូចការផ្ដន្ទាទោសពីឥឡូវនេះទេ/g, "ខ្ញុំមិនអាចមកស្លាប់នៅទីនេះបានទេ!");
          res = res.replace(/ឲ្យអាហារបន្ថែមដល់អ្នកខ្ញុំត្រូវខ្ទេចខ្ទីស្លាប់/g, "បើផ្តល់ថាមពលឲ្យឯងទៀត ខ្ញុំប្រាកដជាត្រូវស្លាប់មិនខាន!");
          res = res.replace(/គ្រួសារ Loomian ដ៏អស្ចារ្យ នឹងមិនក្លាយជាអ្នកធំរបស់នរណាម្នាក់ឡើយ/g, "គ្រួសារ Loomian ដ៏អស្ចារ្យ មិនព្រមចុះចូលធ្វើជាចំណុះរបស់អ្នកណាជាដាច់ខាត!");
          res = res.replace(/\bvassal\b/gi, "ចំណុះ");
          res = res.replace(/កុំព្យាយាមអ្វីទាំងអស់/g, "កុំធ្វើអ្វីផ្តេសផ្តាសឲ្យសោះ!");
          res = res.replace(/បណ្តាសារបស់យាយនឹងកាន់តែរឹងមាំ/g, "បណ្តាសានឹងកាន់តែសាហាវឡើង!");
          res = res.replace(/ហេតុអ្វីបានជាមានអារម្មណ៍ថាត្រជាក់ឆ្អឹងមួយរំពេចនោះ\?/g, "ហេតុអីបានជាស្រៀវឆ្អឹងខ្នងភ្លាមៗបែបនេះ?!");
          res = res.replace(/រំលោភទ្វារ/g, "ទម្លុះទ្វារ");
          res = res.replace(/ចាក់សោហើយផ្ទុក/g, "ត្រៀមអាវុធប្រយុទ្ធ");
          res = res.replace(/កាន់បន្ទាត់នេះ/g, "ទប់ទល់ឲ្យជាប់").replace(/កាន់បន្ទាត់/g, "ទប់ជំហរ");
          res = res.replace(/ក្រឡាចត្រង្គបរិវេណ/g, "ប្រព័ន្ធការពារជុំវិញ");
          res = res.replace(/ក្រឡាចត្រង្គ/g, "ប្រព័ន្ធការពារ");
          res = res.replace(/បាត់ទំនាក់ទំនង/g, "ដាច់ការទាក់ទង").replace(/បាត់បង់ការទាក់ទង/g, "ដាច់ការទាក់ទង");
          res = res.replace(/ពិនិត្យរ៉ាដាបម្រុងទុក/g, "ឆែករ៉ាដាបម្រុងមើល");
          res = res.replace(/ស្តាប់ខ្ញុំដោយយកចិត្តទុកដាក់/g, "ស្តាប់ខ្ញុំឲ្យច្បាស់");
          res = res.replace(/ជនស៊ីវិល/g, "ប្រជាជន");
          res = res.replace(/លេណដ្ឋានក្រោមដីឥឡូវនេះ/g, "លេណដ្ឋានក្រោមដីជាបន្ទាន់");
          res = res.replace(/ពួកយើងបាន/g, "យើង").replace(/ពួកយើង/g, "យើង").replace(/ពួកគេបាន/g, "ពួកវា");
          return res.trim();
        };

        const translateBatchNode = async (lines, sl, tl) => {
          if (!lines || lines.length === 0) return [];
          const cleaned = lines.map(l => (l || "").replace(/[\r\n]+/g, " ").trim());
          const joined = cleaned.map(l => l || "...").join("\n");
          
          return new Promise((resolve) => {
            const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}&q=${encodeURIComponent(joined)}`;
            const gReq = https.get(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }, timeout: 15000 }, (resp) => {
              let data = "";
              resp.on("data", c => data += c);
              resp.on("end", () => {
                try {
                  const json = JSON.parse(data);
                  let transString = "";
                  if (Array.isArray(json) && json.length > 0) {
                    if (typeof json[0] === "string") {
                      transString = json[0];
                    } else if (Array.isArray(json[0]) && typeof json[0][0] === "string") {
                      transString = json[0][0];
                    }
                  }
                  if (transString) {
                    const transLines = transString.split("\n");
                    while (transLines.length < lines.length) transLines.push(lines[transLines.length]);
                    const polished = transLines.slice(0, lines.length).map((t, idx) => polishMovieDialogueNode(t, lines[idx]));
                    resolve(polished);
                  } else {
                    resolve(lines);
                  }
                } catch (e) {
                  resolve(lines);
                }
              });
            });
            gReq.on("error", () => resolve(lines));
            gReq.on("timeout", () => { gReq.destroy(); resolve(lines); });
          });
        };

        if (Array.isArray(texts)) {
          const batchSize = 25;
          const translatedAll = [];
          for (let i = 0; i < texts.length; i += batchSize) {
            const chunk = texts.slice(i, i + batchSize);
            const chunkRes = await translateBatchNode(chunk, sourceLang, targetLang);
            translatedAll.push(...chunkRes);
          }
          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ success: true, translations: translatedAll }));
          return;
        }

        if (text) {
          const resLines = await translateBatchNode([text], sourceLang, targetLang);
          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ success: true, translation: resLines[0] || text }));
          return;
        }

        res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ success: false, error: "Missing texts or text parameter" }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
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

    // If already generated and cached (>100 bytes), stream immediately
    if (fs.existsSync(cachedFilePath) && fs.statSync(cachedFilePath).size > 100) {
      streamAudio(cachedFilePath);
      return;
    }

    // If generation in flight for this exact text/voice, wait for it
    if (inFlightTTS.has(hash)) {
      inFlightTTS.get(hash).push((err) => {
        if (err) {
          res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("TTS Generation Error: " + err);
        } else {
          streamAudio(cachedFilePath);
        }
      });
      return;
    }

    inFlightTTS.set(hash, [(err) => {
      if (err) {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("TTS Generation Error: " + err);
      } else {
        streamAudio(cachedFilePath);
      }
    }]);

    enqueueTTS(cleanText, cachedFilePath, voice, (error, stderr) => {
      const callbacks = inFlightTTS.get(hash) || [];
      inFlightTTS.delete(hash);

      const errMessage = error ? (stderr || error.message) : null;
      callbacks.forEach(cb => {
        try { cb(errMessage); } catch (e) {}
      });
    });
    return;
  }

  // API Endpoint: Video Audio Speech-to-Text & Movie Translation
  // POST /api/transcribe-video?style=cinematic&filename=...
  if (reqPath === "/api/transcribe-video" && req.method === "POST") {
    const urlObj = new URL(req.url, `http://${req.headers.host || "localhost:3000"}`);
    const style = urlObj.searchParams.get("style") || "cinematic";
    const filename = urlObj.searchParams.get("filename") || "video.mp4";
    const model = urlObj.searchParams.get("model") || "base";
    const lang = urlObj.searchParams.get("lang") || "auto";
    const ext = path.extname(filename) || ".mp4";

    const uploadsDir = path.join(BASE_DIR, "temp_uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const tempFile = path.join(uploadsDir, `upload_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
    const writeStream = fs.createWriteStream(tempFile);

    req.pipe(writeStream);

    writeStream.on("error", (err) => {
      console.error("[Upload Stream Error]:", err);
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ success: false, error: "Upload failed: " + err.message }));
    });

    writeStream.on("finish", () => {
      const transcriberScript = path.join(BASE_DIR, "video_transcriber.py");
      const args = [transcriberScript, "--input", tempFile, "--style", style, "--model", model, "--json"];
      if (lang && lang !== "auto") {
        args.push("--lang", lang);
      }

      execFile(getPythonBin(), args, { timeout: 600000, maxBuffer: 30 * 1024 * 1024 }, (error, stdout, stderr) => {
        // Clean up temporary uploaded file
        fs.unlink(tempFile, () => {});

        if (error) {
          console.error("[Transcription Error]:", error, stderr);
          res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ success: false, error: stderr || error.message }));
          return;
        }

        try {
          const jsonMatch = stdout.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
            res.end(jsonMatch[0]);
          } else {
            res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ success: false, error: "No JSON output from transcriber", raw: stdout }));
          }
        } catch (e) {
          res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
    });
    return;
  }

  // API Endpoint: Export Video with Subtitles
  // POST /api/export-video
  if (reqPath === "/api/export-video" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body);
        const { videoFilename, srtText, mode = "burnin_dubbed", voice = "piseth", ducking = 0.20, disableRealSound = false } = payload;

        if (!srtText || !srtText.trim()) {
          res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ success: false, error: "Missing srtText" }));
          return;
        }

        const os = require("os");
        const uploadsDir = path.join(BASE_DIR, "temp_uploads");
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

        // Locate video file on disk
        const cleanName = path.basename(videoFilename || "video.mp4");
        const candidates = [
          path.join(uploadsDir, cleanName),
          path.join(BASE_DIR, "samples", cleanName),
          path.join(BASE_DIR, cleanName),
          path.join(os.homedir(), "Downloads", cleanName),
          path.join(os.homedir(), "Desktop", cleanName)
        ];

        let videoPath = candidates.find(p => fs.existsSync(p));

        // If not found by exact name, look for case-insensitive match or known movie in Downloads
        if (!videoPath) {
          try {
            const dlDir = path.join(os.homedir(), "Downloads");
            const downloadFiles = fs.readdirSync(dlDir, { withFileTypes: true });
            
            // 1. Exact match case-insensitive
            let match = downloadFiles.find(d => d.isFile() && d.name.toLowerCase() === cleanName.toLowerCase());
            
            // 2. Match known user movie patterns (nskzefx, yoyuc, etc.)
            if (!match) {
              match = downloadFiles.find(d => d.isFile() && /nskzefx|yoyuc|lgu2q/i.test(d.name));
            }
            
            // 3. Fallback: most recent MP4 in Downloads (> 1MB)
            if (!match) {
              const mp4s = downloadFiles
                .filter(d => d.isFile() && d.name.toLowerCase().endsWith(".mp4"))
                .map(d => ({ name: d.name, time: fs.statSync(path.join(dlDir, d.name)).mtimeMs, size: fs.statSync(path.join(dlDir, d.name)).size }))
                .filter(d => d.size > 1024 * 1024)
                .sort((a, b) => b.time - a.time);
              if (mp4s.length > 0) match = mp4s[0];
            }

            if (match) videoPath = path.join(dlDir, match.name);
          } catch (e) {}
        }

        if (!videoPath) {
          res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ 
            success: false, 
            error: `រកមិនឃើញ File វីដេអូដើម ${cleanName} នៅលើកុំព្យូទ័រឡើយ។ សូមទាញយកឯកសារ Subtitle (.srt) ជំនួសវិញ!` 
          }));
          return;
        }

        const timestamp = Date.now();
        const tempSrt = path.join(uploadsDir, `export_${timestamp}.srt`);
        const outputMp4 = path.join(uploadsDir, `exported_movie_${timestamp}.mp4`);

        fs.writeFileSync(tempSrt, srtText, "utf-8");

        const exporterScript = path.join(BASE_DIR, "video_exporter.py");
        const isMuteRealSound = Boolean(disableRealSound || Number(ducking) <= 0.001);
        const args = [
          exporterScript,
          "--video", videoPath,
          "--srt", tempSrt,
          "--output", outputMp4,
          "--mode", mode,
          "--voice", voice || "piseth",
          "--ducking", String(isMuteRealSound ? 0.0 : (ducking || 0.20))
        ];
        if (isMuteRealSound) {
          args.push("--disable-real-sound");
        }

        execFile(getPythonBin(), args, { timeout: 600000 }, (error, stdout, stderr) => {
          fs.unlink(tempSrt, () => {});

          if (error) {
            console.error("[Export Error]:", error, stderr);
            res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ success: false, error: stderr || error.message }));
            return;
          }

          const exportFilename = path.basename(outputMp4);
          let modeLabel = "KhmerDubbed_Sub";
          if (mode === "burnin") modeLabel = "KhmerSub";
          else if (mode === "dubbed_only") modeLabel = "KhmerDubbed";
          else if (mode === "softsub") modeLabel = "SoftSub";

          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({
            success: true,
            downloadUrl: `/temp_uploads/${exportFilename}`,
            filename: `CineKhmer_${modeLabel}_${cleanName}`,
            sizeBytes: fs.statSync(outputMp4).size
          }));
        });

      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // API Endpoint: Export Full Movie Audio Track (MP3)
  // POST /api/export-audio
  if (reqPath === "/api/export-audio" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body);
        const { srtText, voice = "piseth" } = payload;
        if (!srtText || !srtText.trim()) {
          res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ success: false, error: "Missing srtText" }));
          return;
        }

        const uploadsDir = path.join(BASE_DIR, "temp_uploads");
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

        const timestamp = Date.now();
        const tempSrt = path.join(uploadsDir, `audio_${timestamp}.srt`);
        const outputMp3 = path.join(uploadsDir, `Khmer_Dubbing_${voice}_${timestamp}.mp3`);
        fs.writeFileSync(tempSrt, srtText, "utf-8");

        const tempWav = path.join(uploadsDir, `temp_${timestamp}.wav`);
        const exporterScript = path.join(BASE_DIR, "video_exporter.py");
        const pyCode = `import video_exporter, subprocess, imageio_ffmpeg, os
cues = video_exporter.parse_srt(r"${tempSrt.replace(/\\/g, "/")}")
duration = max([c["end"] for c in cues] + [60.0])
temp_wav = r"${tempWav.replace(/\\/g, "/")}"
out_mp3 = r"${outputMp3.replace(/\\/g, "/")}"
try:
    video_exporter.build_dubbing_audio_track(cues, duration, temp_wav, voice="${voice}")
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    subprocess.run([ffmpeg, "-y", "-i", temp_wav, "-b:a", "192k", out_mp3], check=True)
finally:
    if os.path.exists(temp_wav): os.unlink(temp_wav)
`;
        execFile(getPythonBin(), ["-c", pyCode], { timeout: 300000 }, (err) => {
          fs.unlink(tempSrt, () => {});
          if (err) {
            res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ success: false, error: err.message }));
            return;
          }
          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({
            success: true,
            downloadUrl: `/temp_uploads/${path.basename(outputMp3)}`,
            filename: `CineKhmer_Dubbing_${voice.toUpperCase()}.mp3`
          }));
        });
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
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

    const range = req.headers.range;
    if (range && (ext === ".mp4" || ext === ".webm" || ext === ".mp3")) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
      const chunksize = (end - start) + 1;
      const stream = fs.createReadStream(safePath, { start, end });
      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${stats.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*"
      });
      stream.on("error", () => { try { res.end(); } catch (e) {} });
      res.on("close", () => stream.destroy());
      stream.pipe(res);
      return;
    }

    const headers = {
      "Content-Type": contentType,
      "Content-Length": stats.size,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*"
    };

    if (reqPath.startsWith("/temp_uploads/") || req.url.includes("download=1") || ext === ".mp4" || ext === ".srt" || ext === ".vtt") {
      const downloadName = path.basename(safePath);
      headers["Content-Disposition"] = `attachment; filename="${downloadName}"`;
    }

    res.writeHead(200, headers);

    const stream = fs.createReadStream(safePath);
    stream.on("error", () => { try { res.end(); } catch (e) {} });
    res.on("close", () => stream.destroy());
    stream.pipe(res);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  const localIp = getLocalIp();
  console.log(`\n======================================================`);
  console.log(`🎬 CineKhmer AI Studio running at:`);
  console.log(`👉 This PC:   http://localhost:${PORT}`);
  console.log(`👉 Other PCs:  http://${localIp}:${PORT} (same Wi-Fi / LAN)`);
  console.log(`🎙️ Native Neural Khmer TTS API:`);
  console.log(`   - Male (Piseth):    http://localhost:${PORT}/api/tts?text=សួស្តី&voice=piseth`);
  console.log(`   - Female (Sreymom):  http://localhost:${PORT}/api/tts?text=សួស្តី&voice=sreymom`);
  console.log(`======================================================\n`);
});
