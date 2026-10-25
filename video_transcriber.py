#!/usr/bin/env python3
"""
CineKhmer AI - Video Speech Transcriber & Movie Dialogue Translator
Listens to character voices in any video or audio file, transcribes speech,
and translates into authentic Khmer cinematic dialogue.
"""

import sys
import os
import re
import json
import argparse
import subprocess
import numpy as np

# Ensure Windows console supports UTF-8
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

import imageio_ffmpeg
from faster_whisper import WhisperModel
from translate_movie import MovieAiTranslator

def format_timestamp(seconds: float) -> str:
    """Converts seconds into SRT timecode format HH:MM:SS,mmm"""
    ms = int(round((seconds - int(seconds)) * 1000))
    total_seconds = int(seconds)
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    secs = total_seconds % 60
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{ms:03d}"

def extract_audio_pcm(video_file_path: str) -> np.ndarray:
    """Extracts 16kHz mono audio from any video/audio file using bundled ffmpeg."""
    if not os.path.isfile(video_file_path):
        raise FileNotFoundError(f"Video file not found: {video_file_path}")

    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    cmd = [
        ffmpeg_exe,
        "-y",
        "-i", video_file_path,
        "-vn",
        "-ac", "1",
        "-ar", "16000",
        "-f", "s16le",
        "-"
    ]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    stdout, stderr = proc.communicate()
    if proc.returncode != 0:
        err_msg = stderr.decode("utf-8", errors="ignore")
        raise RuntimeError(f"FFmpeg audio extraction failed: {err_msg}")

    audio = np.frombuffer(stdout, dtype=np.int16).astype(np.float32) / 32768.0
    return audio

def split_segment_sentences(segment):
    """Splits a multi-sentence segment into precise sentence-level dialogue lines using word timestamps."""
    words = getattr(segment, "words", None)
    if not words or len(words) <= 1:
        text = segment.text.strip()
        if text:
            return [(segment.start, segment.end, text)]
        return []

    lines = []
    current_words = []

    for w in words:
        current_words.append(w)
        word_str = w.word.strip()
        if re.search(r"[\.!\?]+$", word_str) and len(current_words) >= 2:
            s_start = current_words[0].start
            s_end = current_words[-1].end
            s_text = " ".join([item.word.strip() for item in current_words]).strip()
            if s_text:
                lines.append((s_start, s_end, s_text))
            current_words = []

    if current_words:
        s_start = current_words[0].start
        s_end = current_words[-1].end
        s_text = " ".join([item.word.strip() for item in current_words]).strip()
        if s_text:
            lines.append((s_start, s_end, s_text))

    return lines if lines else [(segment.start, segment.end, segment.text.strip())]

def transcribe_and_translate_video(video_path: str, style="cinematic", model_size="base", language=None):
    """
    1. Extracts audio track from video.
    2. Transcribes spoken dialogues with timestamps using faster-whisper (high-sensitivity VAD).
    3. Translates spoken dialogues to authentic Khmer movie character dialogue without dropping lines.
    """
    import os

    audio = extract_audio_pcm(video_path)
    duration_sec = len(audio) / 16000.0

    # Load faster-whisper model with optimized CPU threads
    threads = min(os.cpu_count() or 4, 8)
    model = WhisperModel(model_size, device="cpu", compute_type="int8", cpu_threads=threads)
    transcribe_args = {
        "beam_size": 3,
        "best_of": 3,
        "vad_filter": True,
        "vad_parameters": dict(min_silence_duration_ms=450, speech_pad_ms=250),
        "condition_on_previous_text": False,
        "word_timestamps": True,
        "no_speech_threshold": 0.65,
        "compression_ratio_threshold": 2.4,
        "temperature": [0.0, 0.2]
    }
    if language and language.lower() != "auto":
        transcribe_args["language"] = language

    segments, info = model.transcribe(audio, **transcribe_args)
    detected_lang = getattr(info, "language", language or "auto")

    translator = MovieAiTranslator(style=style)

    raw_cues = []
    for seg in segments:
        text = seg.text.strip()
        if not text:
            continue

        # Filter out pure music note symbols (e.g. ♪♪♪, [Music])
        if re.match(r'^[♪\s\[\]\(\)\.\,\-\_]+$', text) or text.lower() in ["[music]", "(music)", "music"]:
            continue

        # Filter out obvious non-speech noise
        if getattr(seg, "no_speech_prob", 0) > 0.85:
            continue

        words = getattr(seg, "words", None)
        if words and len(words) > 0:
            cur_words = []
            for i, w in enumerate(words):
                cur_words.append(w)
                w_txt = w.word.strip()
                gap = False
                if i < len(words) - 1:
                    gap = (words[i+1].start - w.end) >= 0.70
                dur_so_far = w.end - cur_words[0].start
                is_punct = any(w_txt.endswith(p) for p in ('.', '!', '?', '。', '！', '？'))
                is_comma = any(w_txt.endswith(p) for p in (',', '，')) and dur_so_far >= 2.0
                if is_punct or is_comma or gap or dur_so_far >= 4.5:
                    s = round(cur_words[0].start, 2)
                    e = round(max(cur_words[-1].end + 0.25, s + 1.2), 2)
                    t = " ".join([item.word.strip() for item in cur_words if item.word.strip()]).strip()
                    if re.search(r'[\u4e00-\u9fff\u3040-\u30ff]', t):
                        t = re.sub(r'(?<=[\u4e00-\u9fff\u3040-\u30ff])\s+(?=[\u4e00-\u9fff\u3040-\u30ff])', '', t)
                    if t:
                        timecode = f"{format_timestamp(s)} --> {format_timestamp(e)}"
                        raw_cues.append({
                            "startTime": s,
                            "endTime": e,
                            "timecode": timecode,
                            "original": t
                        })
                    cur_words = []
            if cur_words:
                s = round(cur_words[0].start, 2)
                e = round(max(cur_words[-1].end + 0.25, s + 1.2), 2)
                t = " ".join([item.word.strip() for item in cur_words if item.word.strip()]).strip()
                if re.search(r'[\u4e00-\u9fff\u3040-\u30ff]', t):
                    t = re.sub(r'(?<=[\u4e00-\u9fff\u3040-\u30ff])\s+(?=[\u4e00-\u9fff\u3040-\u30ff])', '', t)
                if t:
                    timecode = f"{format_timestamp(s)} --> {format_timestamp(e)}"
                    raw_cues.append({
                        "startTime": s,
                        "endTime": e,
                        "timecode": timecode,
                        "original": t
                    })
        else:
            s = round(seg.start, 2)
            e = round(max(seg.end, s + 1.2), 2)
            timecode = f"{format_timestamp(s)} --> {format_timestamp(e)}"
            raw_cues.append({
                "startTime": s,
                "endTime": e,
                "timecode": timecode,
                "original": text
            })

    # High-speed batch translation to authentic cinematic Khmer
    # Always use source_lang="auto" unless explicit language was provided
    sl = language if (language and language.lower() != "auto") else "auto"
    orig_texts = [cue["original"] for cue in raw_cues]
    khmer_translations = translator.translate_batch(orig_texts, source_lang=sl, target_lang="km")

    subtitles = []
    for idx, (cue, khmer) in enumerate(zip(raw_cues, khmer_translations), 1):
        subtitles.append({
            "index": idx,
            "startTime": cue["startTime"],
            "endTime": cue["endTime"],
            "timecode": cue["timecode"],
            "original": cue["original"],
            "translated": khmer
        })

    return {
        "success": True,
        "duration": round(duration_sec, 2),
        "language": detected_lang,
        "subtitles": subtitles
    }

def build_srt_content(subtitles, bilingual=False):
    blocks = []
    for s in subtitles:
        idx = s["index"]
        tc = s["timecode"]
        if bilingual:
            text = f"{s['translated']}\n{s['original']}"
        else:
            text = s["translated"]
        blocks.append(f"{idx}\n{tc}\n{text}")
    return "\n\n".join(blocks) + "\n"

def main():
    parser = argparse.ArgumentParser(description="Transcribe video character speech and translate to cinematic Khmer.")
    parser.add_argument("--input", "-i", required=True, help="Input video or audio file path")
    parser.add_argument("--output", "-o", help="Output SRT subtitle file path")
    parser.add_argument("--style", default="cinematic", choices=["cinematic", "action", "horror", "drama", "royal"])
    parser.add_argument("--bilingual", action="store_true", help="Output both Khmer and Original English in subtitles")
    parser.add_argument("--json", action="store_true", help="Print structured JSON result to stdout")
    parser.add_argument("--model", default="base", help="Whisper model (tiny, base, small)")
    parser.add_argument("--lang", default=None, help="Spoken language in video (en, zh, th, ja, etc. default: auto)")

    args = parser.parse_args()

    try:
        result = transcribe_and_translate_video(
            video_path=args.input,
            style=args.style,
            model_size=args.model,
            language=args.lang
        )

        if args.json:
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return

        print(f"\n[✔] Successfully transcribed video audio! ({len(result['subtitles'])} spoken dialogues detected)")
        for sub in result["subtitles"]:
            print(f"[{sub['timecode']}]")
            print(f"   Original: {sub['original']}")
            print(f"   Khmer:    {sub['translated']}\n")

        if args.output:
            srt_content = build_srt_content(result["subtitles"], bilingual=args.bilingual)
            with open(args.output, "w", encoding="utf-8") as f:
                f.write(srt_content)
            print(f"[✔] Subtitles saved to: {args.output}")

    except Exception as e:
        print(f"[Error]: {e}", file=sys.stderr)
        if args.json:
            print(json.dumps({"success": False, "error": str(e)}, ensure_ascii=False))
        sys.exit(1)

if __name__ == "__main__":
    main()
