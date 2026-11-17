import { BadRequestException, Inject, Injectable, Optional } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile, link, unlink, readdir } from 'node:fs/promises';
import { join } from 'node:path';
const sharp = require('sharp') as typeof import('sharp').default;
export const PRODUCT_IMAGE_DIRECTORY = Symbol('PRODUCT_IMAGE_DIRECTORY');
export const PRODUCT_IMAGE_MAX_BYTES = 3 * 1024 * 1024;
export type MerchantImageFile = { buffer: Buffer; mimetype: string };
const formats: Record<string, string> = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' };
export function imageBucket(storeId: string) {
  return createHash('sha256').update(storeId).digest('hex').slice(0, 32);
}
export function imageAssetUrl(storeId: string, assetKey: string) {
  return `/uploads/products/merchant/${imageBucket(storeId)}/${assetKey}.webp`;
}
@Injectable()
export class ProductImageStorage {
  private readonly root: string;
  constructor(@Optional() @Inject(PRODUCT_IMAGE_DIRECTORY) root?: string) {
    this.root = root ?? join(process.cwd(), 'uploads', 'products', 'merchant');
  }
  async normalize(file?: MerchantImageFile): Promise<Buffer> {
    if (!file?.buffer.length) throw new BadRequestException('catalog.imageRequired');
    if (file.buffer.length > PRODUCT_IMAGE_MAX_BYTES) throw new BadRequestException('catalog.imageTooLarge');
    if (!formats[file.mimetype]) throw new BadRequestException('catalog.imageType');
    try {
      const pipeline = sharp(file.buffer, { failOn: 'error', limitInputPixels: 40_000_000 });
      const metadata = await pipeline.metadata();
      if (metadata.format !== formats[file.mimetype] || (metadata.pages ?? 1) > 1)
        throw new BadRequestException('catalog.imageType');
      const data = await pipeline
        .rotate()
        .resize({ width: 960, height: 960, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82, effort: 4, smartSubsample: true })
        .toBuffer();
      if (data.length > PRODUCT_IMAGE_MAX_BYTES) throw new BadRequestException('catalog.imageTooLarge');
      return data;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('catalog.imageInvalid');
    }
  }
  private directory(storeId: string, assetKey: string) {
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(assetKey))
      throw new Error('Invalid owned image key');
    return join(this.root, imageBucket(storeId));
  }
  async write(storeId: string, assetKey: string, bytes: Buffer) {
    const directory = this.directory(storeId, assetKey);
    await mkdir(directory, { recursive: true });
    const temporary = join(directory, `${assetKey}-${randomUUID()}.tmp`),
      target = join(directory, `${assetKey}.webp`);
    try {
      await writeFile(temporary, bytes, { flag: 'wx', mode: 0o644 });
      try {
        await link(temporary, target);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      }
    } finally {
      await unlink(temporary).catch(() => undefined);
    }
  }
  async remove(storeId: string, assetKey: string) {
    const directory = this.directory(storeId, assetKey);
    let names: string[];
    try {
      names = await readdir(directory);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
    for (const name of names)
      if (name === `${assetKey}.webp` || (name.startsWith(`${assetKey}-`) && /\.tmp$/.test(name)))
        await unlink(join(directory, name)).catch((error) => {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        });
  }
}
