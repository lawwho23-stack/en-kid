#!/usr/bin/env python3
"""Upload generated clips into Neon (audio_clips table, bytea).

Reads public/audio/audio-manifest.json + public/audio/clips/*.mp3 and upserts
every clip by clip_id, skipping rows whose sha256 already matches.

Usage:
    pip install "psycopg[binary]"
    DATABASE_URL="postgresql://..." python3 scripts/import_audio_to_db.py

Only runs when you ask — never part of the request path.
"""

import hashlib
import json
import os
import re
import sys

MANIFEST = "public/audio/audio-manifest.json"
CLIP_DIR = "public/audio/clips"


def safe(name: str) -> str:
    name = name.replace(":", "-")
    return re.sub(r"[^A-Za-z0-9_-]+", "-", name).strip("-")[:60]


def local_clips(manifest: dict, clip_dir: str = CLIP_DIR):
    """Yield manifest clip ids with their generated local MP3 paths."""
    hashes: dict = manifest.get("hashes", {})
    for clip_id in manifest.get("clips", {}):
        content_hash = hashes.get(clip_id, "")
        if not content_hash:
            continue
        local = os.path.join(
            clip_dir,
            f"{safe(clip_id)}-{content_hash}.mp3",
        )
        if os.path.exists(local):
            yield clip_id, local


def main() -> None:
    try:
        import psycopg
    except ImportError:
        print('ERROR: pip install "psycopg[binary]" first.', file=sys.stderr)
        raise SystemExit(2)

    dsn = os.environ.get("DATABASE_URL", "")
    if not dsn:
        print("ERROR: set DATABASE_URL first.", file=sys.stderr)
        raise SystemExit(2)

    with open(MANIFEST, encoding="utf-8") as f:
        manifest = json.load(f)
    clips = list(local_clips(manifest))
    if not clips:
        print("Manifest has no generated local clips — nothing to import.")
        return

    uploaded, skipped = 0, 0
    with psycopg.connect(dsn) as conn:
        for clip_id, local in sorted(clips):
            with open(local, "rb") as f:
                data = f.read()
            digest = hashlib.sha256(data).hexdigest()
            row = conn.execute(
                "SELECT sha256 FROM audio_clips WHERE clip_id = %s", (clip_id,)
            ).fetchone()
            if row and row[0] == digest:
                skipped += 1
                continue
            conn.execute(
                """
                INSERT INTO audio_clips
                    (clip_id, bytes, content_type, byte_length, sha256, updated_at)
                VALUES (%s, %s, 'audio/mpeg', %s, %s, now())
                ON CONFLICT (clip_id) DO UPDATE SET
                    bytes = EXCLUDED.bytes,
                    byte_length = EXCLUDED.byte_length,
                    sha256 = EXCLUDED.sha256,
                    updated_at = now()
                """,
                (clip_id, data, len(data), digest),
            )
            uploaded += 1
        conn.commit()
    print(f"Done: {uploaded} uploaded, {skipped} skipped, "
          f"{len(clips)} in manifest.")


if __name__ == "__main__":
    main()
