export interface OcrToken {
  text: string;
  bbox: { x: number; y: number; w: number; h: number };
  confidence: number;
}

export interface RawOcrResult {
  imageId: string;
  engine: string;
  engineVersion: string;
  fullText: string;
  tokens: OcrToken[];
  durationMs: number;
}
