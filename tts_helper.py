#!/usr/bin/env python3
"""
Native Khmer Neural Text-To-Speech (TTS) Engine
Powered by Microsoft Azure Edge Neural Voices for Cambodia (km-KH):
- km-KH-PisethNeural (Male Narrator - លោក ពិសិដ្ឋ)
- km-KH-SreymomNeural (Female Narrator - អ្នកនាង ស្រីមុំ)
"""

import sys
import os
import asyncio
import edge_tts

VOICE_MAP = {
    "piseth": "km-KH-PisethNeural",
    "sreymom": "km-KH-SreymomNeural",
    "km-KH-PisethNeural": "km-KH-PisethNeural",
    "km-KH-SreymomNeural": "km-KH-SreymomNeural"
}

async def generate_khmer_speech(text, output_file, voice_key="piseth"):
    voice = VOICE_MAP.get(voice_key.lower(), "km-KH-PisethNeural")
    os.makedirs(os.path.dirname(os.path.abspath(output_file)), exist_ok=True)
    
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(output_file)

def main():
    if len(sys.argv) < 3:
        print("Usage: python tts_helper.py <text> <output_file> [voice]")
        sys.exit(1)

    text = sys.argv[1].strip()
    output_file = sys.argv[2].strip()
    voice = sys.argv[3].strip() if len(sys.argv) > 3 else "piseth"

    if not text:
        sys.exit(0)

    try:
        asyncio.run(generate_khmer_speech(text, output_file, voice))
        print("SUCCESS")
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
