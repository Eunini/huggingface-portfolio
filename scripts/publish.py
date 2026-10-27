"""Publish validated release folders using the existing Hugging Face CLI login."""

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from huggingface_hub import HfApi, hf_hub_download
from huggingface_hub.errors import EntryNotFoundError, RepositoryNotFoundError

ROOT = Path(__file__).resolve().parents[1]
ACCOUNT = "Ineeoluwa"
RELEASE_ID = "inioluwa-applied-ai-portfolio-2026-10"
REPOS = [
    ("dataset", "support-intent-grouped", "dataset"),
    ("dataset", "voice-workflow-scenarios", "voice-dataset"),
    ("model", "adapterlab-support-intent-tiny", "model"),
    ("space", "adapterlab-inference", "adapterlab-space"),
    ("space", "ai-sdr-workflow-lab", "sdr-space"),
    ("space", "hotel-receptionist-lab", "hotel-space"),
]


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--publish",
        action="store_true",
        help="Create public repositories and upload the prepared release",
    )
    args = parser.parse_args()
    api = HfApi()
    identity = api.whoami()
    if identity.get("name") != ACCOUNT or identity.get("type") != "user":
        raise SystemExit("The authenticated account must be Ineeoluwa. No writes performed.")
    validation = json.loads((ROOT / "evidence/release-validation.json").read_text())
    if validation.get("status") != "passed":
        raise SystemExit("Release validation has not passed.")
    for folder, expected in validation["release_hashes"].items():
        current = {
            str(path.relative_to(ROOT / "releases" / folder)): sha256(path)
            for path in sorted((ROOT / "releases" / folder).rglob("*"))
            if path.is_file() and path.name not in ["checksums.json", ".release.json"]
        }
        if current != expected:
            raise SystemExit(f"Release changed after validation: {folder}")
    print(
        json.dumps(
            {
                "account": ACCOUNT,
                "mode": "publish" if args.publish else "dry-run",
                "repositories": [f"{ACCOUNT}/{name}" for _, name, _ in REPOS],
            }
        )
    )
    if not args.publish:
        return
    published = []
    for kind, name, folder in REPOS:
        repo_id = f"{ACCOUNT}/{name}"
        directory = ROOT / "releases" / folder
        try:
            info = api.repo_info(repo_id, repo_type=kind)
            files = api.list_repo_files(repo_id, repo_type=kind)
            if set(files) - {".gitattributes"}:
                try:
                    marker_path = hf_hub_download(repo_id, ".release.json", repo_type=kind)
                    marker = json.loads(Path(marker_path).read_text())
                except EntryNotFoundError:
                    raise SystemExit(
                        f"Existing repository is not this release; refusing to overwrite {repo_id}"
                    )
                if marker.get("release") != RELEASE_ID:
                    raise SystemExit(f"Release ownership marker does not match: {repo_id}")
        except RepositoryNotFoundError:
            api.create_repo(
                repo_id,
                repo_type=kind,
                private=False,
                **({"space_sdk": "static"} if kind == "space" else {}),
            )
            info = api.repo_info(repo_id, repo_type=kind)
        (directory / ".release.json").write_text(
            json.dumps({"release": RELEASE_ID, "account": ACCOUNT}) + "\n"
        )
        api.upload_folder(
            repo_id=repo_id,
            repo_type=kind,
            folder_path=directory,
            commit_message="Publish tested model, reproducible data and inspectable demo",
            parent_commit=info.sha,
        )
        after = api.repo_info(repo_id, repo_type=kind)
        prefix = {"model": "", "dataset": "datasets/", "space": "spaces/"}[kind]
        entry = {
            "repo_id": repo_id,
            "kind": kind,
            "commit": after.sha,
            "url": f"https://huggingface.co/{prefix}{repo_id}",
        }
        published.append(entry)
        print(json.dumps(entry))
        (ROOT / "evidence/publication.json").write_text(
            json.dumps(
                {
                    "published_at": datetime.now(timezone.utc).isoformat(),
                    "account": ACCOUNT,
                    "repositories": published,
                },
                indent=2,
            )
            + "\n"
        )
    collection = api.create_collection(
        "Applied AI: models, training and voice systems",
        namespace=ACCOUNT,
        exists_ok=True,
        description="Inioluwa Atanda's inspectable ML artifacts and public workflow companions: LoRA training, browser inference, AI SDR and hotel reception.",
    )
    notes = {
        "adapterlab-support-intent-tiny": "Real BERT Tiny LoRA weights, pinned provenance, full evaluation and equivalent ONNX export. Experimental English classifier.",
        "support-intent-grouped": "240 synthetic examples; deterministic template-group splits prevent near-duplicate template leakage.",
        "voice-workflow-scenarios": "34 public regression cases for orchestration boundaries. Not a hidden benchmark or a voice-model quality score.",
        "adapterlab-inference": "Run the actual exported model locally in a browser worker, with six scores and measured limitations.",
        "ai-sdr-workflow-lab": "Companion to the private SDR voice system: permission, opt-outs, calendar checks and stale-audio rejection. Deterministic simulation.",
        "hotel-receptionist-lab": "Companion to the private hotel voice system: authoritative offers, room holds and verified-payment boundaries. Fictional simulation.",
    }
    for entry in published:
        api.add_collection_item(
            collection.slug,
            entry["repo_id"],
            entry["kind"],
            note=notes[entry["repo_id"].split("/")[1]],
            exists_ok=True,
        )
    api.update_collection_metadata(collection.slug, position=0, private=False)
    report = json.loads((ROOT / "evidence/publication.json").read_text())
    report["collection"] = collection.url
    (ROOT / "evidence/publication.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"collection": collection.url}))


if __name__ == "__main__":
    main()
