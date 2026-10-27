"""Package the existing, measured AdapterLab run without retraining it."""

import hashlib
import importlib.metadata
import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
import torch

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / "adapterlab"
sys.path.insert(0, str(SOURCE / "backend"))
from adapterlab.config import Settings  # noqa: E402
from adapterlab.data import demo_dataset, prepare_dataset  # noqa: E402
from adapterlab.training import classification_metrics, load_artifact  # noqa: E402

RUN_ID = "76bf4ca2-b27f-4f0b-8b9f-ceab89f90a8f"
RUN = SOURCE / "artifacts" / RUN_ID
MODEL = ROOT / "releases/model"
DATA = ROOT / "releases/dataset"


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def main():
    rows, report = prepare_dataset(demo_dataset())
    original = json.loads((RUN / "evaluation.json").read_text())
    assert report["fingerprint"] == original["dataset_fingerprint"]
    assert report["splits"] == {"train": 180, "validation": 30, "test": 30}
    DATA.mkdir(exist_ok=True)
    for split in ("train", "validation", "test"):
        selected = [row for row in rows if row["split"] == split]
        (DATA / f"{split}.jsonl").write_text(
            "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in selected)
        )
    write_json(DATA / "dataset_manifest.json", report)
    MODEL.mkdir(exist_ok=True)
    model, tokenizer, metadata = load_artifact(RUN, Settings())
    reference_rows = [row for row in rows if row["split"] == "test"]
    texts = [row["text"] for row in reference_rows]
    inputs = tokenizer(
        texts,
        return_tensors="pt",
        padding="max_length",
        truncation=True,
        max_length=metadata["config"]["max_length"],
    )
    with torch.inference_mode():
        reference_logits = model(**inputs).logits.numpy()
    model = model.merge_and_unload(safe_merge=True)
    model.eval()
    with torch.inference_mode():
        merged_logits = model(**inputs).logits.numpy()
    np.testing.assert_allclose(reference_logits, merged_logits, rtol=1e-4, atol=1e-5)
    model.save_pretrained(MODEL, safe_serialization=True)
    tokenizer.save_pretrained(MODEL)
    shutil.copytree(RUN / "checkpoint", MODEL / "adapter", dirs_exist_ok=True)
    # PEFT's original export omitted the base revision. Pin it in the public copy.
    config_path = MODEL / "adapter/adapter_config.json"
    config = json.loads(config_path.read_text())
    config["revision"] = metadata["base_revision"]
    write_json(config_path, config)
    (MODEL / "adapter/README.md").write_text("""---
base_model: google/bert_uncased_L-2_H-128_A-2
library_name: peft
license: apache-2.0
---

# Original AdapterLab LoRA checkpoint

The unchanged adapter tensors and six-label classification head from the
27 October 2026 reference run. The adapter configuration pins the original base
revision. This folder also retains the original tokenizer and Apache-2.0 license.

See the parent model card for measured results, limitations, label mappings,
training provenance and loading instructions. The root classifier is a merged
copy of these weights; `onnx/model.onnx` is its equivalent float32 export.
""")
    for filename in (
        "evaluation.json",
        "training_history.json",
        "dataset_manifest.json",
        "run.json",
    ):
        shutil.copy2(RUN / filename, MODEL / filename)
    shutil.copy2(RUN / "BASE_MODEL_LICENSE.txt", MODEL / "LICENSE")
    shutil.copy2(RUN / "BASE_MODEL_LICENSE.txt", MODEL / "adapter/LICENSE")

    class Export(torch.nn.Module):
        def __init__(self, classifier):
            super().__init__()
            self.classifier = classifier

        def forward(self, input_ids, attention_mask, token_type_ids):
            return self.classifier(
                input_ids=input_ids,
                attention_mask=attention_mask,
                token_type_ids=token_type_ids,
            ).logits

    onnx_path = MODEL / "onnx/model.onnx"
    onnx_path.parent.mkdir(exist_ok=True)
    sample = tokenizer(texts[:2], return_tensors="pt", padding=True, truncation=True, max_length=96)
    names = ["input_ids", "attention_mask", "token_type_ids"]
    torch.onnx.export(
        Export(model).eval(),
        tuple(sample[name] for name in names),
        str(onnx_path),
        input_names=names,
        output_names=["logits"],
        opset_version=17,
        dynamic_axes={
            **{name: {0: "batch", 1: "tokens"} for name in names},
            "logits": {0: "batch"},
        },
        dynamo=False,
        external_data=False,
    )
    onnx.checker.check_model(str(onnx_path))
    session = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    onnx_logits = session.run(None, {key: value.numpy() for key, value in inputs.items()})[0]
    np.testing.assert_allclose(merged_logits, onnx_logits, rtol=1e-4, atol=1e-5)
    truth = [report["labels"].index(row["label"]) for row in reference_rows]
    metrics = classification_metrics(truth, onnx_logits.argmax(-1).tolist(), report["labels"])
    assert metrics["accuracy"] == original["test"]["accuracy"]
    assert metrics["macro_f1"] == original["test"]["macro_f1"]
    # Exercise dynamic lengths, singleton batches, truncation, and Unicode.
    for batch in [
        ["Please cancel my membership."],
        ["hello", "A much longer request " * 80],
        ["Ẹ káàárọ̀", "🔐", "a"],
    ]:
        encoded = tokenizer(
            batch, return_tensors="pt", padding=True, truncation=True, max_length=96
        )
        with torch.inference_mode():
            expected = model(**encoded).logits.numpy()
        actual = session.run(None, {k: v.numpy() for k, v in encoded.items()})[0]
        np.testing.assert_allclose(expected, actual, rtol=1e-4, atol=1e-5)

    provenance = {
        "packaged_at": datetime.now(timezone.utc).isoformat(),
        "source_repository": "https://github.com/Eunini/adapterlab",
        "source_revision": subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=SOURCE, text=True
        ).strip(),
        "original_run_id": RUN_ID,
        "trained_at": metadata["trained_at"],
        "base_model": metadata["base_model"],
        "base_revision": metadata["base_revision"],
        "dataset_fingerprint": report["fingerprint"],
        "operations": [
            "merge original LoRA into pinned base",
            "export float32 ONNX opset 17",
        ],
        "retrained": False,
        "packages": {
            name: importlib.metadata.version(name)
            for name in [
                "torch",
                "transformers",
                "peft",
                "safetensors",
                "onnx",
                "onnxruntime",
            ]
        },
    }
    verification = {
        "status": "passed",
        "test_samples": len(truth),
        "original_vs_merged_max_absolute_logit_error": float(
            np.max(np.abs(reference_logits - merged_logits))
        ),
        "merged_vs_onnx_max_absolute_logit_error": float(
            np.max(np.abs(merged_logits - onnx_logits))
        ),
        "prediction_agreement": float(
            np.mean(reference_logits.argmax(-1) == onnx_logits.argmax(-1))
        ),
        "onnx_metrics": metrics,
        "additional_dynamic_shape_batches": 3,
    }
    write_json(MODEL / "provenance.json", provenance)
    write_json(MODEL / "export_verification.json", verification)
    write_json(ROOT / "evidence/model-export.json", verification)
    manifest = {
        str(path.relative_to(MODEL)): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in sorted(MODEL.rglob("*"))
        if path.is_file() and path.name != "checksums.json"
    }
    write_json(MODEL / "checksums.json", manifest)
    print(
        json.dumps(
            {
                "status": "passed",
                "files": len(manifest),
                "accuracy": metrics["accuracy"],
                "macro_f1": metrics["macro_f1"],
            }
        )
    )


if __name__ == "__main__":
    main()
