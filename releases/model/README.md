---
language: en
license: apache-2.0
library_name: transformers
pipeline_tag: text-classification
base_model: google/bert_uncased_L-2_H-128_A-2
base_model_relation: finetune
datasets:
  - Ineeoluwa/support-intent-grouped
tags:
  - bert
  - lora
  - peft
  - onnx
  - transformers.js
  - reproducible-research
  - synthetic-data
model-index:
  - name: AdapterLab Support Intent Tiny
    results:
      - task:
          type: text-classification
          name: Support intent classification
        dataset:
          type: Ineeoluwa/support-intent-grouped
          name: Support Intent Grouped (synthetic)
          split: test
        metrics:
          - type: accuracy
            name: Accuracy
            value: 0.5666666666666667
          - type: f1
            name: Macro F1
            value: 0.51994301994302
---

# AdapterLab Support Intent Tiny

A real, CPU-trained LoRA adaptation of BERT Tiny for six English support intents:
`account`, `billing`, `cancellation`, `delivery`, `login`, and `technical`.
Built by **Inioluwa Atanda** as the reference experiment for
[AdapterLab](https://github.com/Eunini/adapterlab), a training product with dataset
validation, durable job execution, evaluation, export and inference.

**[Try the browser demo](https://huggingface.co/spaces/Ineeoluwa/adapterlab-inference)** ·
**[Inspect the dataset](https://huggingface.co/datasets/Ineeoluwa/support-intent-grouped)**

This release demonstrates an inspectable training and deployment pipeline. It is
an experimental classifier with modest performance, not a production-ready model.

## Measured results

The grouped, synthetic holdout contains **30 examples, five per label**.

| Measure | Result |
|---|---:|
| Accuracy | 0.5667 |
| Macro F1 | 0.5199 |
| Trainable parameters | 8,966 |
| Parameters in PEFT wrapper | 4,395,660 |
| Trainable fraction | 0.204% |
| Training steps | 92 |
| Training time | 164.736 seconds |

Training time is one workspace CPU run with two PyTorch threads on x86_64; it is
not a general latency benchmark. The exported classifier has 4,386,694 parameters
after merging; the wrapper count includes LoRA and classifier wrapper copies.

Billing and cancellation each have **zero test F1**. Do not infer strong general
support accuracy from the aggregate score. The baseline in `evaluation.json` is
the pretrained encoder with an **untrained classification head**, not a trained
head-only competitor. No state-of-the-art or multilingual capability is claimed.

## Training and provenance

- Base: `google/bert_uncased_L-2_H-128_A-2`, revision
  `30b0a37ccaaa32f332884b96992754e246e48c5f`.
- LoRA rank 8, alpha 16, dropout 0.05, query/value targets; classifier trained.
- AdamW, learning rate 0.001, weight decay 0.01, batch 8, four epochs, seed 42.
- Maximum input length 96 tokens; best checkpoint chosen by validation macro F1,
  with validation loss as the tie-breaker.
- 180 train / 30 validation / 30 test examples; template groups are disjoint.
- Actual training date: **27 October 2026**, recorded in `run.json`.
  Reconstructed dates in the source project's Git history are not training dates.

`provenance.json` pins the original source revision, run ID and package versions.
The original evaluation, per-class results, confusion matrix, training history,
dataset fingerprint and checksums are included. This publication reused the
existing run; it did not retrain or change its measurements.

## Load the merged classifier

```python
from transformers import pipeline

classifier = pipeline(
    "text-classification",
    model="Ineeoluwa/adapterlab-support-intent-tiny",
    trust_remote_code=False,
    device=-1,
)
print(classifier(
    "I cannot sign in after resetting my password.",
    top_k=6, truncation=True, max_length=96,
))
```

The root contains merged `model.safetensors` and its tokenizer. The original
adapter and tokenizer are retained under `adapter/`. To load that adapter, create
the pinned base with `num_labels=6` and the `id2label` / `label2id` mappings in
`config.json`, then use `PeftModel.from_pretrained(base, repo, subfolder="adapter")`.
Creating a generic two-label base will not load the six-label head correctly.

`onnx/model.onnx` is float32, opset 17, with dynamic batch and sequence dimensions.
The browser demo uses Transformers.js and a local ONNX Runtime WASM worker.
PyTorch-to-ONNX prediction agreement is **30/30** on the test set; maximum logit
error is below `1e-5`. Singleton, mixed-length, truncated and Unicode batches were
also compared. This is export equivalence, not an independent accuracy study.

## Intended use and limits

Useful for learning PEFT, checking grouped splits, reproducing a small experiment,
and inspecting browser inference. The examples are templated synthetic English,
not customer tickets. Reference tokens, template choice and the tiny holdout
limit representativeness. The model has no rejection class, calibration,
robustness, fairness, real-world or Yoruba evaluation. Softmax scores should not
be treated as calibrated probabilities. Avoid sensitive or consequential use.

## License

Apache-2.0, including the base model's license. Dataset examples are released
separately under CC0-1.0. Original base model credit: Google / the BERT authors.
