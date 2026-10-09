import { OcrEngine } from './engine';
import { RawOcrResult } from './types';
import { PreprocessedImage } from '../preprocess/types';

export class MockOcrEngine implements OcrEngine {
    private fixture: RawOcrResult;

    constructor(fixture: RawOcrResult) {
        this.fixture = fixture;
    }

    async process(image: PreprocessedImage): Promise<RawOcrResult> {
        return this.fixture;
    }
}
