"""Check public artifacts, dataset separation, model cards and release hashes."""

import hashlib
import json
import re
from pathlib import Path

import yaml
from huggingface_hub import DatasetCard, ModelCard

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"


def main():
    groups, texts, all_rows = {}, set(), []
    for split, count in [("train", 180), ("validation", 30), ("test", 30)]:
        rows = [
            json.loads(line)
            for line in (RELEASES / "dataset" / f"{split}.jsonl").read_text().splitlines()
        ]
        assert len(rows) == count
        assert {row["label"] for row in rows} == {
            "account",
            "billing",
            "cancellation",
            "delivery",
            "login",
            "technical",
        }
        for row in rows:
            assert row["split"] == split
            assert row["text"] not in texts
            texts.add(row["text"])
            assert groups.setdefault(row["group"], split) == split
        all_rows.extend(rows)
    # Match the source's canonical JSON fingerprint, not JSONL serialization.
    all_rows.sort(key=lambda row: (row["label"], " ".join(row["text"].split()).casefold()))
    fingerprint = hashlib.sha256(
        json.dumps(all_rows, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    assert (
        fingerprint
        == json.loads((RELEASES / "model/evaluation.json").read_text())["dataset_fingerprint"]
    )
    cases = [
        json.loads(line)
        for line in (RELEASES / "voice-dataset/scenarios.jsonl").read_text().splitlines()
    ]
    assert len(cases) == len({row["id"] for row in cases}) == 34
    for row in cases:
        assert len(json.loads(row["events_json"])) == len(row["expected_codes"])
    ModelCard.load(str(RELEASES / "model/README.md")).validate()
    for folder in ["dataset", "voice-dataset"]:
        DatasetCard.load(str(RELEASES / folder / "README.md")).validate()
    hashes = {}
    for folder in [
        "model",
        "dataset",
        "voice-dataset",
        "adapterlab-space",
        "sdr-space",
        "hotel-space",
    ]:
        directory = RELEASES / folder
        assert (directory / "README.md").is_file()
        assert (directory / "LICENSE").is_file()
        if folder.endswith("-space"):
            raw = (directory / "README.md").read_text().split("---", 2)[1]
            config = yaml.safe_load(raw)
            assert config["sdk"] == "static" and config["app_file"] == "index.html"
            assert len(config["short_description"]) <= 100
            assert (directory / "index.html").is_file()
            assert (directory / "source/web/src/voice-engine.mjs").is_file()
        entries = {}
        for path in sorted(directory.rglob("*")):
            if not path.is_file() or path.name in ["checksums.json", ".release.json"]:
                continue
            if (
                path.suffix in [".json", ".jsonl", ".md", ".html", ".mjs", ".css"]
                and path.stat().st_size < 2_000_000
            ):
                content = path.read_text()
                assert not re.search(
                    r"hf_[A-Za-z0-9]{25,}|sk-[A-Za-z0-9_-]{25,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
                    content,
                ), f"Credential pattern: {path.name}"
            entries[str(path.relative_to(directory))] = hashlib.sha256(
                path.read_bytes()
            ).hexdigest()
        hashes[folder] = entries
        (directory / "checksums.json").write_text(json.dumps(entries, indent=2) + "\n")
    report = {
        "status": "passed",
        "support_examples": len(all_rows),
        "disjoint_template_groups": len(groups),
        "dataset_fingerprint": fingerprint,
        "voice_scenarios": len(cases),
        "release_hashes": hashes,
    }
    (ROOT / "evidence/release-validation.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({key: value for key, value in report.items() if key != "release_hashes"}))


if __name__ == "__main__":
    main()
