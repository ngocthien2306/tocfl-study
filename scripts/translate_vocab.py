#!/usr/bin/env python3
"""
translate_vocab.py — Batch translate missing Vietnamese meanings in vocabulary.json
using OpenAI gpt-4o-mini (fast + cheap).

Usage:
    python3 scripts/translate_vocab.py --key YOUR_OPENAI_KEY
    python3 scripts/translate_vocab.py --key YOUR_OPENAI_KEY --batch 30
    python3 scripts/translate_vocab.py --key YOUR_OPENAI_KEY --level C1
    python3 scripts/translate_vocab.py --key YOUR_OPENAI_KEY --dry-run

Features:
  - Resume-able: saves progress to scripts/.translate_cache.json after every batch
  - Only translates words missing a Vietnamese meaning
  - Adds `example` field: a short Traditional Chinese example sentence
  - Filter by --level (A1/A2/A3/A4/B1/B2/C1) or --band (A/B/C)
  - Cost estimate before running
  - Dry-run mode to preview without calling API

Cost estimate (gpt-4o-mini):
  ~3060 missing words ÷ 30 per batch = ~102 calls
  ~$0.03–0.05 total
"""

import json, os, sys, time, argparse, re
from pathlib import Path

# ── Config ────────────────────────────────────────────────────────────────────
VOCAB_PATH  = Path(__file__).parent.parent / "public" / "data" / "vocabulary.json"
CACHE_PATH  = Path(__file__).parent / ".translate_cache.json"
MODEL       = "gpt-4o-mini"
MAX_RETRIES = 3

# ── Arg parsing ───────────────────────────────────────────────────────────────
def parse_args():
    p = argparse.ArgumentParser(description="Translate missing vocab to Vietnamese")
    p.add_argument("--key",      required=True, help="OpenAI API key")
    p.add_argument("--batch",    type=int, default=30, help="Words per API call (default 30)")
    p.add_argument("--level",    default=None, help="Filter by level: A1 A2 A3 A4 B1 B2 C1")
    p.add_argument("--band",     default=None, help="Filter by band: A B C")
    p.add_argument("--dry-run",  action="store_true", help="Preview only, no API calls")
    p.add_argument("--no-example", action="store_true", help="Skip generating example sentences")
    p.add_argument("--reset-cache", action="store_true", help="Clear cache and restart")
    return p.parse_args()

# ── Load / save ───────────────────────────────────────────────────────────────
def load_vocab():
    with open(VOCAB_PATH, encoding="utf-8") as f:
        return json.load(f)

def save_vocab(words):
    with open(VOCAB_PATH, "w", encoding="utf-8") as f:
        json.dump(words, f, ensure_ascii=False, indent=2)
    print(f"✓ Saved {len(words)} words to {VOCAB_PATH}")

def load_cache():
    if CACHE_PATH.exists():
        with open(CACHE_PATH, encoding="utf-8") as f:
            return json.load(f)
    return {}

def save_cache(cache):
    CACHE_PATH.parent.mkdir(exist_ok=True)
    with open(CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)

# ── OpenAI call ───────────────────────────────────────────────────────────────
def translate_batch(client, words_batch: list[dict], include_example: bool) -> dict:
    """
    Send a batch of words to OpenAI and return {hanzi: {meaning, example}} dict.
    """
    word_list = "\n".join(
        f'{i+1}. {w["hanzi"]} ({w["pinyin"]}) [{w["pos"]}] — level {w["level"]}'
        for i, w in enumerate(words_batch)
    )

    example_instruction = (
        "- example: one short Traditional Chinese (繁體字) example sentence using this word, "
        "followed by its Vietnamese translation in parentheses. "
        "Format: 「example sentence」（Vietnamese translation）"
    ) if include_example else "- example: empty string"

    prompt = f"""You are a Chinese-Vietnamese dictionary assistant.
For each word below, provide:
- meaning: concise Vietnamese translation (1-5 words, no lengthy explanations)
- pos_hint: brief part-of-speech hint in Vietnamese if helpful (e.g. "động từ", "danh từ", optional)
{example_instruction}

Return ONLY a valid JSON object (no markdown, no code block) where each key is the hanzi:
{{
  "漢字": {{
    "meaning": "nghĩa tiếng Việt",
    "example": "「例句」（bản dịch tiếng Việt）"
  }},
  ...
}}

Words to translate:
{word_list}
"""

    for attempt in range(MAX_RETRIES):
        try:
            response = client.chat.completions.create(
                model=MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                max_tokens=3000,
            )
            raw = response.choices[0].message.content.strip()
            # Strip markdown code blocks if present
            raw = re.sub(r'^```(?:json)?\s*', '', raw)
            raw = re.sub(r'\s*```$', '', raw)
            return json.loads(raw)
        except json.JSONDecodeError as e:
            print(f"  ⚠ JSON parse error (attempt {attempt+1}): {e}")
            if attempt == MAX_RETRIES - 1:
                return {}
            time.sleep(1)
        except Exception as e:
            print(f"  ⚠ API error (attempt {attempt+1}): {e}")
            if attempt == MAX_RETRIES - 1:
                return {}
            time.sleep(2 ** attempt)
    return {}

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    args = parse_args()

    # Load vocabulary
    vocab = load_vocab()
    print(f"Loaded {len(vocab)} words from vocabulary.json")

    # Load cache
    if args.reset_cache and CACHE_PATH.exists():
        CACHE_PATH.unlink()
        print("✓ Cache cleared")
    cache = load_cache()
    print(f"Cache: {len(cache)} words already translated")

    # Find words needing translation
    missing = [
        w for w in vocab
        if not w.get("meaning")
        and w["hanzi"] not in cache
        and (args.level is None or w["level"] == args.level)
        and (args.band  is None or w["band"]  == args.band)
    ]

    print(f"\nMissing translations: {len(missing)}")
    if not missing:
        print("Nothing to translate! Applying cache to vocabulary...")
    else:
        # Estimate cost
        batches   = (len(missing) + args.batch - 1) // args.batch
        est_input = batches * (args.batch * 20 + 200)   # ~20 tokens per word + prompt
        est_out   = batches * args.batch * 30             # ~30 tokens per word output
        est_cost  = (est_input / 1_000_000 * 0.15) + (est_out / 1_000_000 * 0.60)
        print(f"Batches: {batches} × {args.batch} words")
        print(f"Estimated cost: ${est_cost:.3f} USD (gpt-4o-mini)")

        if args.dry_run:
            print("\n[DRY RUN] First 5 words to translate:")
            for w in missing[:5]:
                print(f"  {w['hanzi']} ({w['pinyin']}) [{w['level']}]")
            print("Use --dry-run=False or omit --dry-run to actually translate.")
            return

        # Confirm
        ans = input(f"\nProceed with translation? (y/N): ").strip().lower()
        if ans != "y":
            print("Aborted.")
            return

        # Import OpenAI
        try:
            from openai import OpenAI
        except ImportError:
            print("Error: openai package not installed. Run: pip install openai --break-system-packages")
            sys.exit(1)

        client = OpenAI(api_key=args.key)
        include_example = not args.no_example

        # Translate in batches
        total_done  = 0
        total_error = 0
        start_time  = time.time()

        for batch_idx in range(0, len(missing), args.batch):
            batch = missing[batch_idx: batch_idx + args.batch]
            batch_num = batch_idx // args.batch + 1
            print(f"\nBatch {batch_num}/{batches}: {[w['hanzi'] for w in batch[:5]]}{'...' if len(batch)>5 else ''}", end="", flush=True)

            results = translate_batch(client, batch, include_example)

            for word in batch:
                h = word["hanzi"]
                if h in results:
                    cache[h] = results[h]
                    total_done += 1
                else:
                    # Try first variant (e.g. "你/妳" → "你")
                    variant = re.split(r'[/／]', h)[0].strip()
                    if variant in results:
                        cache[h] = results[variant]
                        total_done += 1
                    else:
                        total_error += 1

            # Save cache after every batch
            save_cache(cache)
            elapsed = time.time() - start_time
            rate = total_done / elapsed if elapsed > 0 else 0
            remaining_words = len(missing) - batch_idx - len(batch)
            eta = remaining_words / (rate if rate > 0 else 1)
            print(f" ✓ {total_done} done, {total_error} errors | ETA {eta:.0f}s")

            # Rate limit: ~3 req/s max for mini
            time.sleep(0.4)

        print(f"\n{'─'*50}")
        print(f"Translation complete: {total_done} translated, {total_error} errors")

    # Apply cache to vocabulary
    updated = 0
    for word in vocab:
        h = word["hanzi"]
        if h in cache and not word.get("meaning"):
            data = cache[h]
            if isinstance(data, dict):
                word["meaning"] = data.get("meaning", "")
                if data.get("example"):
                    word["example"] = data["example"]
            elif isinstance(data, str):
                word["meaning"] = data
            updated += 1

    print(f"Applied {updated} new meanings to vocabulary")
    print(f"Still missing: {sum(1 for w in vocab if not w.get('meaning'))}")

    # Save updated vocabulary
    save_vocab(vocab)
    print("\nDone! Rebuild the app with: npm run build")


if __name__ == "__main__":
    main()
