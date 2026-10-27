import {
  env,
  BertTokenizer,
  AutoModelForSequenceClassification,
} from "@huggingface/transformers";

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = new URL("../models/", self.location.href).href;
env.backends.onnx.wasm.wasmPaths = new URL(
  "../runtime/",
  self.location.href,
).href;
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.proxy = false;
env.backends.onnx.wasm.initTimeout = 30000;
let classifier;
async function localTokenizer() {
  const root = new URL("support-intent-tiny/", env.localModelPath);
  const read = async (filename) => {
    const response = await fetch(new URL(filename, root));
    if (!response.ok) throw new Error("Tokenizer files could not load");
    return response.json();
  };
  const [definition, config] = await Promise.all([
    read("tokenizer.json"),
    read("tokenizer_config.json"),
  ]);
  return new BertTokenizer(definition, config);
}
self.onmessage = async (event) => {
  const { id, text } = event.data;
  try {
    if (
      typeof text !== "string" ||
      text.trim().length < 3 ||
      text.length > 1500
    )
      throw new Error("Enter 3–1,500 characters.");
    if (!classifier) {
      self.postMessage({
        id,
        type: "progress",
        message: "Loading the trained model and local inference runtime…",
      });
      const [tokenizer, model] = await Promise.all([
        localTokenizer(),
        AutoModelForSequenceClassification.from_pretrained(
          "support-intent-tiny",
          {
            device: "wasm",
            dtype: "fp32",
          },
        ),
      ]);
      classifier = { tokenizer, model };
    }
    const started = performance.now();
    const inputs = classifier.tokenizer(text, {
      truncation: true,
      max_length: 96,
    });
    const output = await classifier.model(inputs);
    const logits = Array.from(output.logits.data);
    const maximum = Math.max(...logits);
    const exponents = logits.map((value) => Math.exp(value - maximum));
    const total = exponents.reduce((sum, value) => sum + value, 0);
    const scores = exponents
      .map((value, index) => ({
        label: classifier.model.config.id2label[index],
        score: value / total,
      }))
      .sort((a, b) => b.score - a.score);
    self.postMessage({
      id,
      type: "result",
      scores,
      milliseconds: performance.now() - started,
    });
  } catch (error) {
    console.error(
      "Model inference failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    classifier = undefined;
    self.postMessage({
      id,
      type: "error",
      message:
        "Inference could not finish. Check that the model files loaded and try again.",
    });
  }
};
