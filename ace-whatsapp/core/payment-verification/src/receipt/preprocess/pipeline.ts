import { PreprocessedImage } from './types';

export function preprocess(input: Buffer): PreprocessedImage {
    // Dummy implementation for deskew/denoise
    const deskewed = deskew(input);
    const denoised = denoise(deskewed);
    return {
        buffer: denoised,
        width: 800,
        height: 600,
        mimeType: 'image/jpeg'
    };
}

function deskew(buffer: Buffer): Buffer {
    return buffer;
}

function denoise(buffer: Buffer): Buffer {
    return buffer;
}
