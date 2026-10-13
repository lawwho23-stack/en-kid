import os
import tempfile
import unittest

from scripts import import_audio_to_db


class LocalClipInventoryTest(unittest.TestCase):
    def test_static_manifest_yields_existing_local_clip(self) -> None:
        manifest = {
            "clips": {"word:cat": "/audio/clips/word-cat-abc123.mp3"},
            "hashes": {"word:cat": "abc123"},
        }

        with tempfile.TemporaryDirectory() as clip_dir:
            expected = os.path.join(clip_dir, "word-cat-abc123.mp3")
            with open(expected, "wb") as file:
                file.write(b"mp3")

            local_clips = getattr(import_audio_to_db, "local_clips", lambda *_: [])

            self.assertEqual(
                list(local_clips(manifest, clip_dir)),
                [("word:cat", expected)],
            )


if __name__ == "__main__":
    unittest.main()
