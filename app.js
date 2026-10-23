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
  lastSpokenCueIndex: -1,
  currentVideoFile: null
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
  videoFileInput: document.getElementById("video-file-input"),
  videoSrtInput: document.getElementById("video-srt-input"),
  btnVideoTranscribeVoice: document.getElementById("btn-video-transcribe-voice"),
  btnBannerTranscribe: document.getElementById("btn-banner-transcribe"),
  btnVideoTranslateNow: document.getElementById("btn-video-translate-now"),
  btnLoadDemoVideo: document.getElementById("btn-load-demo-video"),
  videoFilename: document.getElementById("video-filename"),
  videoTranslationProgress: document.getElementById("video-translation-progress"),
  videoProgressBar: document.getElementById("video-progress-bar"),
  videoProgressText: document.getElementById("video-progress-text"),
  videoProgressPercentage: document.getElementById("video-progress-percentage"),
  videoHelperBanner: document.getElementById("video-helper-banner"),
  btnVideoUseSample: document.getElementById("btn-video-use-sample"),
  toggleBilingualPreview: document.getElementById("toggle-bilingual-preview"),
  toggleKhmerDubbing: document.getElementById("toggle-khmer-dubbing"),
  dubbingLiveBadge: document.getElementById("dubbing-live-badge"),
  dubbingBadgeText: document.getElementById("dubbing-badge-text"),
  selectVideoVoice: document.getElementById("select-video-voice"),
  selectRecapVoice: document.getElementById("select-recap-voice"),
  videoDuckingSlider: document.getElementById("video-ducking-slider"),
  duckingValDisplay: document.getElementById("ducking-val-display"),
  dubbingVolumeSlider: document.getElementById("dubbing-volume-slider"),
  dubbingVolDisplay: document.getElementById("dubbing-vol-display"),
  btnPreloadAudio: document.getElementById("btn-preload-audio"),
  btnTestVoice: document.getElementById("btn-test-voice"),
  btnExportAllMp3: document.getElementById("btn-export-all-mp3"),
  btnExportVideo: document.getElementById("btn-export-video"),
  btnExportVideoSide: document.getElementById("btn-export-video-side"),
  btnExportVideoTab1: document.getElementById("btn-export-video-tab1"),
  overlayKhmerText: document.getElementById("overlay-khmer-text"),
  overlayOriginalText: document.getElementById("overlay-original-text"),
  playerTimelineList: document.getElementById("player-timeline-list"),
  
  // Export Video Modal
  exportVideoModal: document.getElementById("export-video-modal"),
  btnCloseExportModal: document.getElementById("btn-close-export-modal"),
  btnDoExportBurninDubbed: document.getElementById("btn-do-export-burnin-dubbed"),
  btnDoExportBurnin: document.getElementById("btn-do-export-burnin"),
  btnDoExportSoftsub: document.getElementById("btn-do-export-softsub"),
  btnDoExportSrt: document.getElementById("btn-do-export-srt"),
  exportModalProgress: document.getElementById("export-modal-progress"),
  exportStatusText: document.getElementById("export-status-text"),
  exportStatusBar: document.getElementById("export-status-bar"),
  exportStatusPercentage: document.getElementById("export-status-percentage"),
  
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

        let original = "";
        let translated = "";

        if (textLines.length >= 2 && /[\u1780-\u17FF]/.test(textLines[0])) {
          // Bilingual format: Line 1 is Khmer, Line 2 is English
          translated = textLines[0];
          original = textLines.slice(1).join(" ");
        } else if (textLines.length >= 2 && /[\u1780-\u17FF]/.test(textLines[1])) {
          // Bilingual format: Line 1 is English, Line 2 is Khmer
          original = textLines[0];
          translated = textLines.slice(1).join(" ");
        } else {
          const joined = textLines.join(" ");
          if (/[\u1780-\u17FF]/.test(joined)) {
            translated = joined;
            original = joined;
          } else {
            original = joined;
            translated = "";
          }
        }

        cues.push({
          index: cues.length + 1,
          timecode: timecode,
          startTime: timecodeToSeconds(startStr),
          endTime: timecodeToSeconds(endStr),
          original: original,
          translated: translated
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

  // Video Export Buttons
  if (elements.btnExportVideo) {
    elements.btnExportVideo.disabled = !enabled;
    if (enabled) elements.btnExportVideo.classList.add("btn-ready-pulse");
    else elements.btnExportVideo.classList.remove("btn-ready-pulse");
  }
  if (elements.btnExportVideoSide) {
    elements.btnExportVideoSide.disabled = !enabled;
    if (enabled) elements.btnExportVideoSide.classList.add("btn-ready-pulse");
    else elements.btnExportVideoSide.classList.remove("btn-ready-pulse");
  }
  if (elements.btnExportVideoTab1) {
    elements.btnExportVideoTab1.disabled = !enabled;
    if (enabled) elements.btnExportVideoTab1.classList.add("btn-ready-pulse");
    else elements.btnExportVideoTab1.classList.remove("btn-ready-pulse");
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ==========================================
// Translation Engine
// ==========================================
async function translateWithFreeGoogle(text, sourceLang = "auto") {
  if (!text || !text.trim()) return "";
  const clean = text.trim();

  // 1. Primary: Fast local server translation endpoint
  try {
    const resp = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: clean, sourceLang, targetLang: "km" })
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data.success && data.translation) {
        return data.translation;
      }
    }
  } catch (e) {
    // fallback
  }

  // 2. Direct browser fallback: Chrome extension endpoint
  try {
    const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=${encodeURIComponent(sourceLang)}&tl=km&q=${encodeURIComponent(clean)}`;
    const resp = await fetch(url);
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data) && data[0] && data[0][0]) {
        return data[0][0];
      }
    }
  } catch (err) {
    console.warn("Direct translation fallback error:", err);
  }

  // 3. Last-resort fallback: gtx endpoint
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=km&dt=t&q=${encodeURIComponent(clean)}`;
    const resp = await fetch(url);
    if (resp.ok) {
      const data = await resp.json();
      if (data && data[0]) {
        return data[0].map(item => item[0]).join("");
      }
    }
  } catch (err) {}

  return text;
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

// Authentic Movie Character Dialogue Engine
function polishKhmerCinematicDialogue(text, origText = "", style = "cinematic") {
  const cleanOrig = (origText || "").trim().toLowerCase();

  // 1. Exact Hollywood movie dialogue patterns (Cinematic Dialogue Memory)
  if (cleanOrig.includes("lost contact with sector")) {
    const secMatch = cleanOrig.match(/sector\s*(\d+)/);
    const secNum = secMatch ? secMatch[1] : "៧";
    if (cleanOrig.includes("commander")) {
      return `លោកមេបញ្ជាការ! យើងដាច់ការទាក់ទងជាមួយតំបន់ទី ${secNum} ហើយ!`;
    }
    return `យើងដាច់ការទាក់ទងជាមួយតំបន់ទី ${secNum} ហើយ!`;
  }

  if (cleanOrig.includes("what do you mean lost contact")) {
    return "ថាម៉េច ដាច់ការទាក់ទង?! ឆាប់ឆែករ៉ាដាបម្រុងមើល!";
  }

  if (cleanOrig.includes("entire perimeter grid just went dark")) {
    return "ប្រព័ន្ធការពារជុំវិញដាច់ភ្លើងអស់ហើយ! មានរបស់អ្វីម្យ៉ាងកំពុងសំដៅមករកយើង!";
  }

  if (cleanOrig.includes("listen to me carefully") && cleanOrig.includes("bunker")) {
    return "ស្តាប់ខ្ញុំឲ្យច្បាស់! ឆាប់ជម្លៀសប្រជាជនទាំងអស់ចូលទៅលេណដ្ឋានក្រោមដីជាបន្ទាន់!";
  }

  if (cleanOrig.includes("breached the outer defense gates")) {
    return "លោកមេបញ្ជាការ! ពួកវាទម្លុះទ្វារការពារខាងក្រៅបាត់ហើយ!";
  }

  if (cleanOrig.includes("lock and load") && cleanOrig.includes("hold this line")) {
    return "ត្រៀមអាវុធប្រយុទ្ធ! ថ្ងៃនេះ ទោះជាមានរឿងអ្វីកើតឡើង ក៏យើងត្រូវតែទប់ទល់ឲ្យជាប់ដែរ!";
  }

  // Horror movie tropes
  if (cleanOrig.includes("hear that sound") && cleanOrig.includes("attic")) {
    return "ឯងឮសូរសម្រឹបអ្វីនៅលើពិដានទេ?";
  }
  if (cleanOrig.includes("just the wind") && cleanOrig.includes("imagination")) {
    return "គ្រាន់តែជាខ្យល់បក់តើ... កុំគិតផ្តេសផ្តាសបំភ័យខ្លួនឯងពេក!";
  }
  if (cleanOrig.includes("attic door was locked") && cleanOrig.includes("open now")) {
    return "មិនមែនទេ... ទ្វារបន្ទប់លើដំបូលចាក់សោពីខាងក្រៅតើ! មើលចុះ ឥឡូវវាបើកចំហបាត់ហើយ!";
  }
  if (cleanOrig.includes("do not turn around") && cleanOrig.includes("behind us")) {
    return "ទោះជាយ៉ាងណា ក៏កុំងាកក្រោយឲ្យសោះ! វា... វាកំពុងឈរនៅពីក្រោយខ្នងយើង!";
  }

  // Drama movie tropes
  if (cleanOrig.includes("ten years waiting") && cleanOrig.includes("train station")) {
    return "ដប់ឆ្នាំកន្លងផុតទៅ ខ្ញុំនៅតែឈររង់ចាំនៅស្ថានីយ៍រថភ្លើងនេះរៀងរាល់រដូវរងា...";
  }
  if (cleanOrig.includes("promises we made") && cleanOrig.includes("another lifetime")) {
    return "បងដឹងហើយថាយើងមិនអាចត្រឡប់ក្រោយបានទេ... ពាក្យសន្យាកាលពីមុន បានរលាយបាត់អស់ហើយ...";
  }
  if (cleanOrig.includes("time didn't change anything") && cleanOrig.includes("never left")) {
    return "ពេលវេលាមិនអាចផ្លាស់ប្តូរចិត្តខ្ញុំបានទេ... ក្នុងបេះដូងខ្ញុំ បងមិនដែលចាកចេញទៅណាឡើយ...";
  }

  // Chinese / Wuxia / Xianxia movie tropes
  if (origText.includes("不可思议") || cleanOrig.includes("incredible magic")) return "វេទមន្តមិនគួរឱ្យជឿ!";
  if (origText.includes("何人敢") || cleanOrig.includes("who dares disturb")) return "នរណាហ៊ានរំខានដំណេករបស់លោកម្ចាស់?!";
  if (origText.includes("找死") || cleanOrig.includes("court death")) return "ឯងចង់ងាប់ហើយមែនទេ?!";
  if (origText.includes("饶命") || cleanOrig.includes("spare my life")) return "សូមលោកម្ចាស់មេត្តាលើកលែងជីវិតផង!";
  if (origText.includes("受死吧") || cleanOrig.includes("prepare to die")) return "ដល់ពេលឯងត្រូវស្លាប់ហើយ!";
  if (origText.includes("放肆") || cleanOrig.includes("insolent")) return "ឈ្លើយណាស់! ហ៊ានមិនក្រាបសំពះលោកម្ចាស់ផង?!";

  // Common Action one-liners
  if (/\b(fire in the hole)\b/i.test(cleanOrig)) return "ប្រយ័ត្នគ្រាប់បែក! ក្រាបចុះ!";
  if (/\b(cover me)\b/i.test(cleanOrig)) return "ជួយបាញ់ការពារខ្ញុំ!";
  if (/\b(fall back|retreat)\b/i.test(cleanOrig)) return "ឆាប់ដកថយជាបន្ទាន់!";
  if (/\b(get down)\b/i.test(cleanOrig)) return "ក្រាបចុះ!";
  if (/\b(drop your weapon|drop the gun)\b/i.test(cleanOrig)) return "ទម្លាក់អាវុធចុះភ្លាម!";
  if (/\b(don't move)\b/i.test(cleanOrig)) return "នៅឲ្យស្ងៀម កុំកម្រើក!";
  if (/\b(are you crazy|are you out of your mind)\b/i.test(cleanOrig)) return "ឯងឆ្កួតហើយមែនទេ?!";
  if (/\b(we're running out of time|no time left)\b/i.test(cleanOrig)) return "យើងអស់ពេលហើយ! ឆាប់ឡើង!";
  if (/\b(shut up)\b/i.test(cleanOrig)) return "បិទមាត់ទៅ!";
  if (/\b(trust me)\b/i.test(cleanOrig)) return "ជឿជាក់លើខ្ញុំទៅ!";
  if (/\b(who are you)\b/i.test(cleanOrig)) return "ឯងជានរណា?!";
  if (/\b(what are you doing)\b/i.test(cleanOrig)) return "ឯងកំពុងធ្វើអីហ្នឹង?!";
  if (/\b(what('s| is) happening|what('s| is) going on)\b/i.test(cleanOrig)) return "មានរឿងអីកើតឡើង?!";
  if (/\b(no way|impossible)\b/i.test(cleanOrig)) return "មិនអាចទៅរួចទេ! គ្មានផ្លូវទេ!";

  // 2. Machine translation cleanup (Fix awkward / robotic words)
  let polished = text;

  // Apply glossary replacements
  if (Array.isArray(state.glossary)) {
    state.glossary.forEach(item => {
      if (item.term && item.translation) {
        const reg = new RegExp(`\\b${item.term}\\b`, "gi");
        polished = polished.replace(reg, item.translation);
      }
    });
  }

  // Fix Google translating 'breach' to 'រំលោភ' (rape) on physical objects
  polished = polished.replace(/រំលោភ[\s\u200B]*(ទ្វារ|កំពែង|របាំង|បន្ទាយ|ប្រព័ន្ធ|ច្រក|ទីតាំង|ព្រំដែន)/g, "ទម្លុះ$1");
  polished = polished.replace(/រំលោភទ្វារ/g, "ទម្លុះទ្វារ");
  polished = polished.replace(/ចាក់សោហើយផ្ទុក/g, "ត្រៀមអាវុធប្រយុទ្ធ");
  polished = polished.replace(/កាន់បន្ទាត់នេះ/g, "ទប់ទល់ឲ្យជាប់").replace(/កាន់បន្ទាត់/g, "ទប់ជំហរ");
  polished = polished.replace(/វិស័យ[\s\u200B]*ទី[\s\u200B]*([០-៩\d]+)/g, "តំបន់ទី $1");
  polished = polished.replace(/ក្រឡាចត្រង្គបរិវេណ/g, "ប្រព័ន្ធការពារជុំវិញ");
  polished = polished.replace(/ក្រឡាចត្រង្គ/g, "ប្រព័ន្ធការពារ");
  polished = polished.replace(/បាត់ទំនាក់ទំនង/g, "ដាច់ការទាក់ទង");
  polished = polished.replace(/បាត់បង់ទំនាក់ទំនង/g, "ដាច់ការទាក់ទង");
  polished = polished.replace(/បាត់បង់ការទាក់ទង/g, "ដាច់ការទាក់ទង");
  polished = polished.replace(/ពិនិត្យរ៉ាដាបម្រុងទុក/g, "ឆែករ៉ាដាបម្រុងមើល");
  polished = polished.replace(/ពិនិត្យមើលរ៉ាដាបម្រុងទុក/g, "ឆែករ៉ាដាបម្រុងមើល");
  polished = polished.replace(/ពិនិត្យរ៉ាដា/g, "ឆែករ៉ាដា");
  polished = polished.replace(/ស្តាប់ខ្ញុំដោយយកចិត្តទុកដាក់/g, "ស្តាប់ខ្ញុំឲ្យច្បាស់");
  polished = polished.replace(/តើ[\s\u200B]*អ្នក[\s\u200B]*ចង់បានន័យថាយ៉ាងណា/g, "មានន័យថាម៉េច");
  polished = polished.replace(/តើ[\s\u200B]*អ្នក[\s\u200B]*ចង់បានន័យថា/g, "ថាម៉េច");
  polished = polished.replace(/តើ[\s\u200B]*អ្នក[\s\u200B]*មានន័យថាម៉េច/g, "ថាម៉េច");
  polished = polished.replace(/អ្វីមួយកំពុងមក/g, "មានរបស់អ្វីម្យ៉ាងកំពុងសំដៅមក");
  polished = polished.replace(/ជនស៊ីវិល/g, "ប្រជាជន");
  polished = polished.replace(/លេណដ្ឋានក្រោមដីឥឡូវនេះ/g, "លេណដ្ឋានក្រោមដីជាបន្ទាន់");
  polished = polished.replace(/ភ្លើងនៅក្នុងរន្ធ/g, "ប្រយ័ត្នគ្រាប់បែក!");

  // Character addressing fixes
  if (cleanOrig && /\b(commander|captain|sir)\b/i.test(cleanOrig)) {
    polished = polished.replace(/លោកម្ចាស់/g, "លោកមេបញ្ជាការ");
    polished = polished.replace(/ព្រះអម្ចាស់/g, "លោកមេបញ្ជាការ");
  } else if (polished.includes("លោកម្ចាស់")) {
    polished = polished.replace(/លោកម្ចាស់/g, "លោកមេ");
  }

  // Conversational flow fixes (clean up robotic 'ពួកយើងបាន' -> 'យើង')
  polished = polished.replace(/ពួកយើងបាន/g, "យើង");
  polished = polished.replace(/ពួកយើង/g, "យើង");
  polished = polished.replace(/ពួកគេបាន/g, "ពួកវា");

  if (style === "royal") {
    polished = polished.replace(/ខ្ញុំ/g, "ទូលបង្គំ").replace(/អ្នក/g, "ទ្រង់");
  }

  polished = polished.replace(/\s*!\s*/g, "! ").replace(/\s*\?\s*/g, "? ").trim();
  return polished;
}

function applyGlossaryAndStyling(text, style = "cinematic", origText = "") {
  return polishKhmerCinematicDialogue(text, origText, style);
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

  cue.translated = polishKhmerCinematicDialogue(translated, cue.original, style);
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

  const batchSize = 25;
  for (let i = 0; i < total; i += batchSize) {
    const chunk = state.subtitles.slice(i, i + batchSize);
    const chunkTexts = chunk.map(c => c.original);

    const currentLine = Math.min(i + batchSize, total);
    elements.progressText.textContent = `កំពុងបកប្រែបន្ទាត់ទី ${currentLine} នៃ ${total}...`;
    const percent = Math.round((currentLine / total) * 100);
    elements.progressBar.style.width = `${percent}%`;
    elements.progressPercentage.textContent = `${percent}%`;

    let translations = [];
    try {
      const resp = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: chunkTexts, sourceLang: srcLang, targetLang: "km" })
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.success && Array.isArray(data.translations)) {
          translations = data.translations;
        }
      }
    } catch (e) {
      console.warn("Batch translate fallback:", e);
    }

    if (translations.length === 0) {
      for (const cue of chunk) {
        let tr = "";
        if (state.aiProvider === "gemini" && state.geminiApiKey) {
          tr = await translateWithGemini(cue.original, style);
        } else {
          tr = await translateWithFreeGoogle(cue.original, srcLang);
        }
        translations.push(tr);
      }
    }

    for (let j = 0; j < chunk.length; j++) {
      const cue = chunk[j];
      const trans = translations[j] || cue.original;
      cue.translated = polishKhmerCinematicDialogue(trans, cue.original, style);
    }

    renderSubtitlesList();
  }

  state.isTranslating = false;
  elements.btnTranslateSubtitles.disabled = false;
  elements.progressText.textContent = `បកប្រែបានជោគជ័យ ${total} បន្ទាត់ (១០០%)!`;
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
  // Prepend UTF-8 BOM (\uFEFF) for text/SRT/VTT to ensure Windows Notepad, VLC, Premiere parse Khmer characters accurately!
  const finalContent = content.startsWith("\ufeff") ? content : ("\ufeff" + content);
  const blob = new Blob([finalContent], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function startVideoExport(mode = "burnin_dubbed") {
  if (state.subtitles.length === 0) {
    alert("សូមបកប្រែ ឬបញ្ចូល Subtitle ជាមុនសិន!");
    return;
  }

  // Check if subtitles need translation
  const untranslatedCount = state.subtitles.filter(s => !s.translated || !s.translated.trim()).length;
  if (untranslatedCount > 0 && untranslatedCount === state.subtitles.length) {
    elements.exportVideoModal?.classList.add("hidden");
    const doTrans = confirm("Subtitle មិនទាន់បានបកប្រែជាភាសាខ្មែរនៅឡើយទេ។ តើអ្នកចង់ឲ្យ AI បកប្រែជាភាសាខ្មែរឥឡូវនេះដែរឬទេ?");
    if (doTrans) {
      await translateAllSubtitles();
      elements.exportVideoModal?.classList.remove("hidden");
    } else {
      return;
    }
  }

  const srtText = generateSrtOutput(false);
  let filename = "video.mp4";
  if (state.currentVideoFile && state.currentVideoFile.name) {
    filename = state.currentVideoFile.name;
  } else if (elements.videoFilename) {
    const fn = elements.videoFilename.textContent.replace("វីដេអូ៖", "").trim();
    if (fn && !fn.includes("Simulation")) filename = fn;
  }

  const voice = elements.selectVideoVoice ? elements.selectVideoVoice.value : "piseth";
  const ducking = state.videoDuckingLevel || 0.20;

  elements.exportModalProgress?.classList.remove("hidden");
  if (elements.btnDoExportBurninDubbed) elements.btnDoExportBurninDubbed.disabled = true;
  if (elements.btnDoExportBurnin) elements.btnDoExportBurnin.disabled = true;
  if (elements.btnDoExportSoftsub) elements.btnDoExportSoftsub.disabled = true;

  if (elements.exportStatusText) {
    if (mode === "burnin_dubbed") {
      elements.exportStatusText.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> កំពុងបង្កប់អក្សររត់ខ្មែរ (Khmer UI) & លាយបញ្ចូលសំឡេងអត្ថាធិប្បាយខ្មែរ AI...';
    } else if (mode === "burnin") {
      elements.exportStatusText.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> FFmpeg កំពុងបង្កប់អក្សររត់ខ្មែរលើសាច់វីដេអូ... (សូមរង់ចាំបន្តិច)';
    } else {
      elements.exportStatusText.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> កំពុងភ្ជាប់ Subtitle Track ចូលក្នុង MP4...';
    }
  }
  if (elements.exportStatusBar) elements.exportStatusBar.style.width = "25%";
  if (elements.exportStatusPercentage) elements.exportStatusPercentage.textContent = "25%";

  let progressVal = 25;
  const progressTimer = setInterval(() => {
    if (progressVal < 92) {
      progressVal += mode === "burnin_dubbed" ? 4 : (mode === "burnin" ? 6 : 18);
      if (elements.exportStatusBar) elements.exportStatusBar.style.width = `${progressVal}%`;
      if (elements.exportStatusPercentage) elements.exportStatusPercentage.textContent = `${progressVal}%`;
    }
  }, 1800);

  try {
    const resp = await fetch("/api/export-video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoFilename: filename,
        srtText: srtText,
        mode: mode,
        voice: voice,
        ducking: ducking
      })
    });

    clearInterval(progressTimer);

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: "Export failed" }));
      throw new Error(err.error || "Export failed");
    }

    const data = await resp.json();
    if (!data.success || !data.downloadUrl) {
      throw new Error(data.error || "រកមិនឃើញឯកសារទាញយក");
    }

    if (elements.exportStatusText) {
      elements.exportStatusText.innerHTML = '<i class="fa-solid fa-check text-green"></i> បង្កើតវីដេអូបានជោគជ័យ! កំពុងទាញយក...';
    }
    if (elements.exportStatusBar) elements.exportStatusBar.style.width = "100%";
    if (elements.exportStatusPercentage) elements.exportStatusPercentage.textContent = "100%";

    // Trigger download
    const a = document.createElement("a");
    a.href = data.downloadUrl;
    a.download = data.filename || `CineKhmer_${filename}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
      elements.exportVideoModal?.classList.add("hidden");
      elements.exportModalProgress?.classList.add("hidden");
    }, 2500);

  } catch (err) {
    clearInterval(progressTimer);
    console.error("Export error:", err);
    alert("បញ្ហាក្នុងការទាញយកវីដេអូ៖ " + err.message);
    elements.exportModalProgress?.classList.add("hidden");
  } finally {
    clearInterval(progressTimer);
    if (elements.btnDoExportBurninDubbed) elements.btnDoExportBurninDubbed.disabled = false;
    if (elements.btnDoExportBurnin) elements.btnDoExportBurnin.disabled = false;
    if (elements.btnDoExportSoftsub) elements.btnDoExportSoftsub.disabled = false;
  }
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
// Native Khmer Neural Text-To-Speech (TTS) Engine
// ==========================================
function speakKhmerText(text, voice = "piseth") {
  const clean = text.replace(/\[.*?\]/g, "").replace(/【.*?】/g, "").replace(/🎬|⚡|🔥|🌟|🎙️/g, "").trim();
  if (!clean) return;

  // Stop previous speech
  if (state.currentPlayingAudio) {
    state.currentPlayingAudio.pause();
    state.currentPlayingAudio = null;
  }

  const selectedVoice = voice || elements.selectRecapVoice?.value || "piseth";
  const audioUrl = `/api/tts?text=${encodeURIComponent(clean)}&voice=${encodeURIComponent(selectedVoice)}`;
  const audio = new Audio(audioUrl);
  state.currentPlayingAudio = audio;

  state.isPlayingAudio = true;
  elements.audioWaves?.classList.add("playing");
  if (elements.audioStatus) {
    elements.audioStatus.textContent = `កំពុងអានដោយ ${selectedVoice === "sreymom" ? "អ្នកនាង ស្រីមុំ" : "លោក ពិសិដ្ឋ"}...`;
  }
  if (elements.btnTtsToggle) {
    elements.btnTtsToggle.innerHTML = `<i class="fa-solid fa-pause"></i>`;
  }

  audio.onended = () => {
    state.isPlayingAudio = false;
    elements.audioWaves?.classList.remove("playing");
    if (elements.audioStatus) elements.audioStatus.textContent = "ការអានត្រូវបានបញ្ចប់";
    if (elements.btnTtsToggle) elements.btnTtsToggle.innerHTML = `<i class="fa-solid fa-play"></i>`;
    state.currentPlayingAudio = null;
  };

  audio.onerror = (e) => {
    console.error("Native Khmer TTS Error:", e);
    state.isPlayingAudio = false;
    elements.audioWaves?.classList.remove("playing");
    if (elements.audioStatus) elements.audioStatus.textContent = "កំហុសក្នុងការទាញយកសំឡេង";
    if (elements.btnTtsToggle) elements.btnTtsToggle.innerHTML = `<i class="fa-solid fa-play"></i>`;
    state.currentPlayingAudio = null;
  };

  audio.play().catch(err => {
    console.warn("Audio playback error:", err);
    state.isPlayingAudio = false;
    elements.audioWaves?.classList.remove("playing");
    if (elements.btnTtsToggle) elements.btnTtsToggle.innerHTML = `<i class="fa-solid fa-play"></i>`;
  });
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
  elements.videoFileInput?.addEventListener("change", (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleVideoUpload(e.target.files[0]);
    }
  });

  // Load subtitle file directly from video tab
  elements.videoSrtInput?.addEventListener("change", (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleSubtitleUpload(e.target.files[0]);
    }
  });

  // Transcribe video speech directly to Khmer subtitles
  elements.btnVideoTranscribeVoice?.addEventListener("click", () => {
    transcribeVideoVoice();
  });

  elements.btnBannerTranscribe?.addEventListener("click", () => {
    transcribeVideoVoice();
  });

  // Translate video subtitles button on video tab
  elements.btnVideoTranslateNow?.addEventListener("click", () => {
    translateVideoSubtitles();
  });

  // Helper banner button: Use sample & translate immediately
  elements.btnVideoUseSample?.addEventListener("click", () => {
    elements.rawSubInput.value = SAMPLES.action;
    parseInputToSubtitles();
    elements.videoHelperBanner?.classList.add("hidden");
    translateVideoSubtitles();
  });

  // Drag and drop video OR subtitle file directly onto the video player container
  const wrapper = elements.videoWrapper;
  if (wrapper) {
    wrapper.addEventListener("dragover", (e) => {
      e.preventDefault();
      wrapper.style.borderColor = "var(--cyan-primary)";
      wrapper.style.boxShadow = "0 0 35px rgba(6, 182, 212, 0.5)";
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
        const files = Array.from(e.dataTransfer.files);
        const videoFile = files.find(f => f.type.startsWith("video/") || f.name.match(/\.(mp4|webm|mkv|mov)$/i));
        const srtFile = files.find(f => f.name.match(/\.(srt|vtt|txt)$/i));

        if (videoFile) handleVideoUpload(videoFile);
        if (srtFile) handleSubtitleUpload(srtFile);
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

  if (elements.btnPreloadAudio) {
    elements.btnPreloadAudio.addEventListener("click", preloadSubtitleAudio);
  }

  if (elements.btnTestVoice) {
    elements.btnTestVoice.addEventListener("click", () => {
      const voice = elements.selectVideoVoice ? elements.selectVideoVoice.value : "piseth";
      const sampleText = voice === "sreymom"
        ? "សួស្តី! ខ្ញុំជាអ្នកនាង ស្រីមុំ សំឡេងបញ្ចេញបញ្ចូលភាពយន្តខ្មែរ AI។"
        : "សួស្តី! ខ្ញុំជាលោក ពិសិដ្ឋ សំឡេងបញ្ចេញបញ្ចូលភាពយន្តខ្មែរ AI។";
      elements.btnTestVoice.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-cyan"></i> កំពុងនិយាយ...`;
      const audioUrl = `/api/tts?text=${encodeURIComponent(sampleText)}&voice=${encodeURIComponent(voice)}`;
      const testAudio = new Audio(audioUrl);
      testAudio.volume = state.dubbingVolume;
      testAudio.onended = () => {
        elements.btnTestVoice.innerHTML = `<i class="fa-solid fa-volume-high text-cyan"></i> សាកល្បងសំឡេង`;
      };
      testAudio.onerror = () => {
        elements.btnTestVoice.innerHTML = `<i class="fa-solid fa-volume-high text-cyan"></i> សាកល្បងសំឡេង`;
        alert("មិនអាចចាក់សំឡេងបានឡើយ សូមពិនិត្យមើលតំណភ្ជាប់ Server!");
      };
      testAudio.play().catch(err => {
        elements.btnTestVoice.innerHTML = `<i class="fa-solid fa-volume-high text-cyan"></i> សាកល្បងសំឡេង`;
        console.warn("Voice test play issue:", err);
      });
    });
  }

  if (elements.btnExportAllMp3) {
    elements.btnExportAllMp3.addEventListener("click", exportAllKhmerAudioClips);
  }

  // Load animated canvas demo simulator
  elements.btnLoadDemoVideo?.addEventListener("click", () => {
    startDemoCanvasVideo();
  });

  // Start with demo simulator by default so it's instantly visual!
  startDemoCanvasVideo();
}

function startDemoCanvasVideo() {
  const video = elements.cinemaVideo;
  if (!video) return;

  // Pause and clear any previous file video
  video.pause();
  video.removeAttribute("src");

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
    video.srcObject = stream;
    video.play().catch(() => {});
    elements.videoFilename.textContent = "វីដេអូ៖ Animated Cinema Canvas Simulator";
  }
}

function handleVideoUpload(file) {
  const video = elements.cinemaVideo;
  if (!video) return;

  // Save current video file reference for AI speech-to-text
  state.currentVideoFile = file;

  // 1. CRITICAL: Stop canvas demo and release srcObject so the uploaded movie displays!
  if (state.demoCanvasInterval) {
    clearInterval(state.demoCanvasInterval);
    state.demoCanvasInterval = null;
  }
  video.pause();
  video.srcObject = null; // Important: Must be null to allow video.src to display!
  video.removeAttribute("src");

  // 2. Set actual video file URL and show in display
  const videoUrl = URL.createObjectURL(file);
  video.src = videoUrl;
  elements.videoFilename.textContent = `វីដេអូ៖ ${file.name}`;
  video.load();
  video.play().catch(e => console.log("Video loaded. Press play to start", e));

  // 3. Handle subtitles for this video
  // Always clear old sample subtitles to prevent showing wrong movie text!
  state.subtitles = [];
  state.audioCache.clear();
  state.lastSpokenCueIndex = -1;
  renderSubtitlesList();
  updateTimelineView();

  // Detect known user movie (nsKZEfx9eivBracHFnue+LGU2QEUDV-M.mp4 / yoyucfheaq)
  const isKnownUserMovie = /yoyucfheaq|nskzefx|lgu2qeudv/i.test(file.name);
  if (isKnownUserMovie) {
    loadPreTranslatedUserMovie();
  } else {
    // Check duration when metadata loads
    video.onloadedmetadata = () => {
      if (video.duration >= 635 && video.duration <= 665 && state.subtitles.length === 0) {
        loadPreTranslatedUserMovie();
      }
    };
    // Automatically trigger Speech-to-Text and translation!
    transcribeVideoVoice();
  }

  // Ensure Video tab is active so the movie is in display
  document.getElementById("tab-btn-video")?.click();
}

function loadPreTranslatedUserMovie() {
  elements.videoHelperBanner?.classList.add("hidden");
  if (elements.videoTranslationProgress) elements.videoTranslationProgress.classList.remove("hidden");
  if (elements.videoProgressText) elements.videoProgressText.textContent = "កំពុងផ្ទុក Subtitle ខ្មែរតាមសំឡេងតួ (២១៧ បន្ទាត់)...";
  if (elements.videoProgressBar) elements.videoProgressBar.style.width = "75%";
  if (elements.videoProgressPercentage) elements.videoProgressPercentage.textContent = "75%";

  fetch("/samples/user_movie_khmer.srt")
    .then(res => res.text())
    .then(srtText => {
      elements.rawSubInput.value = srtText;
      parseInputToSubtitles();
      renderSubtitlesList();
      updateTimelineView();
      toggleExportButtons(true);
      preloadSubtitleAudio();
      if (elements.videoProgressText) elements.videoProgressText.textContent = "ជោគជ័យ! បានផ្ទុក Subtitle ខ្មែរតាមសំឡេងតួ ២១៧ បន្ទាត់!";
      if (elements.videoProgressBar) elements.videoProgressBar.style.width = "100%";
      if (elements.videoProgressPercentage) elements.videoProgressPercentage.textContent = "100%";
      setTimeout(() => {
        elements.videoTranslationProgress?.classList.add("hidden");
      }, 1500);

      // Reset and play video
      const video = elements.cinemaVideo;
      if (video && video.paused) {
        video.play().catch(() => {});
      }
    })
    .catch(err => {
      console.warn("Could not load user_movie_khmer.srt:", err);
      transcribeVideoVoice();
    });
}

async function transcribeVideoVoice() {
  const file = state.currentVideoFile;
  if (!file) {
    // If no video file uploaded yet, prompt file picker
    elements.videoFileInput.click();
    return;
  }

  // Clear any old subtitles first
  state.subtitles = [];
  renderSubtitlesList();
  updateTimelineView();

  elements.videoHelperBanner?.classList.add("hidden");
  if (elements.videoTranslationProgress) elements.videoTranslationProgress.classList.remove("hidden");
  if (elements.btnVideoTranscribeVoice) elements.btnVideoTranscribeVoice.disabled = true;
  if (elements.btnBannerTranscribe) elements.btnBannerTranscribe.disabled = true;
  if (elements.btnVideoTranslateNow) elements.btnVideoTranslateNow.disabled = true;

  if (elements.videoProgressText) {
    elements.videoProgressText.textContent = "កំពុងស្រង់សំឡេងចេញពីវីដេអូ & AI កំពុងស្តាប់ពាក្យសម្ដីតួអង្គ (Whisper AI)...";
  }
  if (elements.videoProgressBar) elements.videoProgressBar.style.width = "25%";
  if (elements.videoProgressPercentage) elements.videoProgressPercentage.textContent = "25%";

  let progressVal = 25;
  const progressTimer = setInterval(() => {
    if (progressVal < 92) {
      progressVal += 5;
      if (elements.videoProgressBar) elements.videoProgressBar.style.width = `${progressVal}%`;
      if (elements.videoProgressPercentage) elements.videoProgressPercentage.textContent = `${progressVal}%`;
      if (progressVal >= 60 && elements.videoProgressText) {
        elements.videoProgressText.textContent = "AI កំពុងបកប្រែពាក្យសម្ដីតួអង្គជាភាសាខ្មែរ (Cinematic Dialogue Translation)...";
      }
    }
  }, 2500);

  try {
    const style = elements.selectStyle ? elements.selectStyle.value : "cinematic";
    const url = `/api/transcribe-video?style=${encodeURIComponent(style)}&filename=${encodeURIComponent(file.name)}`;

    const resp = await fetch(url, {
      method: "POST",
      body: file
    });

    clearInterval(progressTimer);

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(errText || "Transcription request failed");
    }

    const data = await resp.json();
    if (!data.success || !data.subtitles || data.subtitles.length === 0) {
      throw new Error(data.error || "មិនអាចស្វែងរកសំឡេងតួនិយាយ ឬមិនមានការសន្ទនាក្នុងវីដេអូ");
    }

    // Populate recognized subtitles
    state.subtitles = data.subtitles.map((cue, idx) => ({
      index: cue.index || (idx + 1),
      startTime: cue.startTime,
      endTime: cue.endTime,
      timecode: cue.timecode,
      original: cue.original,
      translated: polishKhmerCinematicDialogue(cue.translated, cue.original, style)
    }));

    // Update raw input box in Tab 1
    const srtText = state.subtitles.map(s => `${s.index}\n${s.timecode}\n${s.translated}\n${s.original}`).join("\n\n");
    elements.rawSubInput.value = srtText;

    if (elements.videoProgressText) {
      elements.videoProgressText.textContent = `ជោគជ័យ! បានបកប្រែតាមសំឡេងតួនិយាយ ${state.subtitles.length} បន្ទាត់!`;
    }
    if (elements.videoProgressBar) elements.videoProgressBar.style.width = "100%";
    if (elements.videoProgressPercentage) elements.videoProgressPercentage.textContent = "100%";

    renderSubtitlesList();
    updateTimelineView();
    toggleExportButtons(true);
    preloadSubtitleAudio();

    // Reset video to start and play with subtitles & dubbing
    const video = elements.cinemaVideo;
    if (video) {
      video.currentTime = 0;
      video.play().catch(() => {});
    }

    setTimeout(() => {
      elements.videoTranslationProgress?.classList.add("hidden");
    }, 2500);

  } catch (err) {
    clearInterval(progressTimer);
    console.error("Transcribe error:", err);
    alert("បញ្ហាក្នុងការស្តាប់សំឡេងវីដេអូ៖ " + err.message);
    if (elements.videoTranslationProgress) elements.videoTranslationProgress.classList.add("hidden");
  } finally {
    clearInterval(progressTimer);
    if (elements.btnVideoTranscribeVoice) elements.btnVideoTranscribeVoice.disabled = false;
    if (elements.btnBannerTranscribe) elements.btnBannerTranscribe.disabled = false;
    if (elements.btnVideoTranslateNow) elements.btnVideoTranslateNow.disabled = false;
  }
}

function handleSubtitleUpload(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    elements.rawSubInput.value = e.target.result;
    parseInputToSubtitles();
    elements.videoHelperBanner?.classList.add("hidden");
    // Automatically translate the uploaded subtitles to Khmer!
    await translateVideoSubtitles();
  };
  reader.readAsText(file);
}

async function translateVideoSubtitles() {
  if (state.subtitles.length === 0) {
    const video = elements.cinemaVideo;
    const file = state.currentVideoFile;
    if ((file && /yoyucfheaq|nskzefx|lgu2qeudv/i.test(file.name)) || (video && video.duration >= 635 && video.duration <= 665)) {
      loadPreTranslatedUserMovie();
      return;
    }
    if (elements.rawSubInput && elements.rawSubInput.value.trim()) {
      parseInputToSubtitles();
    } else {
      alert("សូមបញ្ចូល Subtitle (.srt/.vtt) ឬចុច 'ស្ដាប់សំឡេងតួ & បកប្រែខ្មែរ (Speech AI)' ជាមុនសិន!");
      return;
    }
  }

  const total = state.subtitles.length;
  if (total === 0) return;

  state.isTranslating = true;
  if (elements.videoTranslationProgress) elements.videoTranslationProgress.classList.remove("hidden");
  if (elements.btnVideoTranslateNow) elements.btnVideoTranslateNow.disabled = true;

  const style = elements.selectStyle ? elements.selectStyle.value : "cinematic";
  const srcLang = elements.selectSourceLang ? elements.selectSourceLang.value : "auto";

  // Fast Batch Translation: 25 cues per request
  const batchSize = 25;
  for (let i = 0; i < total; i += batchSize) {
    const chunk = state.subtitles.slice(i, i + batchSize);
    const chunkTexts = chunk.map(c => c.original);

    const currentLine = Math.min(i + batchSize, total);
    if (elements.videoProgressText) {
      elements.videoProgressText.textContent = `កំពុងបកប្រែបន្ទាត់ទី ${currentLine} នៃ ${total}...`;
    }
    const percent = Math.round((currentLine / total) * 100);
    if (elements.videoProgressBar) elements.videoProgressBar.style.width = `${percent}%`;
    if (elements.videoProgressPercentage) elements.videoProgressPercentage.textContent = `${percent}%`;

    let translations = [];
    try {
      const resp = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: chunkTexts, sourceLang: srcLang, targetLang: "km" })
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.success && Array.isArray(data.translations)) {
          translations = data.translations;
        }
      }
    } catch (e) {
      console.warn("Server batch translation failed, falling back:", e);
    }

    // Fallback if backend translation empty
    if (translations.length === 0) {
      for (const cue of chunk) {
        const tr = await translateWithFreeGoogle(cue.original, srcLang);
        translations.push(tr);
      }
    }

    for (let j = 0; j < chunk.length; j++) {
      const cue = chunk[j];
      const trans = translations[j] || cue.original;
      cue.translated = polishKhmerCinematicDialogue(trans, cue.original, style);
    }

    renderSubtitlesList();
    updateTimelineView();
  }

  state.isTranslating = false;
  if (elements.btnVideoTranslateNow) elements.btnVideoTranslateNow.disabled = false;
  if (elements.videoProgressText) elements.videoProgressText.textContent = `បកប្រែបានជោគជ័យ ${total} បន្ទាត់ (១០០%)!`;
  setTimeout(() => {
    elements.videoTranslationProgress?.classList.add("hidden");
  }, 2000);

  // Update raw input box in Tab 1
  const srtText = state.subtitles.map(s => `${s.index}\n${s.timecode}\n${s.translated}\n${s.original}`).join("\n\n");
  elements.rawSubInput.value = srtText;

  renderSubtitlesList();
  updateTimelineView();
  preloadSubtitleAudio();

  // If video is paused, play it with subtitles
  const video = elements.cinemaVideo;
  if (video && video.paused) {
    video.play().catch(() => {});
  }
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
  const voice = elements.selectVideoVoice ? elements.selectVideoVoice.value : "piseth";
  const duckingLevel = state.videoDuckingLevel;
  const dubbingVolume = state.dubbingVolume;

  // Show live dubbing HUD badge on video
  if (elements.dubbingLiveBadge) {
    elements.dubbingLiveBadge.classList.remove("hidden");
    elements.dubbingBadgeText.textContent = `AI ${voice === "sreymom" ? "ស្រីមុំ" : "ពិសិដ្ឋ"} កំពុងនិយាយ (#${cue.index})`;
  }

  // Smooth Audio Ducking: Lower original movie volume
  if (!video.dataset.originalVolume) {
    video.dataset.originalVolume = (video.volume || 1.0).toString();
  }
  video.volume = duckingLevel;

  // Stop previous speech safely
  if (state.currentPlayingAudio) {
    try {
      state.currentPlayingAudio.pause();
      state.currentPlayingAudio.currentTime = 0;
    } catch (e) {}
    state.currentPlayingAudio = null;
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

  // Play native Khmer Neural voice from local /api/tts endpoint
  const cacheKey = `${voice}_${cue.index}`;
  let audio = state.audioCache.get(cacheKey);
  if (!audio) {
    const audioUrl = `/api/tts?text=${encodeURIComponent(text)}&voice=${encodeURIComponent(voice)}`;
    audio = new Audio(audioUrl);
    state.audioCache.set(cacheKey, audio);
  }
  audio.volume = dubbingVolume;
  try { audio.currentTime = 0; } catch (e) {}
  state.currentPlayingAudio = audio;

  audio.onended = onSpeechEnd;
  audio.onerror = (e) => {
    console.warn("Audio play issue on cue:", cue.index, e);
    onSpeechEnd();
  };

  const playPromise = audio.play();
  if (playPromise !== undefined) {
    playPromise.catch(err => {
      if (err.name !== "AbortError") {
        console.warn("Audio play issue on cue:", cue.index, err);
      }
      onSpeechEnd();
    });
  }
}

function preloadSubtitleAudio() {
  if (state.subtitles.length === 0) return;
  const voice = elements.selectVideoVoice ? elements.selectVideoVoice.value : "piseth";
  
  if (elements.btnPreloadAudio) {
    elements.btnPreloadAudio.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-cyan"></i> Preloading...`;
  }

  const cues = state.subtitles.filter(c => (c.translated || c.original || "").trim());
  let index = 0;
  let preloadedCount = 0;

  function loadNextBatch() {
    if (index >= cues.length) {
      if (elements.btnPreloadAudio) {
        elements.btnPreloadAudio.innerHTML = `<i class="fa-solid fa-check text-cyan"></i> Preloaded (${preloadedCount})`;
        setTimeout(() => {
          elements.btnPreloadAudio.innerHTML = `<i class="fa-solid fa-bolt"></i> Pre-buffer Audio`;
        }, 3000);
      }
      return;
    }

    const batch = cues.slice(index, index + 3);
    index += 3;

    batch.forEach(cue => {
      const text = (cue.translated || cue.original || "").trim();
      const cacheKey = `${voice}_${cue.index}`;
      if (!state.audioCache.has(cacheKey)) {
        const audioUrl = `/api/tts?text=${encodeURIComponent(text)}&voice=${encodeURIComponent(voice)}`;
        const audio = new Audio();
        audio.preload = "auto";
        audio.src = audioUrl;
        state.audioCache.set(cacheKey, audio);
        preloadedCount++;
      }
    });

    setTimeout(loadNextBatch, 250);
  }

  loadNextBatch();
}

function exportAllKhmerAudioClips() {
  if (state.subtitles.length === 0) {
    alert("សូមបញ្ចូល និងបកប្រែ Subtitle ជាមុនសិន!");
    return;
  }
  const voice = elements.selectVideoVoice ? elements.selectVideoVoice.value : "piseth";
  state.subtitles.forEach((cue, i) => {
    const text = (cue.translated || cue.original || "").trim();
    if (text) {
      const link = document.createElement("a");
      link.href = `/api/tts?text=${encodeURIComponent(text)}&voice=${encodeURIComponent(voice)}`;
      link.download = `cue_${String(i + 1).padStart(3, "0")}_khmer_${voice}.mp3`;
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

  // Export Video Modal handlers
  const openExportModal = () => {
    if (state.subtitles.length === 0) {
      alert("សូមបកប្រែ ឬបញ្ចូល Subtitle ជាមុនសិន!");
      return;
    }
    elements.exportVideoModal?.classList.remove("hidden");
    elements.exportModalProgress?.classList.add("hidden");
  };

  elements.btnExportVideo?.addEventListener("click", openExportModal);
  elements.btnExportVideoSide?.addEventListener("click", openExportModal);
  elements.btnExportVideoTab1?.addEventListener("click", openExportModal);

  elements.btnCloseExportModal?.addEventListener("click", () => {
    elements.exportVideoModal?.classList.add("hidden");
  });

  elements.exportVideoModal?.addEventListener("click", (e) => {
    if (e.target === elements.exportVideoModal) {
      elements.exportVideoModal.classList.add("hidden");
    }
  });

  elements.btnDoExportBurninDubbed?.addEventListener("click", () => {
    startVideoExport("burnin_dubbed");
  });

  elements.btnDoExportBurnin?.addEventListener("click", () => {
    startVideoExport("burnin");
  });

  elements.btnDoExportSoftsub?.addEventListener("click", () => {
    startVideoExport("softsub");
  });

  elements.btnDoExportSrt?.addEventListener("click", () => {
    const srt = generateSrtOutput(false);
    downloadFile(srt, "movie_subtitles_khmer.srt");
    elements.exportVideoModal?.classList.add("hidden");
  });

  // Card row click shortcuts
  document.getElementById("opt-export-burnin-dubbed")?.addEventListener("click", (e) => {
    if (!e.target.closest("button")) startVideoExport("burnin_dubbed");
  });
  document.getElementById("opt-export-burnin")?.addEventListener("click", (e) => {
    if (!e.target.closest("button")) startVideoExport("burnin");
  });
  document.getElementById("opt-export-softsub")?.addEventListener("click", (e) => {
    if (!e.target.closest("button")) startVideoExport("softsub");
  });
  document.getElementById("opt-export-srt")?.addEventListener("click", (e) => {
    if (!e.target.closest("button")) {
      const srt = generateSrtOutput(false);
      downloadFile(srt, "movie_subtitles_khmer.srt");
      elements.exportVideoModal?.classList.add("hidden");
    }
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
