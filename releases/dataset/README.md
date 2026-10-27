---
language: en
license: cc0-1.0
task_categories:
  - text-classification
size_categories:
  - n<1K
tags:
  - synthetic
  - support-intents
  - grouped-split
  - reproducible-research
configs:
  - config_name: default
    data_files:
      - split: train
        path: train.jsonl
      - split: validation
        path: validation.jsonl
      - split: test
        path: test.jsonl
---

# Support Intent Grouped

**240 synthetic English support requests**, six labels, with deterministic,
label-stratified splits that keep entire template families together. Created by
Inioluwa Atanda for [AdapterLab](https://github.com/Eunini/adapterlab).

| Split | Examples | Groups | Examples per label |
|---|---:|---:|---:|
| Train | 180 | 36 | 30 |
| Validation | 30 | 6 | 5 |
| Test | 30 | 6 | 5 |

Labels: `account`, `billing`, `cancellation`, `delivery`, `login`, `technical`.
Each record contains `text`, `label`, `group`, and `split`. The label is a string;
map labels in sorted order when training a classifier. All names, reference
identifiers and requests are fictional. There are no customer records or calls.

## Why group the split?

Each label has eight hand-specified template families and five variants per
family. Variants share a family ID. A naive random row split would put nearly
identical patterns in training and test. Here, SHA-256 ordering of `42:{group}`
assigns one family per label to test, one to validation and six to training.
All 48 families appear in exactly one split. This reduces template leakage; it
does not make a synthetic dataset representative of real users.

`dataset_manifest.json` records the canonical SHA-256 fingerprint:
`452710ab0bf595050805180e10ff423b58723ae1f34c22153da411fd87cbd8dc`.
It matches the trained reference model's manifest. To reproduce, call
`prepare_dataset(demo_dataset())` from the source revision pinned in the model's
`provenance.json`. The generator is in `backend/adapterlab/data.py`.

```python
from datasets import load_dataset

dataset = load_dataset("Ineeoluwa/support-intent-grouped")
print(dataset["train"][0])
```

## Uses and limitations

Use it for testing training products, grouped split logic and small classification
experiments. It is not a natural-language benchmark or a customer-support corpus.
Examples are short, single intent, English and highly templated. Reference tokens
and suffixes may create shortcuts. There is no unknown-intent class, conversational
context, spelling-noise study or multilingual coverage. The test set is only 30
examples and should not support production accuracy claims.

The [reference LoRA model](https://huggingface.co/Ineeoluwa/adapterlab-support-intent-tiny)
has test macro F1 0.5199 and includes all per-class failures. The data was generated
for the real training run on 27 October 2026; source Git reconstruction dates do not
date the dataset or experiment.

CC0-1.0 applies to these synthetic examples. No underlying customer data was used.
