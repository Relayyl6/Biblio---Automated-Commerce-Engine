import { RawOcrResult } from './types';
import { PreprocessedImage } from '../preprocess/types';

export interface OcrEngine {
    process(image: PreprocessedImage): Promise<RawOcrResult>;
}
