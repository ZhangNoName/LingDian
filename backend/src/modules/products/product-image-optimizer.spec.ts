import { strict as assert } from 'node:assert';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { optimizeProductImage } from './product-image-optimizer';

const sharp = require('sharp') as typeof import('sharp').default;

test('product images are resized and encoded as WebP', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lingdian-product-image-'));
  const inputPath = join(directory, 'source.png');
  const outputPath = join(directory, 'optimized.webp');

  try {
    await sharp({
      create: {
        width: 1_200,
        height: 800,
        channels: 3,
        background: '#d35400',
      },
    }).png().toFile(inputPath);

    await optimizeProductImage(inputPath, outputPath);

    const metadata = await sharp(await readFile(outputPath)).metadata();
    assert.equal(metadata.format, 'webp');
    assert.equal(metadata.width, 960);
    assert.equal(metadata.height, 640);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
