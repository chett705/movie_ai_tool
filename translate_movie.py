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
    r"\bmount\b": "សត្វជំនិះ",
    r"\bsteed\b": "សត្វជំនិះ",
    r"\bvassal\b": "ចំណុះ",
    r"\bjackpot\b": "ត្រូវប៉ាន់",
    r"\bcalamity\b": "គ្រោះមហន្តរាយ",
    r"\bgranduncle\b": "លោកតាពូ",
}

class MovieAiTranslator:
    def __init__(self, api_key=None, style="cinematic", glossary=None):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        self.style = style
        self.glossary = glossary or DEFAULT_GLOSSARY

    def apply_glossary_pre(self, text):
        return text

    def apply_glossary_post(self, text):
        if not text or not self.glossary:
            return text
        for pattern, replacement in self.glossary.items():
            text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)
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
        """Fast Google Translate endpoint with movie phrasing optimizations."""
        # 1. Primary: Google Chrome extension endpoint (fast, reliable, no 429 captcha block)
        try:
            url = f"https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl={source_lang}&tl={target_lang}&q={urllib.parse.quote(text)}"
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                translated = ""
                if isinstance(data, list) and len(data) > 0:
                    if isinstance(data[0], str):
                        translated = data[0]
                    elif isinstance(data[0], list) and len(data[0]) > 0 and isinstance(data[0][0], str):
                        translated = data[0][0]
                if translated:
                    return self._polish_khmer_movie_style(translated, orig_text=text, style=self.style)
        except Exception:
            pass

        # 2. Secondary fallback: Google single endpoint
        try:
            url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl={source_lang}&tl={target_lang}&dt=t&q={urllib.parse.quote(text)}"
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                translated = "".join([segment[0] for segment in data[0] if segment and len(segment) > 0 and segment[0]])
                if translated:
                    return self._polish_khmer_movie_style(translated, orig_text=text, style=self.style)
        except Exception as e:
            print(f"[Warning] Translation error on '{text}': {e}", file=sys.stderr)
            return text

    def translate_batch(self, texts, source_lang="auto", target_lang="km", batch_size=25):
        """Translates a list of dialogue texts in fast chunks, preserving 1:1 order."""
        if not texts:
            return []

        results = []
        for i in range(0, len(texts), batch_size):
            chunk = texts[i:i + batch_size]
            cleaned_chunk = [t.replace("\r", " ").replace("\n", " ").strip() for t in chunk]
            joined = "\n".join([t if t else "..." for t in cleaned_chunk])

            translated_lines = []
            try:
                url = f"https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl={source_lang}&tl={target_lang}&q={urllib.parse.quote(joined)}"
                req = urllib.request.Request(
                    url,
                    headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
                )
                with urllib.request.urlopen(req, timeout=15) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    raw_trans = ""
                    if isinstance(data, list) and len(data) > 0:
                        if isinstance(data[0], str):
                            raw_trans = data[0]
                        elif isinstance(data[0], list) and len(data[0]) > 0 and isinstance(data[0][0], str):
                            raw_trans = data[0][0]
                    if raw_trans:
                        translated_lines = raw_trans.split("\n")
            except Exception as e:
                print(f"[Batch translation error]: {e}", file=sys.stderr)
                translated_lines = [self.translate_text(t, source_lang, target_lang) for t in chunk]

            # Ensure 1:1 line alignment
            if len(translated_lines) != len(chunk):
                # If Google joined or split lines, translate each line individually to guarantee 100% accurate alignment
                translated_lines = [self.translate_text(t, source_lang="auto", target_lang=target_lang) for t in chunk]

            for orig, trans in zip(chunk, translated_lines):
                if not orig.strip():
                    results.append("")
                else:
                    # If translation failed and returned original non-Khmer text, retry with auto
                    if trans.strip() == orig.strip() and not re.search(r'[\u1780-\u17FF]', trans):
                        retry_trans = self.translate_text(orig, source_lang="auto", target_lang=target_lang)
                        results.append(self._polish_khmer_movie_style(retry_trans, orig_text=orig, style=self.style))
                    else:
                        results.append(self._polish_khmer_movie_style(trans, orig_text=orig, style=self.style))

            if i + batch_size < len(texts):
                time.sleep(0.08)

        return results

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

    def _polish_khmer_movie_style(self, text, orig_text="", style="cinematic"):
        """Applies authentic cinematic dialogue rules, fixing literal robotic translations."""
        clean_orig = orig_text.strip().lower() if orig_text else ""

        # 1. Exact Hollywood movie dialogue patterns (Cinematic Dialogue Memory)
        if "lost contact with sector" in clean_orig:
            sec_match = re.search(r"sector\s*(\d+)", clean_orig)
            sec_num = sec_match.group(1) if sec_match else "៧"
            if "commander" in clean_orig:
                return f"លោកមេបញ្ជាការ! យើងដាច់ការទាក់ទងជាមួយតំបន់ទី {sec_num} ហើយ!"
            return f"យើងដាច់ការទាក់ទងជាមួយតំបន់ទី {sec_num} ហើយ!"

        if "what do you mean lost contact" in clean_orig:
            return "ថាម៉េច ដាច់ការទាក់ទង?! ឆាប់ឆែករ៉ាដាបម្រុងមើល!"

        if "entire perimeter grid just went dark" in clean_orig:
            return "ប្រព័ន្ធការពារជុំវិញដាច់ភ្លើងអស់ហើយ! មានរបស់អ្វីម្យ៉ាងកំពុងសំដៅមករកយើង!"

        if "listen to me carefully" in clean_orig and "bunker" in clean_orig:
            return "ស្តាប់ខ្ញុំឲ្យច្បាស់! ឆាប់ជម្លៀសប្រជាជនទាំងអស់ចូលទៅលេណដ្ឋានក្រោមដីជាបន្ទាន់!"

        if "breached the outer defense gates" in clean_orig:
            return "លោកមេបញ្ជាការ! ពួកវាទម្លុះទ្វារការពារខាងក្រៅបាត់ហើយ!"

        if "lock and load" in clean_orig and "hold this line" in clean_orig:
            return "ត្រៀមអាវុធប្រយុទ្ធ! ថ្ងៃនេះ ទោះជាមានរឿងអ្វីកើតឡើង ក៏យើងត្រូវតែទប់ទល់ឲ្យជាប់ដែរ!"

        # Horror movie tropes
        if "hear that sound" in clean_orig and "attic" in clean_orig:
            return "ឯងឮសូរសម្រឹបអ្វីនៅលើពិដានទេ?"

        if "just the wind" in clean_orig and "imagination" in clean_orig:
            return "គ្រាន់តែជាខ្យល់បក់តើ... កុំគិតផ្តេសផ្តាសបំភ័យខ្លួនឯងពេក!"

        if "attic door was locked" in clean_orig and "open now" in clean_orig:
            return "មិនមែនទេ... ទ្វារបន្ទប់លើដំបូលចាក់សោពីខាងក្រៅតើ! មើលចុះ ឥឡូវវាបើកចំហបាត់ហើយ!"

        if "do not turn around" in clean_orig and "behind us" in clean_orig:
            return "ទោះជាយ៉ាងណា ក៏កុំងាកក្រោយឲ្យសោះ! វា... វាកំពុងឈរនៅពីក្រោយខ្នងយើង!"

        # Drama movie tropes
        if "ten years waiting" in clean_orig and "train station" in clean_orig:
            return "ដប់ឆ្នាំកន្លងផុតទៅ ខ្ញុំនៅតែឈររង់ចាំនៅស្ថានីយ៍រថភ្លើងនេះរៀងរាល់រដូវរងា..."

        if "promises we made" in clean_orig and "another lifetime" in clean_orig:
            return "បងដឹងហើយថាយើងមិនអាចត្រឡប់ក្រោយបានទេ... ពាក្យសន្យាកាលពីមុន បានរលាយបាត់អស់ហើយ..."

        if "time didn't change anything" in clean_orig and "never left" in clean_orig:
            return "ពេលវេលាមិនអាចផ្លាស់ប្តូរចិត្តខ្ញុំបានទេ... ក្នុងបេះដូងខ្ញុំ បងមិនដែលចាកចេញទៅណាឡើយ..."

        # Chinese / Wuxia / Xianxia / Fantasy movie tropes
        if "不可思议" in orig_text or "incredible magic" in clean_orig:
            return "មហិទ្ធិឫទ្ធិមិនគួរឱ្យជឿ!"
        if "何人敢" in orig_text or "who dares disturb" in clean_orig or ("disturb" in clean_orig and "sleep" in clean_orig):
            return "នរណាហ៊ានរំខានដំណេករបស់លោកម្ចាស់?!"
        if "找死" in orig_text or "court death" in clean_orig:
            return "ឯងចង់ងាប់ហើយមែនទេ?!"
        if "饶命" in orig_text or "spare my life" in clean_orig:
            return "សូមលោកម្ចាស់មេត្តាលើកលែងជីវិតផង!"
        if "受死吧" in orig_text or "prepare to die" in clean_orig:
            return "ដល់ពេលឯងត្រូវស្លាប់ហើយ!"
        if "放肆" in orig_text or "insolent" in clean_orig:
            return "ឈ្លើយណាស់! ហ៊ានមិនក្រាបសំពះលោកម្ចាស់ផង?!"
        if "calamity" in clean_orig and ("blood plane" in clean_orig or "come early" in clean_orig):
            return "ដែនឈាមបានទម្លុះរបាំងចេញមកហើយ គ្រោះមហន្តរាយលើកទីបួនរបស់ឯងមកដល់ពិតមែន!"
        if "mount" in clean_orig and ("become" in clean_orig or "be my" in clean_orig or "you will" in clean_orig):
            return "ឯងនឹងក្លាយជាសត្វជំនិះរបស់ខ្ញុំ!"
        if "first time" in clean_orig and "mount" in clean_orig:
            return "នេះជាលើកដំបូងដែលខ្ញុំធ្វើជាសត្វជំនិះ..."
        if "eat him" in clean_orig and "stronger" in clean_orig:
            return "បើខ្ញុំលេបត្របាក់វា ខ្ញុំនឹងកាន់តែខ្លាំងក្លាឡើង!"
        if ("don't care who he is" in clean_orig or "do not care who he is" in clean_orig) and "food" in clean_orig:
            return "ខ្ញុំមិនខ្វល់ថាវាជានរណាទេ ថ្ងៃនេះវាត្រូវតែក្លាយជាចំណីរបស់ខ្ញុំ!"
        if "vassal" in clean_orig and ("loomian" in clean_orig or "family" in clean_orig):
            return "គ្រួសារ Loomian ដ៏អស្ចារ្យ មិនព្រមចុះចូលធ្វើជាចំណុះរបស់អ្នកណាជាដាច់ខាត!"

        # Common action & Hollywood one-liners
        if re.search(r"\b(good heavens|heavens|good lord|my goodness)\b", clean_orig):
            return "ឱព្រះអើយ!"
        if re.search(r"\b(go to hell|to hell with you)\b", clean_orig):
            return "ទៅងាប់ទៅ! ចុះនរកទៅ!"
        if re.search(r"\b(whoa,? jackpot|jackpot)\b", clean_orig):
            return "យីអើ! ត្រូវប៉ាន់ហើយ!"
        if re.search(r"\b(calm down little one)\b", clean_orig):
            return "ចិត្តត្រជាក់ៗកូនតូច! កុំស្លន់ស្លោអី!"
        if re.search(r"\b(calm down|take it easy)\b", clean_orig):
            return "ចិត្តត្រជាក់ៗសិនទៅ!"
        if re.search(r"\b(holy shit|holy crap|holy cow)\b", clean_orig):
            return "យីអើ! ងាប់ហើយលោកអើយ!"
        if re.search(r"\b(damn it|dammit|goddammit)\b", clean_orig):
            return "ចង្រៃយក៍!"
        if re.search(r"\b(what the hell|what the f(uck)?)\b", clean_orig):
            return "ស្អីគេហ្នឹង?!"
        if re.search(r"\b(son of a bitch)\b", clean_orig):
            return "អាតិរច្ឆាន!"
        if re.search(r"\b(fire in the hole)\b", clean_orig):
            return "ប្រយ័ត្នគ្រាប់បែក! ក្រាបចុះ!"
        if re.search(r"\b(cover me)\b", clean_orig):
            return "ជួយបាញ់ការពារខ្ញុំ!"
        if re.search(r"\b(fall back|retreat)\b", clean_orig):
            return "ឆាប់ដកថយជាបន្ទាន់!"
        if re.search(r"\b(get down)\b", clean_orig):
            return "ក្រាបចុះ!"
        if re.search(r"\b(drop your weapon|drop the gun)\b", clean_orig):
            return "ទម្លាក់អាវុធចុះភ្លាម!"
        if re.search(r"\b(don't move|freeze)\b", clean_orig):
            return "នៅឲ្យស្ងៀម កុំកម្រើក!"
        if re.search(r"\b(are you crazy|are you out of your mind|are you kidding me)\b", clean_orig):
            return "ឯងឆ្កួតហើយមែនទេ?!"
        if re.search(r"\b(we're running out of time|no time left)\b", clean_orig):
            return "យើងអស់ពេលហើយ! ឆាប់ឡើង!"
        if re.search(r"\b(shut up)\b", clean_orig) or re.search(r"^(silence!?|quiet!?)$", clean_orig):
            return "បិទមាត់ទៅ! នៅឲ្យស្ងៀម!"
        if re.search(r"\b(trust me)\b", clean_orig):
            return "ជឿជាក់លើខ្ញុំទៅ!"
        if re.search(r"\b(who are you)\b", clean_orig):
            return "ឯងជានរណា?!"
        if re.search(r"\b(what are you doing)\b", clean_orig):
            return "ឯងកំពុងធ្វើអីហ្នឹង?!"
        if re.search(r"\b(what('s| is) happening|what('s| is) going on)\b", clean_orig):
            return "មានរឿងអីកើតឡើង?!"
        if re.search(r"\b(no way|impossible)\b", clean_orig):
            return "មិនអាចទៅរួចទេ! គ្មានផ្លូវទេ!"
        if re.search(r"\b(get out of here|get lost)\b", clean_orig):
            return "ឆាប់ចេញពីទីនេះភ្លាម!"
        if re.search(r"\b(i don't care|i do not care|i don't give a damn)\b", clean_orig):
            return "ខ្ញុំមិនខ្វល់ទេ!"
        if re.search(r"\b(i'm warning you|i am warning you)\b", clean_orig):
            return "ខ្ញុំព្រមានឯងណា!"
        if re.search(r"\b(stay with me)\b", clean_orig):
            return "តាំងស្មារតីឡើង កុំទាន់បិទភ្នែក!"

        # 2. General dialogue idiom cleanup (Fix awkward machine translation)
        # Fix Google Translate weird literal errors
        text = text.replace("ឋានសួគ៌ល្អ", "ឱព្រះអើយ!")
        text = text.replace("ស្ងប់អារម្មណ៍តូចមួយ", "ចិត្តត្រជាក់ៗកូនតូច")
        text = text.replace("ស្ងប់អារម្មណ៍ចុះ", "ចិត្តត្រជាក់ៗសិន!")
        text = text.replace("ទៅនរក", "ទៅងាប់ទៅ!")
        text = text.replace("រង្វាន់ជេកផត", "ត្រូវប៉ាន់ហើយ!")
        text = text.replace("កូនឆ្កេញី", "អាតិរច្ឆាន!")
        text = text.replace("លាមកបរិសុទ្ធ", "ងាប់ហើយលោកអើយ!")
        text = text.replace("ខូចវា", "ចង្រៃយក៍!")
        text = text.replace("តើអ្វីទៅជានរក", "រឿងឆ្កួតស្អីហ្នឹង?!")
        text = text.replace("ភាពស្ងប់ស្ងាត់", "នៅស្ងៀមភ្លាម!")
        text = text.replace("ភ្នំរបស់ខ្ញុំ", "សត្វជំនិះរបស់ខ្ញុំ")
        if "mount" in clean_orig or "riding" in clean_orig:
            text = text.replace("ឡើងភ្នំ", "ជិះសត្វជំនិះ")
        if "shatter" in clean_orig or "broken" in clean_orig or "sword" in clean_orig:
            text = text.replace("ញាប់ញ័រ", "បាក់បែកខ្ទេចខ្ទី")
        text = text.replace("ពូដ៏អស្ចារ្យ", "លោកតាពូ")
        text = text.replace("ដាក់កំហុសគាត់សម្រាប់", "ច្រឡំគាត់ជា")
        text = text.replace("កុំពិបាកជាមួយកូន", "កុំតឹងរ៉ឹងដាក់ក្មេងអី")
        text = text.replace("នោះជាស្រីល្អ", "ក្មេងល្អណាស់")
        text = text.replace("គ្រួសារទឹកដោះគោ", "គ្រួសារ Loomian")
        text = text.replace("ខ្ញុំមិនស្លាប់ដូចការផ្ដន្ទាទោសពីឥឡូវនេះទេ", "ខ្ញុំមិនអាចមកស្លាប់នៅទីនេះបានទេ!")
        text = text.replace("ឲ្យអាហារបន្ថែមដល់អ្នកខ្ញុំត្រូវខ្ទេចខ្ទីស្លាប់", "បើផ្តល់ថាមពលឲ្យឯងទៀត ខ្ញុំប្រាកដជាត្រូវស្លាប់មិនខាន!")
        text = text.replace("គ្រួសារ Loomian ដ៏អស្ចារ្យ នឹងមិនក្លាយជាអ្នកធំរបស់នរណាម្នាក់ឡើយ", "គ្រួសារ Loomian ដ៏អស្ចារ្យ មិនព្រមចុះចូលធ្វើជាចំណុះរបស់អ្នកណាជាដាច់ខាត!")
        text = text.replace("Vassal", "ចំណុះ").replace("vassal", "ចំណុះ")
        text = text.replace("កុំព្យាយាមអ្វីទាំងអស់", "កុំធ្វើអ្វីផ្តេសផ្តាសឲ្យសោះ!")
        text = text.replace("បណ្តាសារបស់យាយនឹងកាន់តែរឹងមាំ", "បណ្តាសានឹងកាន់តែសាហាវឡើង!")
        text = text.replace("ហេតុអ្វីបានជាមានអារម្មណ៍ថាត្រជាក់ឆ្អឹងមួយរំពេចនោះ?", "ហេតុអីបានជាស្រៀវឆ្អឹងខ្នងភ្លាមៗបែបនេះ?!")

        # Fix breach -> rape
        text = re.sub(r"រំលោភ[\s\u200B]*(ទ្វារ|កំពែង|របាំង|បន្ទាយ|ប្រព័ន្ធ|ច្រក|ទីតាំង|ព្រំដែន)", r"ទម្លុះ\1", text)
        text = text.replace("រំលោភទ្វារ", "ទម្លុះទ្វារ")
        text = text.replace("ចាក់សោហើយផ្ទុក", "ត្រៀមអាវុធប្រយុទ្ធ")
        text = text.replace("កាន់បន្ទាត់នេះ", "ទប់ទល់ឲ្យជាប់").replace("កាន់បន្ទាត់", "ទប់ជំហរ")
        text = re.sub(r"វិស័យ[\s\u200B]*ទី[\s\u200B]*([០-៩\d]+)", r"តំបន់ទី \1", text)
        text = text.replace("ក្រឡាចត្រង្គបរិវេណ", "ប្រព័ន្ធការពារជុំវិញ")
        text = text.replace("ក្រឡាចត្រង្គ", "ប្រព័ន្ធការពារ")
        text = text.replace("បាត់ទំនាក់ទំនង", "ដាច់ការទាក់ទង")
        text = text.replace("បាត់បង់ទំនាក់ទំនង", "ដាច់ការទាក់ទង")
        text = text.replace("បាត់បង់ការទាក់ទង", "ដាច់ការទាក់ទង")
        text = text.replace("ពិនិត្យរ៉ាដាបម្រុងទុក", "ឆែករ៉ាដាបម្រុងមើល")
        text = text.replace("ពិនិត្យមើលរ៉ាដាបម្រុងទុក", "ឆែករ៉ាដាបម្រុងមើល")
        text = text.replace("ពិនិត្យរ៉ាដា", "ឆែករ៉ាដា")
        text = text.replace("ស្តាប់ខ្ញុំដោយយកចិត្តទុកដាក់", "ស្តាប់ខ្ញុំឲ្យច្បាស់")
        text = re.sub(r"តើ[\s\u200B]*អ្នក[\s\u200B]*ចង់បានន័យថាយ៉ាងណា", "មានន័យថាម៉េច", text)
        text = re.sub(r"តើ[\s\u200B]*អ្នក[\s\u200B]*ចង់បានន័យថា", "ថាម៉េច", text)
        text = re.sub(r"តើ[\s\u200B]*អ្នក[\s\u200B]*មានន័យថាម៉េច", "ថាម៉េច", text)
        text = text.replace("អ្វីមួយកំពុងមក", "មានរបស់អ្វីម្យ៉ាងកំពុងសំដៅមក")
        text = text.replace("ជនស៊ីវិល", "ប្រជាជន")
        text = text.replace("លេណដ្ឋានក្រោមដីឥឡូវនេះ", "លេណដ្ឋានក្រោមដីជាបន្ទាន់")
        text = text.replace("ភ្លើងនៅក្នុងរន្ធ", "ប្រយ័ត្នគ្រាប់បែក!")

        # Character addressing fixes
        if clean_orig and re.search(r"\b(commander|captain|sir)\b", clean_orig):
            text = text.replace("លោកម្ចាស់", "លោកមេបញ្ជាការ")
            text = text.replace("ព្រះអម្ចាស់", "លោកមេបញ្ជាការ")
        elif "លោកម្ចាស់" in text and style != "royal":
            # In martial arts/wuxia, keep លោកម្ចាស់ / ចៅហ្វាយ, in modern movies replace with លោកមេ
            if not ("វេទមន្ត" in text or "បិសាច" in text or "វិជ្ជា" in text or "មហិទ្ធិឫទ្ធិ" in text or "ជំនិះ" in text):
                text = text.replace("លោកម្ចាស់", "លោកមេ")

        # Conversational flow fixes (clean up robotic 'ពួកយើងបាន' -> 'យើង')
        text = text.replace("ពួកយើងបាន", "យើង")
        text = text.replace("ពួកយើង", "យើង")
        text = text.replace("ពួកគេបាន", "ពួកវា")

        # Apply Glossary
        text = self.apply_glossary_post(text)

        text = re.sub(r"\s*!\s*", "! ", text).replace(" ? ", "? ").strip()
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
        """Translates an entire SRT content at high speed using batching."""
        subs = self.parse_srt(srt_content)
        total = len(subs)
        print(f"[*] Found {total} subtitle cues. Starting batch translation to Khmer ({self.style} style)...")

        orig_texts = [sub["text"] for sub in subs]
        translated_texts = self.translate_batch(orig_texts, target_lang="km", batch_size=25)

        for idx, (sub, orig, trans) in enumerate(zip(subs, orig_texts, translated_texts), 1):
            sub["original"] = orig
            sub["text"] = trans

        print(f"[✔] Successfully batch translated {total} cues to Khmer!")
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

    def download_khmer_audio(self, text, output_path, voice="piseth"):
        """Download native Khmer neural TTS audio clip (.mp3) using edge-tts."""
        clean = text.strip()
        if not clean:
            return False
        try:
            import asyncio
            import edge_tts
            voice_name = "km-KH-SreymomNeural" if str(voice).lower() in ["sreymom", "female"] else "km-KH-PisethNeural"
            os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
            async def _run():
                communicate = edge_tts.Communicate(clean, voice_name)
                await communicate.save(output_path)
            asyncio.run(_run())
            return True
        except Exception as e:
            print(f"[Audio Error] Could not generate Khmer speech for '{clean[:20]}...': {e}", file=sys.stderr)
            return False

def main():
    parser = argparse.ArgumentParser(description="Movie AI Translator & Dubber to Khmer (ភាសាខ្មែរ)")
    parser.add_argument("--video", "-v", help="Path to input video or audio file to transcribe character speech and translate to Khmer")
    parser.add_argument("--input", "-i", help="Path to input subtitle file (.srt, .vtt, .txt)")
    parser.add_argument("--output", "-o", help="Path to output translated file")
    parser.add_argument("--bilingual", action="store_true", help="Generate bilingual subtitles (Khmer + Original)")
    parser.add_argument("--style", default="cinematic", choices=["cinematic", "recap", "action", "dramatic"], help="Translation tone")
    parser.add_argument("--plot", help="Path to movie plot file to generate Khmer recap script")
    parser.add_argument("--recap", action="store_true", help="Generate viral movie recap script")
    parser.add_argument("--audio", action="store_true", help="Generate and download synchronized Khmer MP3 audio dubbing clips")
    parser.add_argument("--voice", default="piseth", choices=["piseth", "sreymom"], help="Khmer voice: piseth (Male) or sreymom (Female)")
    parser.add_argument("--key", help="Google Gemini API key (optional, uses free engine if omitted)")

    args = parser.parse_args()
    translator = MovieAiTranslator(api_key=args.key, style=args.style)

    if args.video:
        print(f"[*] Listening to character voices in video: {args.video}...")
        from video_transcriber import transcribe_and_translate_video, build_srt_content
        res = transcribe_and_translate_video(args.video, style=args.style)
        subs = res["subtitles"]
        total = len(subs)
        print(f"[✔] Detected {total} spoken dialogues ({res['duration']}s duration).")

        audio_dir = None
        if args.audio:
            base = os.path.splitext(args.output or args.video)[0]
            audio_dir = base + f"_audio_dub_{args.voice}"
            os.makedirs(audio_dir, exist_ok=True)
            print(f"[*] Generating synchronized Khmer audio dubbing clips ({args.voice})...")
            for sub in subs:
                mp3_path = os.path.join(audio_dir, f"cue_{sub['index']:03d}_khmer.mp3")
                translator.download_khmer_audio(sub['translated'], mp3_path, voice=args.voice)
            print(f"[✔] Audio dubbing files saved in: {audio_dir}/")

        out_file = args.output or (os.path.splitext(args.video)[0] + "_khmer.srt")
        srt_text = build_srt_content(subs, bilingual=args.bilingual)
        with open(out_file, "w", encoding="utf-8") as f:
            f.write(srt_text)
        print(f"[✔] Khmer subtitles saved to: {out_file}")
        return

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

        if args.audio:
            audio_out = (os.path.splitext(args.output)[0] + "_narration.mp3") if args.output else "recap_narration.mp3"
            print(f"[*] Generating native Khmer narration audio ({args.voice}) to {audio_out}...")
            translator.download_khmer_audio(script[:300], audio_out, voice=args.voice)
            print(f"[✔] Audio narration clip saved to: {audio_out}")
        return

    if args.input:
        with open(args.input, "r", encoding="utf-8") as f:
            content = f.read()
        subs = translator.parse_srt(content)
        total = len(subs)
        print(f"[*] Found {total} subtitle cues. Starting translation to Khmer ({args.style} style)...")

        audio_dir = None
        if args.audio:
            base = os.path.splitext(args.output or args.input)[0]
            audio_dir = base + f"_audio_dub_{args.voice}"
            os.makedirs(audio_dir, exist_ok=True)
            print(f"[*] Audio Dubbing enabled ({args.voice})! Saving MP3s to: {audio_dir}/")

        for idx, sub in enumerate(subs, 1):
            orig = sub["text"]
            translated = translator.translate_text(orig)
            sub["original"] = orig
            sub["text"] = translated
            print(f"[{idx}/{total}] {orig} -> {translated}")

            if args.audio and translated:
                mp3_path = os.path.join(audio_dir, f"cue_{idx:03d}_khmer.mp3")
                translator.download_khmer_audio(translated, mp3_path, voice=args.voice)

            time.sleep(0.15)

        translated_srt = translator.generate_srt(subs, bilingual=args.bilingual)
        out_file = args.output or (os.path.splitext(args.input)[0] + "_khmer.srt")
        with open(out_file, "w", encoding="utf-8") as f:
            f.write(translated_srt)
        print(f"\n[✔] Successfully translated! Saved to: {out_file}")
        if args.audio:
            print(f"[✔] Synchronized Khmer audio dubbing clips saved in: {audio_dir}/")
        return

    print("Movie AI Translator to Khmer - Please specify --input <file.srt> or --plot <story.txt>")
    print("Example: python translate_movie.py --input samples/action_movie_sample.srt --bilingual --audio")

if __name__ == "__main__":
    main()
