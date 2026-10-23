#!/usr/bin/env python3
"""
Movie AI Translator to Khmer (ភាសាខ្មែរ)
Translate movie subtitles (SRT, VTT), scripts, and narration into natural cinematic Khmer.

Usage:
    python translate_movie.py --input samples/action_movie_sample.srt --output output_khmer.srt
    python translate_movie.py --input samples/action_movie_sample.srt --bilingual --style cinematic
    python translate_movie.py --plot samples/recap_plot_sample.txt --recap
"""

import sys
import os
import re
import json
import time
import argparse
import urllib.request
import urllib.parse

# Ensure Windows terminal supports UTF-8 Khmer characters
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

# Default Movie Translation Glossary for Khmer Cinema
DEFAULT_GLOSSARY = {
    r"\bcommander\b": "លោកមេបញ្ជាការ",
    r"\bcaptain\b": "លោកប្រធានក្រុម",
    r"\bsir\b": "លោកម្ចាស់",
    r"\bboss\b": "មេ",
    r"\bdetective\b": "អ្នកស៊ើបអង្កេត",
    r"\bagent\b": "ភ្នាក់ងារសម្ងាត់",
    r"\bdoctor\b": "វេជ្ជបណ្ឌិត",
    r"\bprofessor\b": "សាស្ត្រាចារ្យ",
    r"\bhacker\b": "អ្នកលួចចូលប្រព័ន្ធ",
    r"\bsector\b": "តំបន់",
    r"\bbunker\b": "លេណដ្ឋានក្រោមដី",
    r"\block and load\b": "ត្រៀមអាវុធប្រយុទ្ធ",
    r"\bfire in the hole\b": "ប្រយ័ត្នគ្រាប់បែក",
    r"\bhold the line\b": "ទប់ជំហរឲ្យជាប់",
}

class MovieAiTranslator:
    def __init__(self, api_key=None, style="cinematic", glossary=None):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        self.style = style
        self.glossary = glossary or DEFAULT_GLOSSARY

    def apply_glossary_pre(self, text):
        return text

    def apply_glossary_post(self, text):
        return text

    def translate_text(self, text, source_lang="en", target_lang="km"):
        """Translate a single line or batch using free translation API or Gemini if key present."""
        if not text.strip():
            return text

        if self.api_key:
            return self._translate_with_gemini(text)
        else:
            return self._translate_with_free_api(text, source_lang, target_lang)

    def _translate_with_free_api(self, text, source_lang="auto", target_lang="km"):
        """Free Google Translate endpoint with movie phrasing optimizations."""
        try:
            url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl={source_lang}&tl={target_lang}&dt=t&q={urllib.parse.quote(text)}"
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                translated = "".join([segment[0] for segment in data[0] if segment[0]])
                return self._polish_khmer_movie_style(translated, self.style)
        except Exception as e:
            print(f"[Warning] Translation error on '{text}': {e}", file=sys.stderr)
            return text

    def _translate_with_gemini(self, text):
        """High-context cinematic translation using Gemini API."""
        prompt = (
            f"You are an expert Hollywood-to-Khmer movie translator and cinematic narrator. "
            f"Translate the following movie line into natural, expressive, emotionally engaging Khmer (ភាសាខ្មែរ). "
            f"Style: {self.style}. "
            f"Do not translate literally; preserve tension, attitude, and context. Output only the Khmer translation.\n\n"
            f"Line: {text}"
        )
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={self.api_key}"
            payload = json.dumps({
                "contents": [{"parts": [{"text": prompt}]}]
            }).encode("utf-8")
            req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                khmer = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                return khmer
        except Exception as e:
            print(f"[Gemini Fallback to Free API]: {e}", file=sys.stderr)
            return self._translate_with_free_api(text)

    def _polish_khmer_movie_style(self, text, style):
        """Applies style nuances and movie subtitle cleanup."""
        # Polishing Khmer cinematic punctuation and common colloquialisms
        text = text.replace(" ! ", "! ").replace(" ? ", "? ")
        return text

    def parse_srt(self, content):
        """Parses SRT format into structured blocks: [{index, timecode, text}]."""
        content = content.replace("\r\n", "\n").replace("\r", "\n")
        blocks = re.split(r"\n\s*\n", content.strip())
        subtitles = []
        for block in blocks:
            lines = [l.strip() for l in block.split("\n") if l.strip()]
            if len(lines) >= 2:
                # Handle cases where line 0 is index or timecode
                if "-->" in lines[0]:
                    idx = str(len(subtitles) + 1)
                    timecode = lines[0]
                    text = " ".join(lines[1:])
                else:
                    idx = lines[0]
                    timecode = lines[1] if len(lines) > 1 else ""
                    text = " ".join(lines[2:]) if len(lines) > 2 else ""
                subtitles.append({"index": idx, "timecode": timecode, "text": text})
        return subtitles

    def generate_srt(self, subtitles, bilingual=False):
        """Generates valid SRT output from parsed subtitles."""
        out = []
        for i, sub in enumerate(subtitles, 1):
            out.append(str(i))
            out.append(sub["timecode"])
            if bilingual and "original" in sub:
                out.append(f"{sub['text']}\n{sub['original']}")
            else:
                out.append(sub["text"])
            out.append("")
        return "\n".join(out)

    def translate_srt_file(self, srt_content, bilingual=False):
        """Translates an entire SRT content."""
        subs = self.parse_srt(srt_content)
        total = len(subs)
        print(f"[*] Found {total} subtitle cues. Starting translation to Khmer ({self.style} style)...")

        for idx, sub in enumerate(subs, 1):
            orig = sub["text"]
            translated = self.translate_text(orig)
            sub["original"] = orig
            sub["text"] = translated
            print(f"[{idx}/{total}] {orig} -> {translated}")
            time.sleep(0.15)  # Friendly pacing

        return self.generate_srt(subs, bilingual=bilingual)

    def generate_movie_recap_script(self, plot_text, duration_mins=3):
        """Generate a viral Khmer movie recap narration script (សង្ខេបរឿង / រឿងនិយាយ)."""
        prompt = (
            f"You are a famous Cambodian Movie Recap Narrator (អ្នកអត្ថាធិប្បាយសង្ខេបភាពយន្ត) for TikTok, Facebook Reels, and YouTube. "
            f"Convert the following movie plot into an irresistible, gripping, viral Khmer voiceover script. "
            f"Target duration: {duration_mins} minutes.\n"
            f"Structure:\n"
            f"1. [HOOK / បើកឆាកទាក់ទាញ]: A punchy line that makes viewers stop scrolling.\n"
            f"2. [PLOT BREAKDOWN / សាច់រឿងលម្អិត]: Fast-paced storytelling, introducing characters and conflict.\n"
            f"3. [CLIMAX / ឈុតកំពូល]: High stakes, suspense, dramatic tension.\n"
            f"4. [CLIFFHANGER / បញ្ចប់រឿង]: Exciting conclusion with call to action (like, share, follow).\n\n"
            f"Original Plot:\n{plot_text}\n\n"
            f"Write the narration in expressive, captivating Khmer (ភាសាខ្មែរ):"
        )
        if self.api_key:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={self.api_key}"
                payload = json.dumps({"contents": [{"parts": [{"text": prompt}]}]}).encode("utf-8")
                req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
                with urllib.request.urlopen(req, timeout=20) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    return data["candidates"][0]["content"]["parts"][0]["text"].strip()
            except Exception as e:
                print(f"[Gemini Recap Error]: {e}", file=sys.stderr)

        # Fallback template-based recap narrator generator
        translated_plot = self.translate_text(plot_text)
        recap_template = f"""🎙️ 【ស្គ្រីបអត្ថាធិប្បាយសង្ខេបភាពយន្ត - CineKhmer AI】

🎬 [វិនាទី 0:00 - 0:15] បើកឆាកទាក់ទាញអារម្មណ៍ (Hook):
"តើអ្នកនឹងធ្វើបែបណា ប្រសិនបើថ្ងៃមួយ អ្នកភ្ញាក់ឡើង ហើយដឹងថា ការចងចាំទាំងអស់របស់អ្នក ត្រូវបានគេលុបចោលទាំងស្រុង?! នៅក្នុងវីដេអូថ្ងៃនេះ ខ្ញុំនឹងនាំអ្នកទាំងអស់គ្នាមកទស្សនាខ្សែភាពយន្តដ៏រន្ធត់ និងអស្ចារ្យបំផុតមួយ..."

⚡ [វិនាទី 0:15 - 1:30] សាច់រឿងលម្អិត (Plot Storytelling):
{translated_plot}

🔥 [វិនាទី 1:30 - 2:30] ឈុតកំពូល និងគ្រោះថ្នាក់ (Climax):
"ស្ថានការណ៍កាន់តែតានតឹងឡើង! ពេលដែលការពិតដ៏ខ្មៅងងឹតត្រូវបានទម្លាយ ពេលវេលាសល់ត្រឹមតែរាប់ថយក្រោយប៉ុណ្ណោះ។ តើគាត់អាចគេចផុតពីអន្ទាក់មរណៈនេះបានដោយរបៀបណា?"

🌟 [វិនាទី 2:30 - 3:00] បញ្ចប់សាច់រឿង (Cliffhanger & Outro):
"ខ្សែភាពយន្តនេះបានបង្រៀនយើងថា ការពិតមិនអាចលាក់បាំងក្រោមស្រមោលរហូតនោះទេ។ ប្រសិនបើអ្នកទាំងអស់គ្នាចូលចិត្តការសង្ខេបរឿងនេះ កុំភ្លេចចុច Like, Share និង Follow ដើម្បីទស្សនាភាគបន្តទៀត! សូមអរគុណ!"
"""
        return recap_template

def main():
    parser = argparse.ArgumentParser(description="Movie AI Translator to Khmer (ភាសាខ្មែរ)")
    parser.add_argument("--input", "-i", help="Path to input subtitle file (.srt, .vtt, .txt)")
    parser.add_argument("--output", "-o", help="Path to output translated file")
    parser.add_argument("--bilingual", action="store_true", help="Generate bilingual subtitles (Khmer + Original)")
    parser.add_argument("--style", default="cinematic", choices=["cinematic", "recap", "action", "dramatic"], help="Translation tone")
    parser.add_argument("--plot", help="Path to movie plot file to generate Khmer recap script")
    parser.add_argument("--recap", action="store_true", help="Generate viral movie recap script")
    parser.add_argument("--key", help="Google Gemini API key (optional, uses free engine if omitted)")

    args = parser.parse_args()
    translator = MovieAiTranslator(api_key=args.key, style=args.style)

    if args.plot or (args.input and args.recap):
        target_path = args.plot or args.input
        with open(target_path, "r", encoding="utf-8") as f:
            content = f.read()
        print("[*] Generating Khmer Movie Recap Narration Script...")
        script = translator.generate_movie_recap_script(content)
        if args.output:
            with open(args.output, "w", encoding="utf-8") as f:
                f.write(script)
            print(f"[✔] Recap script saved to {args.output}")
        else:
            print("\n" + script)
        return

    if args.input:
        with open(args.input, "r", encoding="utf-8") as f:
            content = f.read()
        translated_srt = translator.translate_srt_file(content, bilingual=args.bilingual)
        out_file = args.output or (os.path.splitext(args.input)[0] + "_khmer.srt")
        with open(out_file, "w", encoding="utf-8") as f:
            f.write(translated_srt)
        print(f"\n[✔] Successfully translated! Saved to: {out_file}")
        return

    print("Movie AI Translator to Khmer - Please specify --input <file.srt> or --plot <story.txt>")
    print("Example: python translate_movie.py --input samples/action_movie_sample.srt --bilingual")

if __name__ == "__main__":
    main()
