import assert from 'node:assert/strict';
import test from 'node:test';
import { productDescription } from '../src/product-description';

const legacyNotice = '商品图片为 AI 生成示意图，餐品以实际出品为准。';

test('legacy image notices do not become product descriptions', () => {
  assert.equal(productDescription(legacyNotice), '');
  assert.equal(productDescription(' 商品图片为AI生成示意图, 餐品以实际出品为准 '), '');
  assert.equal(productDescription(null), '');
});

test('keeps product details when a legacy image notice is present', () => {
  assert.equal(productDescription(`${legacyNotice}\n现炸鸡腿，微辣。`), '现炸鸡腿，微辣。');
  assert.equal(productDescription(`外带可加热。${legacyNotice}含乳制品。`), '外带可加热。含乳制品。');
  assert.equal(productDescription('微辣。配图为包装示意。'), '微辣。配图为包装示意。');
});
