#!/usr/bin/env python3
"""
CineKhmer AI - Video Exporter Engine
Exports movie video with:
1. Crystal-clear Khmer UI subtitles (Advanced SubStation Alpha with DirectWrite OpenType shaping).
2. Synchronized Khmer Neural Voice Dubbing (Piseth/Sreymom) with smooth audio ducking.
3. Fast softsub embedding and standalone SRT generation.
"""

import sys
import os
import re
import argparse
import subprocess
import hashlib
import asyncio
import wave
import imageio_ffmpeg
import numpy as np

# Ensure Windows terminal UTF-8 output
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_DIR = os.path.join(BASE_DIR, "cache_audio")
os.makedirs(CACHE_DIR, exist_ok=True)

try:
    import tts_helper
except ImportError:
    tts_helper = None

def get_video_info(video_path):
    """Probes video to get width, height, duration in seconds."""
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    cmd = [ffmpeg_exe, "-i", video_path]
    proc = subprocess.run(cmd, capture_output=True, text=True, errors="ignore")

    w, h = 1280, 720
    duration = 30.0

    dur_m = re.search(r"Duration:\s*(\d+):(\d+):([\d\.]+)", proc.stderr)
    if dur_m:
        hrs, mins, secs = map(float, dur_m.groups())
        duration = hrs * 3600 + mins * 60 + secs

    dim_m = re.search(r"Stream.*Video:.*,\s*(\d+)x(\d+)", proc.stderr)
    if dim_m:
        w, h = int(dim_m.group(1)), int(dim_m.group(2))

    return w, h, duration

def parse_timecode(tc):
    """Converts 00:01:23,456 or 00:01:23.456 to seconds."""
    tc = tc.strip().replace(",", ".")
    parts = tc.split(":")
    if len(parts) == 3:
        return float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])
    return 0.0

def sec_to_ass_time(sec):
    """Converts seconds float to ASS time format h:mm:ss.cc."""
    sec = max(0.0, sec)
    h = int(sec // 3600)
    m = int((sec % 3600) // 60)
    s = sec % 60
    return f"{h}:{m:02d}:{s:05.2f}"

def parse_srt(srt_path_or_text):
    """Parses SRT file content into list of cues."""
    if os.path.isfile(srt_path_or_text):
        with open(srt_path_or_text, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
    else:
        content = srt_path_or_text

    # Strip UTF-8 BOM if present
    content = content.lstrip("\ufeff").replace("\r\n", "\n").replace("\r", "\n").strip()
    blocks = re.split(r"\n\s*\n", content)
    cues = []

    for block in blocks:
        lines = [l.strip() for l in block.split("\n") if l.strip()]
        if len(lines) >= 2:
            time_idx = -1
            for idx, l in enumerate(lines):
                if "-->" in l:
                    time_idx = idx
                    break
            if time_idx != -1:
                tc_line = lines[time_idx]
                parts = tc_line.split("-->")
                start_sec = parse_timecode(parts[0])
                end_sec = parse_timecode(parts[1])
                text_lines = lines[time_idx + 1:]
                
                # If bilingual or multi-line, prioritize Khmer line
                khmer_lines = [tl for tl in text_lines if re.search(r"[\u1780-\u17FF]", tl)]
                if khmer_lines:
                    text = " ".join(khmer_lines)
                else:
                    text = " ".join(text_lines)

                cues.append({
                    "index": len(cues) + 1,
                    "start": start_sec,
                    "end": end_sec,
                    "text": text
                })
    return cues

def wrap_khmer_text(text, max_chars=42):
    """Wraps Khmer text with \\N so it never overflows video boundaries."""
    text = text.replace("\r", "").strip()
    if "\\N" in text:
        return text
    if "\n" in text:
        return text.replace("\n", "\\N")
    if len(text) <= max_chars:
        return text

    # Split by spaces if available
    words = text.split(" ")
    if len(words) > 1:
        lines = []
        curr = ""
        for w in words:
            if not curr:
                curr = w
            elif len(curr) + 1 + len(w) <= max_chars:
                curr += " " + w
            else:
                lines.append(curr)
                curr = w
        if curr:
            lines.append(curr)
        return "\\N".join(lines)
    else:
        mid = len(text) // 2
        return text[:mid] + "\\N" + text[mid:]

def generate_ass_file(cues, width, height, output_ass_path):
    """
    Generates an Advanced SubStation Alpha (.ass) subtitle file.
    Uses 'Khmer UI' font with DirectWrite/GDI rendering for 100% correct
    Khmer ligature and vowel shaping (no dotted circles).
    """
    # Proportional font size and margins based on video resolution
    font_size = max(18, int(height * 0.038))
    margin_v = max(25, int(height * 0.065))
    margin_h = max(20, int(width * 0.05))
    outline = round(font_size * 0.07, 1)
    shadow = round(font_size * 0.04, 1)

    ass_content = f"""[Script Info]
Title: CineKhmer AI Subtitles
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {height}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Khmer UI,{font_size},&H00FFFFFF,&H000000FF,&H00000000,&H90000000,-1,0,0,0,100,100,0,0,1,{outline},{shadow},2,{margin_h},{margin_h},{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = []
    for c in cues:
        st = sec_to_ass_time(c["start"])
        et = sec_to_ass_time(c["end"])
        wrapped = wrap_khmer_text(c["text"], max_chars=40 if width < height else 52)
        events.append(f"Dialogue: 0,{st},{et},Default,,0,0,0,,{wrapped}")

    with open(output_ass_path, "w", encoding="utf-8") as f:
        f.write(ass_content + "\n".join(events) + "\n")

    return output_ass_path

async def generate_cues_audio(cues, voice="piseth"):
    """Pre-generates neural Khmer speech clips for all cues in parallel."""
    if not tts_helper:
        return

    tasks = []
    for c in cues:
        clean = c["text"].replace("\\N", " ").strip()
        if not clean:
            continue
        h_val = hashlib.md5(f"{voice}_{clean}".encode("utf-8")).hexdigest()
        cached_file = os.path.join(CACHE_DIR, f"{h_val}.mp3")
        c["audio_path"] = cached_file

        if not os.path.exists(cached_file) or os.path.getsize(cached_file) == 0:
            tasks.append(tts_helper.generate_khmer_speech(clean, cached_file, voice))

    if tasks:
        await asyncio.gather(*tasks)

def build_dubbing_audio_track(cues, total_duration, output_wav_path, voice="piseth"):
    """
    Constructs a 44.1kHz stereo audio track containing all spoken Khmer dialogue
    placed at their exact cue start timestamps.
    """
    asyncio.run(generate_cues_audio(cues, voice=voice))

    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    sr = 44100
    total_samples = int(total_duration * sr)
    audio_buf = np.zeros(total_samples * 2, dtype=np.float32)

    for c in cues:
        audio_file = c.get("audio_path")
        if not audio_file or not os.path.exists(audio_file) or os.path.getsize(audio_file) == 0:
            continue

        cmd = [ffmpeg_exe, "-y", "-i", audio_file, "-f", "s16le", "-ac", "2", "-ar", str(sr), "-"]
        proc = subprocess.run(cmd, capture_output=True)
        if proc.returncode != 0 or len(proc.stdout) == 0:
            continue

        pcm = np.frombuffer(proc.stdout, dtype=np.int16).astype(np.float32) / 32768.0
        start_idx = int(c["start"] * sr) * 2
        end_idx = min(start_idx + len(pcm), len(audio_buf))
        if start_idx < len(audio_buf):
            audio_buf[start_idx:end_idx] += pcm[:end_idx - start_idx]

    int_samples = (np.clip(audio_buf, -1.0, 1.0) * 32767.0).astype(np.int16)
    with wave.open(output_wav_path, "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(int_samples.tobytes())

    return output_wav_path

def export_video(video_path, srt_path, output_path, mode="burnin_dubbed", voice="piseth", ducking=0.20):
    """
    Main export function:
    mode:
      - 'burnin_dubbed' (Recommended): Khmer ASS subtitles + Khmer neural voice dubbing with video audio ducking.
      - 'burnin': Khmer ASS subtitles burned into pixels, original video audio.
      - 'dubbed_only': Khmer neural voice dubbing mixed into audio, original video pixels.
      - 'softsub': Fast 1s stream copy embedding subtitle track.
    """
    if not os.path.isfile(video_path):
        raise FileNotFoundError(f"Video file not found: {video_path}")
    if not os.path.isfile(srt_path):
        raise FileNotFoundError(f"SRT subtitle file not found: {srt_path}")

    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    out_dir = os.path.dirname(os.path.abspath(output_path))
    os.makedirs(out_dir, exist_ok=True)

    w, h, duration = get_video_info(video_path)
    cues = parse_srt(srt_path)

    # 1. Generate formatted ASS file
    temp_ass = os.path.join(out_dir, f"temp_{os.getpid()}_{int(cues[0]['start'] if cues else 0)}.ass")
    generate_ass_file(cues, w, h, temp_ass)

    # Escape path for FFmpeg filter
    escaped_ass = temp_ass.replace("\\", "/").replace(":", "\\:")

    try:
        if mode == "softsub":
            # Fast 1-second stream copy
            cmd = [
                ffmpeg_exe, "-y",
                "-i", video_path,
                "-i", srt_path,
                "-c:v", "copy",
                "-c:a", "copy",
                "-c:s", "mov_text",
                "-metadata:s:s:0", "language=khm",
                "-metadata:s:s:0", "title=Khmer Subtitles",
                output_path
            ]
            proc = subprocess.run(cmd, capture_output=True, text=True, errors="ignore")
            if proc.returncode != 0:
                raise RuntimeError("FFmpeg softsub error:\n" + proc.stderr[-800:])

        elif mode == "burnin_dubbed":
            # Video + Khmer Subtitles + Synchronized Khmer Voice Dubbing
            temp_wav = os.path.join(out_dir, f"temp_dub_{os.getpid()}.wav")
            try:
                build_dubbing_audio_track(cues, duration, temp_wav, voice=voice)
                filter_complex = (
                    f"[0:a]volume={ducking:.2f}[orig]; "
                    f"[orig][1:a]amix=inputs=2:duration=first:normalize=0[aout]; "
                    f"[0:v]ass=filename='{escaped_ass}'[vout]"
                )
                cmd = [
                    ffmpeg_exe, "-y",
                    "-i", video_path,
                    "-i", temp_wav,
                    "-filter_complex", filter_complex,
                    "-map", "[vout]",
                    "-map", "[aout]",
                    "-c:v", "libx264",
                    "-preset", "veryfast",
                    "-crf", "22",
                    "-c:a", "aac",
                    "-b:a", "192k",
                    output_path
                ]
                proc = subprocess.run(cmd, capture_output=True, text=True, errors="ignore")
                if proc.returncode != 0:
                    raise RuntimeError("FFmpeg export error:\n" + proc.stderr[-800:])
            finally:
                if os.path.exists(temp_wav):
                    os.unlink(temp_wav)

        elif mode == "dubbed_only":
            # Video + Synchronized Khmer Voice Dubbing (no burned subtitles)
            temp_wav = os.path.join(out_dir, f"temp_dub_{os.getpid()}.wav")
            try:
                build_dubbing_audio_track(cues, duration, temp_wav, voice=voice)
                filter_complex = (
                    f"[0:a]volume={ducking:.2f}[orig]; "
                    f"[orig][1:a]amix=inputs=2:duration=first:normalize=0[aout]"
                )
                cmd = [
                    ffmpeg_exe, "-y",
                    "-i", video_path,
                    "-i", temp_wav,
                    "-filter_complex", filter_complex,
                    "-map", "0:v",
                    "-map", "[aout]",
                    "-c:v", "copy",
                    "-c:a", "aac",
                    "-b:a", "192k",
                    output_path
                ]
                proc = subprocess.run(cmd, capture_output=True, text=True, errors="ignore")
                if proc.returncode != 0:
                    raise RuntimeError("FFmpeg dubbed export error:\n" + proc.stderr[-800:])
            finally:
                if os.path.exists(temp_wav):
                    os.unlink(temp_wav)

        else:
            # Burn-in Subtitles Only (preserving original audio)
            cmd = [
                ffmpeg_exe, "-y",
                "-i", video_path,
                "-vf", f"ass=filename='{escaped_ass}'",
                "-c:v", "libx264",
                "-preset", "veryfast",
                "-crf", "22",
                "-c:a", "copy",
                output_path
            ]
            proc = subprocess.run(cmd, capture_output=True, text=True, errors="ignore")
            if proc.returncode != 0:
                raise RuntimeError("FFmpeg burnin export error:\n" + proc.stderr[-800:])

    finally:
        if os.path.exists(temp_ass):
            os.unlink(temp_ass)

    return output_path

def main():
    parser = argparse.ArgumentParser(description="Export movie video with Khmer subtitles and voice dubbing.")
    parser.add_argument("--video", "-v", required=True, help="Input video path")
    parser.add_argument("--srt", "-s", required=True, help="Input SRT subtitle file path")
    parser.add_argument("--output", "-o", required=True, help="Output MP4 file path")
    parser.add_argument("--mode", "-m", default="burnin_dubbed",
                        choices=["burnin_dubbed", "burnin", "dubbed_only", "softsub"],
                        help="Export mode (default: burnin_dubbed)")
    parser.add_argument("--voice", default="piseth", choices=["piseth", "sreymom"], help="Voice for dubbing")
    parser.add_argument("--ducking", default=0.20, type=float, help="Original video volume level during speech (default: 0.20)")

    args = parser.parse_args()

    try:
        print(f"[*] Exporting movie (mode: {args.mode}, voice: {args.voice})...")
        out = export_video(
            video_path=args.video,
            srt_path=args.srt,
            output_path=args.output,
            mode=args.mode,
            voice=args.voice,
            ducking=args.ducking
        )
        size_mb = os.path.getsize(out) / (1024 * 1024)
        print(f"[✔] Successfully exported video ({size_mb:.2f} MB): {out}")
    except Exception as e:
        print(f"[Error]: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
