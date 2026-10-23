#!/usr/bin/env python3
"""
CineKhmer AI - Video Exporter
Exports video with burned-in Khmer subtitles, soft-subtitles, or dubbed audio tracks.
"""

import sys
import os
import argparse
import subprocess
import imageio_ffmpeg

# Ensure Windows terminal UTF-8 output
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

def export_video_with_subtitles(video_path, srt_path, output_path, mode="burnin", font_size=20):
    """
    Exports video with subtitles.
    mode="burnin": Hardcodes Khmer subtitles onto the video pixels (Permanent).
    mode="softsub": Embeds subtitle stream into MP4 (Instant copy, no re-encoding).
    """
    if not os.path.isfile(video_path):
        raise FileNotFoundError(f"Video file not found: {video_path}")
    if not os.path.isfile(srt_path):
        raise FileNotFoundError(f"SRT subtitle file not found: {srt_path}")

    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

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
            output_path
        ]
    else:
        # Burn-in subtitles (Hardcoded)
        # Handle Windows paths for FFmpeg filter
        abs_srt = os.path.abspath(srt_path).replace("\\", "/")
        # On Windows, escape colon after drive letter: C:/ -> C\\:/
        if len(abs_srt) >= 2 and abs_srt[1] == ":":
            drive = abs_srt[0]
            rest = abs_srt[2:]
            escaped_srt = f"{drive}\\:{rest}"
        else:
            escaped_srt = abs_srt

        # Styling: Gold/White text with black outline and soft shadow for high contrast
        style_opts = (
            f"FontSize={font_size},"
            f"PrimaryColour=&H00FFFFFF,"
            f"OutlineColour=&H00000000,"
            f"BackColour=&H80000000,"
            f"BorderStyle=3,"
            f"Outline=2,"
            f"Shadow=1,"
            f"MarginV=25"
        )
        sub_filter = f"subtitles='{escaped_srt}':force_style='{style_opts}'"

        cmd = [
            ffmpeg_exe, "-y",
            "-i", video_path,
            "-vf", sub_filter,
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-crf", "22",
            "-c:a", "copy",
            output_path
        ]

    proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="ignore")
    if proc.returncode != 0:
        raise RuntimeError("FFmpeg export error:\n" + proc.stderr[-800:])

    return output_path

def main():
    parser = argparse.ArgumentParser(description="Export movie video with Khmer subtitles.")
    parser.add_argument("--video", "-v", required=True, help="Input video path")
    parser.add_argument("--srt", "-s", required=True, help="Input SRT subtitle file path")
    parser.add_argument("--output", "-o", required=True, help="Output MP4 file path")
    parser.add_argument("--mode", "-m", default="burnin", choices=["burnin", "softsub"], help="Export mode (burnin or softsub)")
    parser.add_argument("--fontsize", default=20, type=int, help="Subtitle font size (default: 20)")

    args = parser.parse_args()

    try:
        print(f"[*] Exporting video with Khmer subtitles (mode: {args.mode})...")
        out = export_video_with_subtitles(
            video_path=args.video,
            srt_path=args.srt,
            output_path=args.output,
            mode=args.mode,
            font_size=args.fontsize
        )
        size_mb = os.path.getsize(out) / (1024 * 1024)
        print(f"[✔] Successfully exported video ({size_mb:.2f} MB): {out}")
    except Exception as e:
        print(f"[Error]: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
