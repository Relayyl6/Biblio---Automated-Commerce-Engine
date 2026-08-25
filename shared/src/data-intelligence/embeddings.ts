import { logger } from "@ace/shared/logger.js";
import { pipeline, env } from "@xenova/transformers";

// Disable local models to always fetch from HF hub (caches automatically in ~/.cache/huggingface)
env.allowLocalModels = false;

// Create a singleton promise for the pipeline so it's only loaded once per process.
// Xenova/clip-vit-base-patch32 is lightweight enough to run in Node for MVP.
const pipelinePromise = pipeline("feature-extraction", "Xenova/clip-vit-base-patch32", {
  quantized: true, // Use int8 quantization to save memory and speed up
});

/**
 * Generates a 512-dimensional CLIP embedding for a given text or image URL/Buffer.
 * For images, you can pass a URL or a Base64 Data URI (e.g. data:image/jpeg;base64,...).
 */
export async function generateEmbedding(input: string): Promise<number[]> {
  try {
    const extractor = await pipelinePromise;
    // The model automatically detects if it's processing an image (URL/data URI) or text
    const output = await extractor(input);
    // output is a Tensor, we need to extract the raw float32 array
    const data = Array.from(output.data);
    
    // Some models output multi-dimensional tensors, we just need a flat 512-dim array
    // xenova/clip outputs [1, 512]
    return data as number[];
  } catch (err) {
    logger.error("[generateEmbedding] Failed to generate embedding:", err);
    throw err;
  }
}
