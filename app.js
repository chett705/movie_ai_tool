/**
 * CineKhmer AI - Movie AI Translator & Narrator
 * Frontend Logic & Real-Time Cinema Subtitle Engine
 */

// Application State
const state = {
  subtitles: [],
  glossary: [
    { term: "Commander", translation: "លោកមេបញ្ជាការ", category: "តំណែង (Rank)" },
    { term: "Captain", translation: "លោកប្រធានក្រុម", category: "តំណែង (Rank)" },
    { term: "Detective", translation: "អ្នកស៊ើបអង្កេត", category: "អាជីព (Role)" },
    { term: "Agent", translation: "ភ្នាក់ងារសម្ងាត់", category: "អាជីព (Role)" },
    { term: "Lock and load", translation: "ត្រៀមអាវុធប្រយុទ្ធ", category: "ពាក្យស្លោក (Idiom)" },
    { term: "Fire in the hole", translation: "ប្រយ័ត្នគ្រាប់បែក", category: "ពាក្យស្លោក (Idiom)" },
    { term: "Hold the line", translation: "ទប់ជំហរឲ្យជាប់", category: "ពាក្យស្លោក (Idiom)" },
    { term: "Bunker", translation: "លេណដ្ឋានក្រោមដី", category: "ទីតាំង (Place)" },
    { term: "Sector 7", translation: "តំបន់ទី ៧", category: "ទីតាំង (Place)" },
    { term: "Mayday", translation: "សញ្ញាអាសន្ន", category: "សញ្ញា (Signal)" }
  ],
  aiProvider: localStorage.getItem("cinekhmer_ai_provider") || "free",
  geminiApiKey: localStorage.getItem("cinekhmer_gemini_key") || "",
  ttsSpeed: parseFloat(localStorage.getItem("cinekhmer_tts_speed") || "1.0"),
  isTranslating: false,
  isPlayingAudio: false,
  demoCanvasInterval: null,
  // Video AI Dubbing Engine
  isDubbingEnabled: true,
  ttsEngine: "neural", // "neural" (Native Google Khmer TTS) or "speechSynthesis" (Browser Web Speech)
  videoDuckingLevel: 0.2, // Lower video sound to 20% when speaking Khmer
  dubbingVolume: 1.0,
  audioCache: new Map(),
  currentPlayingAudio: null,
  lastSpokenCueIndex: -1
};

// Built-in Movie Sample Data
const SAMPLES = {
  action: `1
00:00:01,500 --> 00:00:04,200
Commander, we've lost contact with Sector 7.

2
00:00:04,800 --> 00:00:07,900
What do you mean lost contact? Check the backup radar!

3
00:00:08,400 --> 00:00:11,600
The entire perimeter grid just went dark. Something is coming.

4
00:00:12,100 --> 00:00:15,300
Listen to me carefully. Get all civilians to the underground bunker right now!

5
00:00:15,800 --> 00:00:18,500
Sir, they've breached the outer defense gates!

6
00:00:19,000 --> 00:00:23,200
Lock and load! Today, we hold this line no matter what happens!`,

  horror: `1
00:00:02,000 --> 00:00:05,100
Did you hear that sound coming from the attic?

2
00:00:05,800 --> 00:00:08,900
It's just the wind, Sarah. Don't let your imagination scare you.

3
00:00:09,500 --> 00:00:13,400
No... The attic door was locked from the outside. Look, it's open now!

4
00:00:14,200 --> 00:00:18,000
Whatever you do, do not turn around. It's standing right behind us.`,

  drama: `1
00:00:01,800 --> 00:00:05,000
I spent ten years waiting at this train station every single winter.

2
00:00:05,700 --> 00:00:09,200
You knew I couldn't come back. The promises we made were from another lifetime.

3
00:00:10,000 --> 00:00:14,500
Time didn't change anything for me. In my heart, you never left.`,

  recap: {
    title: "The Shadow Protocol (ពិភពស្រមោលសម្ងាត់)",
    genre: "Sci-Fi Mystery",
    plot: "A disgraced former cyber-detective named Alex discovers an underground cryogenic laboratory hidden beneath the subway system. While investigating a missing cyber-scientist, he uncovers that a powerful megacorporation is erasing memories of citizens and replacing them with obedient synthetic clones.\n\nWhen Alex is framed for the murder of the city governor, he has only 24 hours to team up with a rogue AI hacker named Maya to expose the conspiracy before the entire city is put into a permanent digital lockdown."
  }
};

// DOM Elements
const elements = {
  // Navigation
  navTabs: document.querySelectorAll(".nav-tab"),
  tabPanes: document.querySelectorAll(".tab-pane"),
  
  // Tab 1: Subtitles
  dropZone: document.getElementById("drop-zone"),
  fileInput: document.getElementById("file-input"),
  rawSubInput: document.getElementById("raw-sub-input"),
  btnClearInput: document.getElementById("btn-clear-input"),
  selectStyle: document.getElementById("select-style"),
  selectSourceLang: document.getElementById("select-source-lang"),
  btnTranslateSubtitles: document.getElementById("btn-translate-subtitles"),
  subtitlesList: document.getElementById("subtitles-list"),
  cueCounter: document.getElementById("cue-counter"),
  progressContainer: document.getElementById("translation-progress-container"),
  progressBar: document.getElementById("progress-bar"),
  progressText: document.getElementById("progress-text"),
  progressPercentage: document.getElementById("progress-percentage"),
  btnExportSrt: document.getElementById("btn-export-srt"),
  btnExportBilingual: document.getElementById("btn-export-bilingual"),
  btnExportVtt: document.getElementById("btn-export-vtt"),
  btnCopyTranslated: document.getElementById("btn-copy-translated"),
  btnSendToPlayer: document.getElementById("btn-send-to-player"),
  
  // Tab 2: Recap
  recapMovieTitle: document.getElementById("recap-movie-title"),
  recapMovieGenre: document.getElementById("recap-movie-genre"),
  recapDuration: document.getElementById("recap-duration"),
  recapTone: document.getElementById("recap-tone"),
  recapPlotText: document.getElementById("recap-plot-text"),
  btnGenerateRecap: document.getElementById("btn-generate-recap"),
  recapOutputContainer: document.getElementById("recap-output-container"),
  btnSpeakRecap: document.getElementById("btn-speak-recap"),
  btnCopyRecap: document.getElementById("btn-copy-recap"),
  btnDownloadRecap: document.getElementById("btn-download-recap"),
  audioPlayerHud: document.getElementById("audio-player-hud"),
  btnTtsToggle: document.getElementById("btn-tts-toggle"),
  audioStatus: document.getElementById("audio-status"),
  audioWaves: document.querySelector(".audio-waves"),
  
  // Tab 3: Video
  cinemaVideo: document.getElementById("cinema-video"),
  videoWrapper: document.getElementById("video-wrapper"),
  videoFileInput: document.getElementById("video-file-input"),
  btnLoadDemoVideo: document.getElementById("btn-load-demo-video"),
  videoFilename: document.getElementById("video-filename"),
  toggleBilingualPreview: document.getElementById("toggle-bilingual-preview"),
  toggleKhmerDubbing: document.getElementById("toggle-khmer-dubbing"),
  dubbingLiveBadge: document.getElementById("dubbing-live-badge"),
  dubbingBadgeText: document.getElementById("dubbing-badge-text"),
  selectTtsEngine: document.getElementById("select-tts-engine"),
  videoDuckingSlider: document.getElementById("video-ducking-slider"),
  duckingValDisplay: document.getElementById("ducking-val-display"),
  dubbingVolumeSlider: document.getElementById("dubbing-volume-slider"),
  dubbingVolDisplay: document.getElementById("dubbing-vol-display"),
  btnPreloadAudio: document.getElementById("btn-preload-audio"),
  btnExportAllMp3: document.getElementById("btn-export-all-mp3"),
  overlayKhmerText: document.getElementById("overlay-khmer-text"),
  overlayOriginalText: document.getElementById("overlay-original-text"),
  playerTimelineList: document.getElementById("player-timeline-list"),
  
  // Tab 4: Glossary
  glossaryTbody: document.getElementById("glossary-tbody"),
  btnAddGlossaryTerm: document.getElementById("btn-add-glossary-term"),
  
  // Settings Modal
  btnOpenSettings: document.getElementById("btn-open-settings"),
  btnCloseSettings: document.getElementById("btn-close-settings"),
  settingsModal: document.getElementById("settings-modal"),
  geminiKeySection: document.getElementById("gemini-key-section"),
  geminiApiKeyInput: document.getElementById("gemini-api-key"),
  activeEngineBadge: document.getElementById("active-engine-badge"),
  btnSaveSettings: document.getElementById("btn-save-settings"),
  ttsVoiceSpeed: document.getElementById("tts-voice-speed"),
  speedValue: document.getElementById("speed-value"),
  
  // Quick Samples
  sampleChips: document.querySelectorAll(".sample-chip")
};

// ==========================================
// Initialization
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initSettings();
  initDragAndDrop();
  initSampleChips();
  initGlossary();
  initVideoPlayer();
  bindEvents();
});

// ==========================================
// Navigation Tabs
// ==========================================
function initTabs() {
  elements.navTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const targetId = tab.dataset.tab;
      elements.navTabs.forEach(t => t.classList.remove("active"));
      elements.tabPanes.forEach(p => p.classList.remove("active"));
      
      tab.classList.add("active");
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add("active");
    });
  });
}

// ==========================================
// Settings & AI Engine
// ==========================================
function initSettings() {
  elements.geminiApiKeyInput.value = state.geminiApiKey;
  elements.ttsVoiceSpeed.value = state.ttsSpeed;
  elements.speedValue.textContent = `ធម្មតា (${state.ttsSpeed}x)`;
  
  const radio = document.querySelector(`input[name="ai_provider"][value="${state.aiProvider}"]`);
  if (radio) {
    radio.checked = true;
    updateRadioCardStyles(state.aiProvider);
  }
  
  updateEngineBadge();
}

function updateRadioCardStyles(provider) {
  document.querySelectorAll(".radio-card").forEach(card => card.classList.remove("active"));
  const activeInput = document.querySelector(`input[name="ai_provider"][value="${provider}"]`);
  if (activeInput) {
    activeInput.closest(".radio-card")?.classList.add("active");
  }
  if (provider === "gemini") {
    elements.geminiKeySection.classList.remove("hidden");
  } else {
    elements.geminiKeySection.classList.add("hidden");
  }
}

function updateEngineBadge() {
  if (state.aiProvider === "gemini" && state.geminiApiKey) {
    elements.activeEngineBadge.textContent = "Gemini AI";
    elements.activeEngineBadge.style.background = "var(--cyan-primary)";
    elements.activeEngineBadge.style.color = "#000";
  } else {
    elements.activeEngineBadge.textContent = "Free AI";
    elements.activeEngineBadge.style.background = "var(--amber-primary)";
    elements.activeEngineBadge.style.color = "#000";
  }
}

// ==========================================
// Drag and Drop & File Uploads
// ==========================================
function initDragAndDrop() {
  const dropZone = elements.dropZone;
  
  ["dragenter", "dragover"].forEach(name => {
    dropZone.addEventListener(name, (e) => {
      e.preventDefault();
      dropZone.classList.add("dragover");
    });
  });
  
  ["dragleave", "drop"].forEach(name => {
    dropZone.addEventListener(name, (e) => {
      e.preventDefault();
      dropZone.classList.remove("dragover");
    });
  });
  
  dropZone.addEventListener("drop", (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) handleSubtitleFile(files[0]);
  });
  
  dropZone.addEventListener("click", () => elements.fileInput.click());
  elements.fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) handleSubtitleFile(e.target.files[0]);
  });
}

function handleSubtitleFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    elements.rawSubInput.value = e.target.result;
    parseInputToSubtitles();
  };
  reader.readAsText(file);
}

// ==========================================
// Subtitle Parsing & Utilities
// ==========================================
function timecodeToSeconds(timeStr) {
  if (!timeStr) return 0;
  // Format: 00:01:23,456 or 00:01:23.456
  const clean = timeStr.trim().replace(",", ".");
  const parts = clean.split(":");
  if (parts.length === 3) {
    const hours = parseFloat(parts[0]) || 0;
    const mins = parseFloat(parts[1]) || 0;
    const secs = parseFloat(parts[2]) || 0;
    return hours * 3600 + mins * 60 + secs;
  }
  return 0;
}

function parseSRTorVTT(text) {
  const clean = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  const rawBlocks = clean.split(/\n\s*\n/);
  const cues = [];

  rawBlocks.forEach((block, i) => {
    const lines = block.split("\n").map(l => l.trim()).filter(l => l);
    if (lines.length >= 2) {
      let timeLineIdx = lines.findIndex(l => l.includes("-->"));
      if (timeLineIdx !== -1) {
        const timecode = lines[timeLineIdx];
        const [startStr, endStr] = timecode.split("-->").map(s => s.trim());
        const textLines = lines.slice(timeLineIdx + 1);
        const originalText = textLines.join(" ");

        cues.push({
          index: cues.length + 1,
          timecode: timecode,
          startTime: timecodeToSeconds(startStr),
          endTime: timecodeToSeconds(endStr),
          original: originalText,
          translated: ""
        });
      }
    }
  });

  return cues;
}

function parseInputToSubtitles() {
  const text = elements.rawSubInput.value.trim();
  if (!text) {
    state.subtitles = [];
    renderSubtitlesList();
    return;
  }
  state.subtitles = parseSRTorVTT(text);
  renderSubtitlesList();
}

function renderSubtitlesList() {
  const container = elements.subtitlesList;
  elements.cueCounter.textContent = state.subtitles.length;

  if (state.subtitles.length === 0) {
    container.innerHTML = `
      <div class="empty-placeholder">
        <i class="fa-solid fa-film empty-icon"></i>
        <h3>មិនទាន់មានទិន្នន័យ Subtitle នៅឡើយទេ</h3>
        <p>សូមជ្រើសរើសឯកសារ ឬចុចប៊ូតុង <strong>គំរូតេស្តរហ័ស</strong> ខាងលើដើម្បីចាប់ផ្ដើមសាកល្បង</p>
      </div>`;
    toggleExportButtons(false);
    return;
  }

  const hasTranslations = state.subtitles.some(s => s.translated.trim() !== "");
  toggleExportButtons(hasTranslations);

  container.innerHTML = state.subtitles.map((cue, idx) => `
    <div class="subtitle-cue-card" data-index="${idx}">
      <div class="cue-meta-header">
        <span class="cue-index">#${cue.index}</span>
        <span class="cue-timecode">${cue.timecode}</span>
        <div class="cue-card-actions">
          <button class="btn-card-action btn-speak-cue" title="ស្តាប់ការបញ្ចេញសំឡេង" data-index="${idx}">
            <i class="fa-solid fa-volume-high"></i>
          </button>
          <button class="btn-card-action btn-retranslate-cue" title="បកប្រែបន្ទាត់នេះឡើងវិញ" data-index="${idx}">
            <i class="fa-solid fa-rotate"></i>
          </button>
        </div>
      </div>
      <div class="cue-original-text">${escapeHtml(cue.original)}</div>
      <input type="text" class="cue-khmer-input" data-index="${idx}" 
             value="${escapeHtml(cue.translated)}" 
             placeholder="ការបកប្រែជាភាសាខ្មែរ (ចុចប៊ូតុងខាងឆ្វេងដើម្បីបកប្រែ)...">
    </div>
  `).join("");

  // Attach live editing listeners
  container.querySelectorAll(".cue-khmer-input").forEach(input => {
    input.addEventListener("input", (e) => {
      const i = parseInt(e.target.dataset.index);
      state.subtitles[i].translated = e.target.value;
      updateTimelineView();
    });
  });

  // Attach per-line speak listener
  container.querySelectorAll(".btn-speak-cue").forEach(btn => {
    btn.addEventListener("click", () => {
      const i = parseInt(btn.dataset.index);
      const cue = state.subtitles[i];
      const textToSpeak = cue.translated || cue.original;
      speakKhmerText(textToSpeak);
    });
  });

  // Attach retranslate line listener
  container.querySelectorAll(".btn-retranslate-cue").forEach(btn => {
    btn.addEventListener("click", async () => {
      const i = parseInt(btn.dataset.index);
      await translateSingleCue(i);
    });
  });

  updateTimelineView();
}

function toggleExportButtons(enabled) {
  elements.btnExportSrt.disabled = !enabled;
  elements.btnExportBilingual.disabled = !enabled;
  elements.btnExportVtt.disabled = !enabled;
  elements.btnCopyTranslated.disabled = !enabled;
  elements.btnSendToPlayer.disabled = !enabled;
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ==========================================
// Translation Engine
// ==========================================
async function translateWithFreeGoogle(text, sourceLang = "auto") {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=km&dt=t&q=${encodeURIComponent(text)}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("HTTP error " + resp.status);
    const data = await resp.json();
    let translated = "";
    if (data && data[0]) {
      translated = data[0].map(item => item[0]).join("");
    }
    return translated || text;
  } catch (err) {
    console.warn("Free translation error:", err);
    return text;
  }
}

async function translateWithGemini(text, style = "cinematic") {
  const prompt = `You are a professional Hollywood movie localization expert and Khmer cinema dialogue specialist (អ្នកបកប្រែ និងអត្ថាធិប្បាយភាពយន្តខ្មែរ).
Translate the following movie subtitle dialogue into natural, emotionally resonant, cinematic Khmer (ភាសាខ្មែរ).
Tone style: ${style}.
Never produce robotic or word-for-word translations. Preserve cinematic excitement, humor, and character attitude.
Output only the translated Khmer text:

Line: "${text}"`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${state.geminiApiKey}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const data = await resp.json();
    return data.candidates[0].content.parts[0].text.trim();
  } catch (err) {
    console.warn("Gemini translation error, falling back to free:", err);
    return await translateWithFreeGoogle(text);
  }
}

function applyGlossaryAndStyling(text, style) {
  let polished = text;

  // Apply glossary replacements
  state.glossary.forEach(item => {
    if (item.term && item.translation) {
      const reg = new RegExp(`\\b${item.term}\\b`, "gi");
      polished = polished.replace(reg, item.translation);
    }
  });

  // Movie styling touches
  if (style === "action") {
    polished = polished.replace(/!/g, " ឆាប់ឡើង!");
  } else if (style === "royal") {
    polished = polished.replace(/ខ្ញុំ/g, "ទូលបង្គំ").replace(/អ្នក/g, "ទ្រង់");
  }

  return polished;
}

async function translateSingleCue(index) {
  const cue = state.subtitles[index];
  const style = elements.selectStyle.value;
  const srcLang = elements.selectSourceLang.value;

  let translated = "";
  if (state.aiProvider === "gemini" && state.geminiApiKey) {
    translated = await translateWithGemini(cue.original, style);
  } else {
    translated = await translateWithFreeGoogle(cue.original, srcLang);
  }

  cue.translated = applyGlossaryAndStyling(translated, style);
  renderSubtitlesList();
}

async function translateAllSubtitles() {
  if (state.subtitles.length === 0) {
    parseInputToSubtitles();
    if (state.subtitles.length === 0) {
      alert("សូមបញ្ចូល ឬជ្រើសរើសឯកសារ Subtitle ជាមុនសិន!");
      return;
    }
  }

  state.isTranslating = true;
  elements.btnTranslateSubtitles.disabled = true;
  elements.progressContainer.classList.remove("hidden");

  const style = elements.selectStyle.value;
  const srcLang = elements.selectSourceLang.value;
  const total = state.subtitles.length;

  for (let i = 0; i < total; i++) {
    const cue = state.subtitles[i];
    elements.progressText.textContent = `កំពុងបកប្រែបន្ទាត់ទី ${i + 1} នៃ ${total}...`;
    const percent = Math.round(((i + 1) / total) * 100);
    elements.progressBar.style.width = `${percent}%`;
    elements.progressPercentage.textContent = `${percent}%`;

    let trans = "";
    if (state.aiProvider === "gemini" && state.geminiApiKey) {
      trans = await translateWithGemini(cue.original, style);
    } else {
      trans = await translateWithFreeGoogle(cue.original, srcLang);
    }

    cue.translated = applyGlossaryAndStyling(trans, style);

    // Update UI every few cues for responsive rendering
    if (i % 2 === 0 || i === total - 1) {
      renderSubtitlesList();
    }

    await new Promise(r => setTimeout(r, 120));
  }

  state.isTranslating = false;
  elements.btnTranslateSubtitles.disabled = false;
  elements.progressText.textContent = "បកប្រែបានជោគជ័យ ១០០%!";
  renderSubtitlesList();
  toggleExportButtons(true);
}

// ==========================================
// Subtitle Exporters (SRT, VTT, Bilingual)
// ==========================================
function generateSrtOutput(bilingual = false) {
  const blocks = state.subtitles.map((sub, i) => {
    const num = i + 1;
    const time = sub.timecode;
    let text = sub.translated || sub.original;
    if (bilingual && sub.translated && sub.original) {
      text = `${sub.translated}\n${sub.original}`;
    }
    return `${num}\n${time}\n${text}`;
  });
  return blocks.join("\n\n") + "\n";
}

function generateVttOutput() {
  const blocks = state.subtitles.map((sub, i) => {
    const vttTime = sub.timecode.replace(/,/g, ".");
    const text = sub.translated || sub.original;
    return `${i + 1}\n${vttTime}\n${text}`;
  });
  return "WEBVTT\n\n" + blocks.join("\n\n") + "\n";
}

function downloadFile(content, filename, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ==========================================
// Movie Recap AI Generator
// ==========================================
async function generateMovieRecap() {
  const title = elements.recapMovieTitle.value.trim() || "The Movie";
  const genre = elements.recapMovieGenre.value;
  const duration = elements.recapDuration.value;
  const tone = elements.recapTone.value;
  const plot = elements.recapPlotText.value.trim();

  if (!plot) {
    alert("សូមបញ្ចូលសេចក្តីសង្ខេបសាច់រឿងជាមុនសិន!");
    return;
  }

  elements.btnGenerateRecap.disabled = true;
  elements.btnGenerateRecap.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> កំពុងតែងស្គ្រីបអត្ថាធិប្បាយ...`;

  if (state.aiProvider === "gemini" && state.geminiApiKey) {
    const recapPrompt = `You are a legendary Cambodian Movie Recap Narrator (អ្នកអត្ថាធិប្បាយសង្ខេបភាពយន្ត) on Facebook Reels, TikTok and YouTube.
Write a gripping, viral Khmer movie recap narration script for the movie:
Title: "${title}"
Genre: ${genre}
Target Duration: ${duration} minutes
Voice Tone: ${tone}

Plot details:
${plot}

Structure the script in Khmer (ភាសាខ្មែរ) with time markers:
🎬 [0:00 - 0:15] បើកឆាកទាក់ទាញ (Viral Hook - makes listeners stay)
⚡ [0:15 - 1:30] សាច់រឿងលម្អិត (Plot Storytelling & character introduction)
🔥 [1:30 - 2:30] ឈុតកំពូល និងគ្រោះថ្នាក់ (High Tension Climax)
🌟 [2:30 - 3:00] បញ្ចប់សាច់រឿង (Moral / Cliffhanger & Outro call to action)

Write exclusively in rich, engaging Khmer script:`;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${state.geminiApiKey}`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: recapPrompt }] }] })
      });
      const data = await resp.json();
      const resultScript = data.candidates[0].content.parts[0].text;
      renderRecapScript(resultScript);
    } catch (e) {
      console.warn("Gemini recap error, falling back:", e);
      fallbackRecapGenerator(title, genre, plot);
    }
  } else {
    // Free built-in template generator with translated plot
    const translatedPlot = await translateWithFreeGoogle(plot);
    fallbackRecapGenerator(title, genre, translatedPlot);
  }

  elements.btnGenerateRecap.disabled = false;
  elements.btnGenerateRecap.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> បង្កើតស្គ្រីបអត្ថាធិប្បាយខ្មែរ (Generate Khmer Recap Script)`;
}

function fallbackRecapGenerator(title, genre, translatedPlot) {
  const script = `🎙️ 【ស្គ្រីបអត្ថាធិប្បាយសង្ខេបភាពយន្ត - CineKhmer AI Studio】
🎬 ចំណងជើង៖ ${title}
📌 ប្រភេទ៖ ${genre}

───────────────────────────────────────────────
🎬 [វិនាទី 0:00 - 0:15] បើកឆាកទាក់ទាញអារម្មណ៍ (Viral Hook):
"តើអ្នកនឹងមានអារម្មណ៍បែបណា ប្រសិនបើថ្ងៃមួយ អ្នកភ្ញាក់ឡើង ហើយដឹងថា ពិភពលោកទាំងមូលដែលអ្នកកំពុងរស់នៅ គឺជាការបោកប្រាស់ដ៏ធំបំផុត?! នៅក្នុងវីដេអូថ្ងៃនេះ ខ្ញុំនឹងនាំអ្នកទាំងអស់គ្នាមកទស្សនាខ្សែភាពយន្តដ៏រន្ធត់ និងកក្រើកបំផុតមួយ..."

⚡ [វិនាទី 0:15 - 1:30] ដំណើររឿងលម្អិត (Story Progression):
"${translatedPlot}"

🔥 [វិនាទី 1:30 - 2:30] ឈុតកំពូល និងគ្រោះថ្នាក់ (Intense Climax):
"ស្ថានការណ៍កាន់តែតានតឹងឡើង! ពេលដែលការពិតដ៏ខ្មៅងងឹតត្រូវបានទម្លាយ ពេលវេលាសល់ត្រឹមតែរាប់ថយក្រោយប៉ុណ្ណោះ។ គាត់គ្មានផ្លូវរើសក្រៅពីត្រូវប្រថុយជីវិតដើម្បីប្រឈមមុខនឹងគ្រោះថ្នាក់នេះទេ!"

🌟 [វិនាទី 2:30 - 3:00] បញ្ចប់សាច់រឿង និងពាក្យផ្តាំផ្ញើ (Cliffhanger & Outro):
"ខ្សែភាពយន្តនេះបានបង្រៀនយើងថា ភាពក្លាហានពិតប្រាកដ គឺការហ៊ានឈរឡើងប្រឆាំងនឹងភាពអយុត្តិធម៌។ ប្រសិនបើប្រិយមិត្តទាំងអស់គ្នាចូលចិត្តការសង្ខេបភាពយន្តនេះ កុំភ្លេចចុច Like, Share និង Follow ដើម្បីទស្សនាវីដេអូបន្តទៀត! សូមអរគុណ!"`;

  renderRecapScript(script);
}

function renderRecapScript(text) {
  elements.recapOutputContainer.textContent = text;
  elements.audioPlayerHud.classList.remove("hidden");
  elements.audioStatus.textContent = "រួចរាល់សម្រាប់ស្តាប់ការអានសាកល្បង";
}

// ==========================================
// Text-To-Speech (TTS) Voiceover
// ==========================================
function speakKhmerText(text) {
  if (!("speechSynthesis" in window)) {
    alert("Browser របស់អ្នកមិនទាន់គាំទ្រ Speech Synthesis API ទេ។");
    return;
  }

  window.speechSynthesis.cancel();

  // Clean script formatting markers
  const clean = text.replace(/\[.*?\]/g, "").replace(/【.*?】/g, "").replace(/🎬|⚡|🔥|🌟|🎙️/g, "").trim();

  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.rate = state.ttsSpeed;
  utterance.pitch = 1.0;

  // Search for Khmer voice or suitable Asian/universal voice
  const voices = window.speechSynthesis.getVoices();
  const kmVoice = voices.find(v => v.lang.startsWith("km")) || voices.find(v => v.lang.startsWith("th")) || voices[0];
  if (kmVoice) utterance.voice = kmVoice;

  utterance.onstart = () => {
    state.isPlayingAudio = true;
    elements.audioWaves?.classList.add("playing");
    elements.audioStatus.textContent = "កំពុងអានសាកល្បង...";
    elements.btnTtsToggle.innerHTML = `<i class="fa-solid fa-pause"></i>`;
  };

  utterance.onend = utterance.onerror = () => {
    state.isPlayingAudio = false;
    elements.audioWaves?.classList.remove("playing");
    elements.audioStatus.textContent = "ការអានត្រូវបានបញ្ចប់";
    elements.btnTtsToggle.innerHTML = `<i class="fa-solid fa-play"></i>`;
  };

  window.speechSynthesis.speak(utterance);
}

// ==========================================
// Video Player & Live Subtitle Canvas Engine
// ==========================================
function initVideoPlayer() {
  const video = elements.cinemaVideo;

  // Video time update -> Sync subtitles & Khmer Voiceover Dubbing
  video.addEventListener("timeupdate", () => {
    const currentTime = video.currentTime;
    syncSubtitleWithVideo(currentTime);
  });

  // When video is paused, pause any speaking audio
  video.addEventListener("pause", () => {
    if (state.currentPlayingAudio) {
      state.currentPlayingAudio.pause();
    }
    if (elements.dubbingLiveBadge) {
      elements.dubbingLiveBadge.classList.add("hidden");
    }
  });

  // When video seeks, reset last spoken cue to allow re-speaking
  video.addEventListener("seeked", () => {
    state.lastSpokenCueIndex = -1;
    if (state.currentPlayingAudio) {
      state.currentPlayingAudio.pause();
      state.currentPlayingAudio = null;
    }
    video.volume = parseFloat(video.dataset.originalVolume || "1.0");
    if (elements.dubbingLiveBadge) {
      elements.dubbingLiveBadge.classList.add("hidden");
    }
  });

  // Load custom video file from file input
  elements.videoFileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      handleVideoUpload(e.target.files[0]);
    }
  });

  // Drag and drop video directly onto the video player container
  const wrapper = elements.videoWrapper;
  if (wrapper) {
    wrapper.addEventListener("dragover", (e) => {
      e.preventDefault();
      wrapper.style.borderColor = "var(--cyan-primary)";
      wrapper.style.boxShadow = "0 0 30px rgba(6, 182, 212, 0.4)";
    });
    wrapper.addEventListener("dragleave", (e) => {
      e.preventDefault();
      wrapper.style.borderColor = "";
      wrapper.style.boxShadow = "";
    });
    wrapper.addEventListener("drop", (e) => {
      e.preventDefault();
      wrapper.style.borderColor = "";
      wrapper.style.boxShadow = "";
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.type.startsWith("video/") || file.name.match(/\.(mp4|webm|mkv|mov)$/i)) {
          handleVideoUpload(file);
        }
      }
    });
  }

  // Dubbing sliders and controls
  if (elements.videoDuckingSlider) {
    elements.videoDuckingSlider.addEventListener("input", (e) => {
      state.videoDuckingLevel = parseFloat(e.target.value) / 100;
      if (elements.duckingValDisplay) elements.duckingValDisplay.textContent = `${e.target.value}%`;
    });
  }

  if (elements.dubbingVolumeSlider) {
    elements.dubbingVolumeSlider.addEventListener("input", (e) => {
      state.dubbingVolume = parseFloat(e.target.value) / 100;
      if (elements.dubbingVolDisplay) elements.dubbingVolDisplay.textContent = `${e.target.value}%`;
    });
  }

  if (elements.selectTtsEngine) {
    elements.selectTtsEngine.addEventListener("change", (e) => {
      state.ttsEngine = e.target.value;
    });
  }

  if (elements.btnPreloadAudio) {
    elements.btnPreloadAudio.addEventListener("click", preloadSubtitleAudio);
  }

  if (elements.btnExportAllMp3) {
    elements.btnExportAllMp3.addEventListener("click", exportAllKhmerAudioClips);
  }

  // Load animated canvas demo simulator
  elements.btnLoadDemoVideo.addEventListener("click", () => {
    startDemoCanvasVideo();
  });

  // Start with demo simulator by default so it's instantly visual!
  startDemoCanvasVideo();
}

function startDemoCanvasVideo() {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext("2d");

  let frame = 0;
  clearInterval(state.demoCanvasInterval);

  function drawCinemaScene() {
    frame++;
    // Dark sci-fi cinema gradient background
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, "#060913");
    grad.addColorStop(0.5, "#0f172a");
    grad.addColorStop(1, "#020617");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Glowing futuristic cinema grid
    ctx.strokeStyle = "rgba(6, 182, 212, 0.12)";
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Animated holographic sound waves
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 0; x < canvas.width; x += 10) {
      const y = canvas.height / 2 + Math.sin((x + frame * 4) * 0.02) * 50;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Cinema Scene Title Card
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 32px 'Outfit', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("CINEKHMER AI - LIVE STUDIO PREVIEW", canvas.width / 2, 120);

    ctx.fillStyle = "#06b6d4";
    ctx.font = "18px 'Outfit', sans-serif";
    ctx.fillText("AI Motion Subtitle & Khmer Voiceover Dubbing Active", canvas.width / 2, 160);

    // Timecode box
    const seconds = Math.floor(frame / 30);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const tc = `REC 00:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    ctx.fillStyle = "rgba(244, 63, 94, 0.8)";
    ctx.fillRect(canvas.width / 2 - 80, 200, 160, 36);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px 'JetBrains Mono', monospace";
    ctx.fillText(tc, canvas.width / 2, 224);
  }

  state.demoCanvasInterval = setInterval(drawCinemaScene, 1000 / 30);

  if (canvas.captureStream) {
    const stream = canvas.captureStream(30);
    elements.cinemaVideo.srcObject = stream;
    elements.cinemaVideo.play().catch(() => {});
    elements.videoFilename.textContent = "វីដេអូ៖ Animated Cinema Canvas Simulator";
  }
}

function handleVideoUpload(file) {
  const video = elements.cinemaVideo;
  elements.videoFilename.textContent = `វីដេអូ៖ ${file.name}`;
  video.src = URL.createObjectURL(file);
  video.load();
  video.play().catch(() => {});

  // If user hasn't loaded subtitles yet, automatically offer sample action cues with Khmer translation
  if (state.subtitles.length === 0 || !state.subtitles.some(s => s.translated)) {
    elements.rawSubInput.value = SAMPLES.action;
    parseInputToSubtitles();
    const sampleTranslations = [
      "មេបញ្ជាការ យើងបានបាត់ទំនាក់ទំនងជាមួយវិស័យទី ៧។",
      "តើអ្នកចង់បានន័យថាបាត់ទំនាក់ទំនងយ៉ាងណា? ពិនិត្យរ៉ាដាបម្រុងទុក!",
      "ក្រឡាចត្រង្គបរិវេណទាំងមូលទើបតែងងឹត។ អ្វីមួយកំពុងមក។",
      "ស្តាប់ខ្ញុំដោយយកចិត្តទុកដាក់។ នាំជនស៊ីវិលទាំងអស់ទៅកាន់លេណដ្ឋានក្រោមដីឥឡូវនេះ!",
      "លោកម្ចាស់បានរំលោភទ្វារការពារខាងក្រៅ!",
      "ចាក់សោហើយផ្ទុក! ថ្ងៃនេះយើងកាន់បន្ទាត់នេះមិនថាមានអ្វីកើតឡើងទេ!"
    ];
    state.subtitles.forEach((s, idx) => {
      if (sampleTranslations[idx]) s.translated = sampleTranslations[idx];
    });
    renderSubtitlesList();
    updateTimelineView();
    preloadSubtitleAudio();
  } else {
    preloadSubtitleAudio();
  }

  // Switch to video tab so they immediately see the player
  document.getElementById("tab-btn-video")?.click();
}

function syncSubtitleWithVideo(currentTime) {
  const isBilingual = elements.toggleBilingualPreview?.checked ?? true;
  const isDubbing = elements.toggleKhmerDubbing?.checked ?? true;
  const activeCue = state.subtitles.find(sub => currentTime >= sub.startTime && currentTime <= sub.endTime);

  if (activeCue) {
    elements.overlayKhmerText.style.display = "inline-block";
    elements.overlayKhmerText.textContent = activeCue.translated || activeCue.original;

    if (isBilingual && activeCue.translated) {
      elements.overlayOriginalText.style.display = "inline-block";
      elements.overlayOriginalText.textContent = activeCue.original;
    } else {
      elements.overlayOriginalText.style.display = "none";
    }

    // Trigger Synchronized Khmer AI Voiceover Dubbing
    if (isDubbing && state.lastSpokenCueIndex !== activeCue.index) {
      state.lastSpokenCueIndex = activeCue.index;
      playKhmerDubbingCue(activeCue);
    }

    // Highlight timeline item
    document.querySelectorAll(".timeline-cue-item").forEach(item => item.classList.remove("current-active"));
    const activeItem = document.getElementById(`timeline-cue-${activeCue.index}`);
    if (activeItem) {
      activeItem.classList.add("current-active");
      activeItem.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  } else {
    elements.overlayKhmerText.style.display = "none";
    elements.overlayOriginalText.style.display = "none";
  }
}

function playKhmerDubbingCue(cue) {
  const text = (cue.translated || cue.original || "").trim();
  if (!text) return;

  const video = elements.cinemaVideo;
  const engine = elements.selectTtsEngine ? elements.selectTtsEngine.value : "neural";
  const duckingLevel = state.videoDuckingLevel;
  const dubbingVolume = state.dubbingVolume;

  // Show live dubbing HUD badge on video
  if (elements.dubbingLiveBadge) {
    elements.dubbingLiveBadge.classList.remove("hidden");
    elements.dubbingBadgeText.textContent = `AI កំពុងនិយាយ (#${cue.index}): "${text.slice(0, 25)}..."`;
  }

  // Smooth Audio Ducking: Lower original movie volume
  if (!video.dataset.originalVolume) {
    video.dataset.originalVolume = (video.volume || 1.0).toString();
  }
  video.volume = duckingLevel;

  // Stop previous speech
  if (state.currentPlayingAudio) {
    state.currentPlayingAudio.pause();
    state.currentPlayingAudio.currentTime = 0;
    state.currentPlayingAudio = null;
  }
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }

  function onSpeechEnd() {
    // Restore video volume
    const origVol = parseFloat(video.dataset.originalVolume || "1.0");
    video.volume = origVol;
    if (elements.dubbingLiveBadge) {
      elements.dubbingLiveBadge.classList.add("hidden");
    }
    state.currentPlayingAudio = null;
  }

  if (engine === "neural") {
    // Play native Google Khmer TTS audio from local /api/tts endpoint
    let audio = state.audioCache.get(cue.index);
    if (!audio) {
      const audioUrl = `/api/tts?text=${encodeURIComponent(text)}`;
      audio = new Audio(audioUrl);
      state.audioCache.set(cue.index, audio);
    }
    audio.volume = dubbingVolume;
    audio.currentTime = 0;
    state.currentPlayingAudio = audio;

    audio.onended = onSpeechEnd;
    audio.onerror = () => {
      // Fallback to speech synthesis if network fails
      speakKhmerTextWithCallback(text, onSpeechEnd);
    };

    audio.play().catch(err => {
      console.warn("Audio play issue, falling back to Web Speech:", err);
      speakKhmerTextWithCallback(text, onSpeechEnd);
    });
  } else {
    speakKhmerTextWithCallback(text, onSpeechEnd);
  }
}

function speakKhmerTextWithCallback(text, onEnd) {
  if (!("speechSynthesis" in window)) {
    if (onEnd) onEnd();
    return;
  }
  const clean = text.replace(/\[.*?\]/g, "").replace(/【.*?】/g, "").replace(/🎬|⚡|🔥|🌟|🎙️/g, "").trim();
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.rate = state.ttsSpeed;
  utterance.pitch = 1.0;

  const voices = window.speechSynthesis.getVoices();
  const kmVoice = voices.find(v => v.lang.startsWith("km")) || voices.find(v => v.lang.startsWith("th")) || voices[0];
  if (kmVoice) utterance.voice = kmVoice;

  utterance.onend = utterance.onerror = () => {
    if (onEnd) onEnd();
  };
  window.speechSynthesis.speak(utterance);
}

function preloadSubtitleAudio() {
  if (state.subtitles.length === 0) return;
  let count = 0;
  state.subtitles.forEach(cue => {
    const text = (cue.translated || cue.original || "").trim();
    if (text) {
      const audioUrl = `/api/tts?text=${encodeURIComponent(text)}`;
      const audio = new Audio();
      audio.preload = "auto";
      audio.src = audioUrl;
      state.audioCache.set(cue.index, audio);
      count++;
    }
  });

  if (elements.btnPreloadAudio) {
    elements.btnPreloadAudio.innerHTML = `<i class="fa-solid fa-check text-cyan"></i> Preloaded (${count})`;
    setTimeout(() => {
      elements.btnPreloadAudio.innerHTML = `<i class="fa-solid fa-bolt"></i> Pre-buffer Audio`;
    }, 3000);
  }
}

function exportAllKhmerAudioClips() {
  if (state.subtitles.length === 0) {
    alert("សូមបញ្ចូល និងបកប្រែ Subtitle ជាមុនសិន!");
    return;
  }
  state.subtitles.forEach((cue, i) => {
    const text = (cue.translated || cue.original || "").trim();
    if (text) {
      const link = document.createElement("a");
      link.href = `/api/tts?text=${encodeURIComponent(text)}`;
      link.download = `cue_${String(i + 1).padStart(3, "0")}_khmer.mp3`;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  });
}

function updateTimelineView() {
  const container = elements.playerTimelineList;
  if (state.subtitles.length === 0) {
    container.innerHTML = `<div class="empty-placeholder"><p>មិនទាន់មាន Subtitle សម្រាប់ Video</p></div>`;
    return;
  }

  container.innerHTML = state.subtitles.map(cue => `
    <div id="timeline-cue-${cue.index}" class="timeline-cue-item" data-start="${cue.startTime}">
      <div class="timeline-cue-header">
        <span class="timeline-time">${cue.timecode}</span>
        <button class="btn-timeline-play-audio" data-index="${cue.index}" title="ចាក់ស្តាប់បន្ទាត់នេះ">
          <i class="fa-solid fa-volume-high"></i>
        </button>
      </div>
      <span class="timeline-text">${escapeHtml(cue.translated || cue.original)}</span>
    </div>
  `).join("");

  container.querySelectorAll(".timeline-cue-item").forEach(item => {
    item.addEventListener("click", (e) => {
      if (e.target.closest(".btn-timeline-play-audio")) return;
      const start = parseFloat(item.dataset.start);
      elements.cinemaVideo.currentTime = start;
      elements.cinemaVideo.play();
    });
  });

  container.querySelectorAll(".btn-timeline-play-audio").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.index);
      const cue = state.subtitles.find(s => s.index === idx);
      if (cue) playKhmerDubbingCue(cue);
    });
  });
}

// ==========================================
// Glossary Manager
// ==========================================
function initGlossary() {
  renderGlossaryTable();
}

function renderGlossaryTable() {
  const tbody = elements.glossaryTbody;
  tbody.innerHTML = state.glossary.map((item, idx) => `
    <tr>
      <td><strong>${escapeHtml(item.term)}</strong></td>
      <td class="text-cyan">${escapeHtml(item.translation)}</td>
      <td><span class="tag">${escapeHtml(item.category || "ទូទៅ")}</span></td>
      <td>
        <button class="btn-card-action btn-delete-term" data-index="${idx}" title="លុប">
          <i class="fa-solid fa-trash text-red"></i>
        </button>
      </td>
    </tr>
  `).join("");

  tbody.querySelectorAll(".btn-delete-term").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index);
      state.glossary.splice(idx, 1);
      renderGlossaryTable();
    });
  });
}

function addGlossaryTerm() {
  const term = prompt("បញ្ចូលពាក្យដើម / ឈ្មោះតួអង្គ (ឧ. Iron Man):");
  if (!term) return;
  const translation = prompt(`បញ្ចូលការបកប្រែជាភាសាខ្មែរសម្រាប់ '${term}':`);
  if (!translation) return;

  state.glossary.push({
    term: term.trim(),
    translation: translation.trim(),
    category: "កំណត់ផ្ទាល់ខ្លួន (Custom)"
  });
  renderGlossaryTable();
}

// ==========================================
// Quick Sample Loader
// ==========================================
function initSampleChips() {
  elements.sampleChips.forEach(chip => {
    chip.addEventListener("click", () => {
      const type = chip.dataset.sample;
      if (type === "recap") {
        // Switch to recap tab and load sample
        document.getElementById("tab-btn-recap").click();
        const r = SAMPLES.recap;
        elements.recapMovieTitle.value = r.title;
        elements.recapMovieGenre.value = r.genre;
        elements.recapPlotText.value = r.plot;
      } else {
        // Load into subtitle translator
        document.getElementById("tab-btn-subtitles").click();
        elements.rawSubInput.value = SAMPLES[type];
        parseInputToSubtitles();
      }
    });
  });
}

// ==========================================
// Event Bindings
// ==========================================
function bindEvents() {
  // Input subtitle live parse
  elements.rawSubInput.addEventListener("input", parseInputToSubtitles);
  elements.btnClearInput.addEventListener("click", () => {
    elements.rawSubInput.value = "";
    parseInputToSubtitles();
  });

  // Subtitle translation button
  elements.btnTranslateSubtitles.addEventListener("click", translateAllSubtitles);

  // Export buttons
  elements.btnExportSrt.addEventListener("click", () => {
    const srt = generateSrtOutput(false);
    downloadFile(srt, "movie_subtitles_khmer.srt");
  });

  elements.btnExportBilingual.addEventListener("click", () => {
    const srt = generateSrtOutput(true);
    downloadFile(srt, "movie_subtitles_bilingual.srt");
  });

  elements.btnExportVtt.addEventListener("click", () => {
    const vtt = generateVttOutput();
    downloadFile(vtt, "movie_subtitles_khmer.vtt");
  });

  elements.btnCopyTranslated.addEventListener("click", () => {
    const srt = generateSrtOutput(false);
    navigator.clipboard.writeText(srt).then(() => alert("បានចម្លង Subtitle ខ្មែរទៅកាន់ Clipboard រួចរាល់!"));
  });

  // Send to player button
  elements.btnSendToPlayer.addEventListener("click", () => {
    document.getElementById("tab-btn-video").click();
    updateTimelineView();
    elements.cinemaVideo.play();
  });

  // Recap Generator
  elements.btnGenerateRecap.addEventListener("click", generateMovieRecap);

  elements.btnSpeakRecap.addEventListener("click", () => {
    const text = elements.recapOutputContainer.textContent;
    if (text) speakKhmerText(text);
  });

  elements.btnTtsToggle.addEventListener("click", () => {
    if (state.isPlayingAudio) {
      window.speechSynthesis.cancel();
      state.isPlayingAudio = false;
      elements.audioWaves?.classList.remove("playing");
      elements.audioStatus.textContent = "បានផ្អាកសំឡេង";
      elements.btnTtsToggle.innerHTML = `<i class="fa-solid fa-play"></i>`;
    } else {
      const text = elements.recapOutputContainer.textContent;
      if (text) speakKhmerText(text);
    }
  });

  elements.btnCopyRecap.addEventListener("click", () => {
    const text = elements.recapOutputContainer.textContent;
    if (text) {
      navigator.clipboard.writeText(text).then(() => alert("បានចម្លងស្គ្រីបអត្ថាធិប្បាយទៅកាន់ Clipboard!"));
    }
  });

  elements.btnDownloadRecap.addEventListener("click", () => {
    const text = elements.recapOutputContainer.textContent;
    if (text) downloadFile(text, "khmer_movie_recap_script.txt");
  });

  // Glossary
  elements.btnAddGlossaryTerm.addEventListener("click", addGlossaryTerm);

  // Settings Modal Controls
  elements.btnOpenSettings.addEventListener("click", () => elements.settingsModal.classList.remove("hidden"));
  elements.btnCloseSettings.addEventListener("click", () => elements.settingsModal.classList.add("hidden"));
  elements.settingsModal.addEventListener("click", (e) => {
    if (e.target === elements.settingsModal) elements.settingsModal.classList.add("hidden");
  });

  document.querySelectorAll('input[name="ai_provider"]').forEach(radio => {
    radio.addEventListener("change", (e) => updateRadioCardStyles(e.target.value));
  });

  elements.ttsVoiceSpeed.addEventListener("input", (e) => {
    elements.speedValue.textContent = `${e.target.value}x`;
  });

  elements.btnSaveSettings.addEventListener("click", () => {
    const selectedProvider = document.querySelector('input[name="ai_provider"]:checked')?.value || "free";
    const apiKey = elements.geminiApiKeyInput.value.trim();
    const speed = parseFloat(elements.ttsVoiceSpeed.value);

    state.aiProvider = selectedProvider;
    state.geminiApiKey = apiKey;
    state.ttsSpeed = speed;

    localStorage.setItem("cinekhmer_ai_provider", selectedProvider);
    localStorage.setItem("cinekhmer_gemini_key", apiKey);
    localStorage.setItem("cinekhmer_tts_speed", speed.toString());

    updateEngineBadge();
    elements.settingsModal.classList.add("hidden");
  });
}
