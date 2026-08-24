const sharp = require('sharp') as typeof import('sharp').default;

const MAX_PRODUCT_IMAGE_DIMENSION = 960;
const MAX_INPUT_PIXELS = 40_000_000;

export async function optimizeProductImage(inputPath: string, outputPath: string): Promise<void> {
  await sharp(inputPath, {
    failOn: 'error',
    limitInputPixels: MAX_INPUT_PIXELS,
  })
    .rotate()
    .resize({
      width: MAX_PRODUCT_IMAGE_DIMENSION,
      height: MAX_PRODUCT_IMAGE_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({
      quality: 82,
      effort: 4,
      smartSubsample: true,
    })
    .toFile(outputPath);
}
