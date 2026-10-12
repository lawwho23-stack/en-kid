#!/usr/bin/env python3
"""TTS audio pipeline (docs/architecture.md section 7.1) — Deepgram Aura edition.

Reads content/worlds.json, synthesizes every clip id the game engine can
request (see lib/content.ts allTextIds — keep the two in sync), and writes
public/audio/audio-manifest.json mapping clip id -> static file URL.

Idempotent: filenames embed a hash of (clip_id, text, model), so changing a
word regenerates only that clip. Re-running skips everything up to date.

Usage:
    DEEPGRAM_API_KEY=xxx python3 scripts/generate_audio.py [--dry-run] [--prune] [--force]

Voice casting (override with env):
    AURA_VOICE_A  Momo the Cat   (default aura-2-luna-en: Friendly, Natural, Engaging)
    AURA_VOICE_B  Pippa the Bird (default aura-2-athena-en: Calm, Smooth, Storytelling)

Only stdlib is used — no pip install needed.
"""

import argparse
import hashlib
import json
import os
import re
import sys
import urllib.request
import urllib.parse

API_URL = "https://api.deepgram.com/v1/speak"
# Deepgram Aura-1: $0.015 / 1K chars. Aura-2: $0.030 / 1K chars.
RATE_PER_1K = 0.030

VOWELS = set("aeiou")


def article(word: str) -> str:
    return "an" if word[:1].lower() in VOWELS else "a"


def prompt_for(word_text: str, pool: str) -> str:
    if pool == "colors":
        return f"Where is {word_text}?"
    return f"Where is {article(word_text)} {word_text}?"


def fill(template: str, word: str) -> str:
    return template.replace("{word}", word).replace(
        "{letter}", word[:1].upper()
    )


def safe(name: string) -> str:
    name = name.replace(":", "-")
    return re.sub(r"[^A-Za-z0-9_-]+", "-", name).strip("-")[:60]


def clip_hash(clip_id: str, text: str, model: str) -> str:
    return hashlib.sha1(f"{clip_id}\0{text}\0{model}".encode()).hexdigest()[:12]


def build_inventory(data: dict, voices: dict) -> list:
    """Return [(clip_id, text, model)]. voices maps character voice tag -> model."""
    worlds = data["worlds"]
    words = data["words"]
    sets = data["celebration_sets"]

    # word -> character voice tag (words live in exactly one world)
    word_voice: dict = {}
    set_voice: dict = {}
    for world in worlds:
        tag = world["character"]["voice"]
        for lesson in world["lessons"]:
            set_voice.setdefault(lesson["celebration_set"], tag)
            for w in lesson["words"]:
                word_voice[w] = tag

    inv: list = []
    for world in worlds:
        tag = world["character"]["voice"]
        inv.append(
            (
                f"greeting:{world['character']['id']}",
                world["character"]["greeting"],
                voices[tag],
            )
        )
    for wid, w in words.items():
        tag = word_voice.get(wid, "voice-a")
        model = voices[tag]
        text = w["text"]
        # find the celebration set used with this word
        set_id = next(
            (
                s
                for s, _ in sets.items()
                if any(wid in le["words"] for wo in worlds for le in wo["lessons"] if le["celebration_set"] == s)
            ),
            "momo-cheer",
        )
        cset = sets[set_id]
        inv.append((f"word:{wid}", text, model))
        inv.append((f"phrase:{wid}", w["phrase"], model))
        inv.append((f"prompt:{wid}", prompt_for(text, w["pool"]), model))
        inv.append(
            (f"celebration:{wid}", fill(cset["celebration_line"], text), model)
        )
        inv.append((f"chant:{wid}", fill(cset["chants"][0], text), model))
        for chant in cset["chants"][1:]:
            inv.append((f"line:{fill(chant, text)}", fill(chant, text), model))
        for line in cset["song"]["lines"]:
            inv.append((f"line:{fill(line, text)}", fill(line, text), model))

    for set_id, cset in sets.items():
        model = voices[set_voice.get(set_id, "voice-a")]
        for i, line in enumerate(cset["praise"]):
            inv.append((f"praise:{set_id}:{i}", line, model))
        for i, line in enumerate(cset["retry"]):
            inv.append((f"retry:{set_id}:{i}", line, model))
        for i, line in enumerate(cset["motivation"]):
            inv.append((f"motivation:{set_id}:{i}", line, model))

    # de-dupe (same text can repeat across words, e.g. shared lines)
    seen = set()
    unique = []
    for clip_id, text, model in inv:
        if clip_id not in seen:
            seen.add(clip_id)
            unique.append((clip_id, text, model))
    return unique


def speak(text: str, model: str, api_key: str) -> bytes:
    url = f"{API_URL}?model={urllib.parse.quote(model)}"
    req = urllib.request.Request(
        url,
        data=json.dumps({"text": text}).encode(),
        headers={
            "Authorization": f"Token {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            return res.read()
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")[:500]
        print(f"ERROR {e.code} for model={model} text={text!r}: {body}", file=sys.stderr)
        raise SystemExit(1)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--content", default="content/worlds.json")
    ap.add_argument("--out", default="public/audio/clips")
    ap.add_argument("--manifest", default="public/audio/audio-manifest.json")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--prune", action="store_true",
                    help="delete mp3 files no longer referenced")
    ap.add_argument("--force", action="store_true",
                    help="regenerate every clip")
    ap.add_argument("--manifest-base", default="/audio/clips",
                    help="URL base for manifest entries: /audio/clips (static "
                         "files) or /api/audio (database-backed clips)")
    args = ap.parse_args()

    voices = {
        "voice-a": os.environ.get("AURA_VOICE_A", "aura-2-luna-en"),
        "voice-b": os.environ.get("AURA_VOICE_B", "aura-2-athena-en"),
    }

    with open(args.content, encoding="utf-8") as f:
        data = json.load(f)
    inventory = build_inventory(data, voices)

    total_chars = sum(len(t) for _, t, _ in inventory)
    print(f"Clips: {len(inventory)}, chars: {total_chars}, "
          f"est. cost: ${total_chars / 1000 * RATE_PER_1K:.2f} "
          f"(voices: {voices['voice-a']}, {voices['voice-b']})")
    if args.dry_run:
        return

    api_key = os.environ.get("DEEPGRAM_API_KEY", "")
    if not api_key:
        print("ERROR: set DEEPGRAM_API_KEY first.", file=sys.stderr)
        raise SystemExit(2)

    try:
        with open(args.manifest, encoding="utf-8") as f:
            manifest = json.load(f)
    except FileNotFoundError:
        manifest = {"version": 1, "clips": {}}
    clips: dict = manifest.get("clips", {})
    hashes: dict = manifest.get("hashes", {})
    manifest.setdefault(
        "note",
        "Generated by scripts/generate_audio.py (Deepgram Aura). "
        "Missing ids fall back to synth. stinger:default is instrumental "
        "(royalty-free file or synth) and is intentionally not generated.",
    )

    os.makedirs(args.out, exist_ok=True)
    api_mode = args.manifest_base == "/api/audio"
    made, skipped = 0, 0
    for clip_id, text, model in inventory:
        h = clip_hash(clip_id, text, model)
        filename = f"{safe(clip_id)}-{h}.mp3"
        new_url = (
            f"/api/audio/{urllib.parse.quote(clip_id, safe='')}"
            if api_mode
            else f"{args.manifest_base}/{filename}"
        )
        if (
            not args.force
            and hashes.get(clip_id) == h
            and os.path.exists(os.path.join(args.out, filename))
        ):
            clips[clip_id] = new_url
            skipped += 1
            continue
        audio = speak(text, model, api_key)
        with open(os.path.join(args.out, filename), "wb") as f:
            f.write(audio)
        # remove the stale file for this clip, if any
        old = clips.get(clip_id)
        if old and not old.startswith("/api/audio/"):
            stale = os.path.join(args.out, os.path.basename(old))
            if os.path.exists(stale) and os.path.basename(stale) != filename:
                os.remove(stale)
        clips[clip_id] = new_url
        hashes[clip_id] = h
        made += 1
        print(f"  + {clip_id} ({len(audio)} bytes)")

    if args.prune and args.manifest_base != "/api/audio":
        live = {os.path.basename(v) for v in clips.values()}
        for name in os.listdir(args.out):
            if name.endswith(".mp3") and name not in live:
                os.remove(os.path.join(args.out, name))
                print(f"  - pruned {name}")

    manifest["clips"] = clips
    manifest["hashes"] = hashes
    manifest["version"] = 1
    with open(args.manifest, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"Done: {made} generated, {skipped} skipped. Manifest: {args.manifest}")


if __name__ == "__main__":
    main()
