import { useLocale } from '@/i18n/locale'
const zh = {
  title: '商品图片',
  hint: '可拖入 JPEG、PNG 或 WebP，最大 3 MB',
  current: '当前商品图片',
  preview: '待上传图片预览',
  choose: '选择图片',
  replace: '更换图片',
  cancel: '取消选择',
  remove: '移除商品图片',
  pendingRemoval: '保存后移除图片',
  keep: '撤销移除',
  empty: '尚未设置商品图片',
  unavailable: '图片无法读取',
  imageRequired: '请选择图片。',
  imageTooLarge: '图片不能超过 3 MB。',
  imageType: '请选择静态 JPEG、PNG 或 WebP 图片，文件内容须与类型一致。',
  imageInvalid: '图片无法解码或超过像素上限，请换一张图片。',
  imageStorageFailed: '图片未能保存，请重新选择图片后重试。',
  imageRequestConflict: '本次上传内容已变化，请重新选择图片后重试。',
  imageRequestClosed: '本次上传已失效，请重新选择图片。',
  productUnavailable: '当前门店找不到该商品。',
  saveFailed: '图片保存未确认。请保留当前选择，再点一次「保存修改」。',
} as const
export type ImageKey = keyof typeof zh
const en: Record<ImageKey, string> = {
  title: 'Product image',
  hint: 'Drop a JPEG, PNG or WebP image, up to 3 MB',
  current: 'Current product image',
  preview: 'Selected image preview',
  choose: 'Choose image',
  replace: 'Replace image',
  cancel: 'Clear selection',
  remove: 'Remove product image',
  pendingRemoval: 'Image will be removed when you save',
  keep: 'Undo removal',
  empty: 'No product image yet',
  unavailable: 'Image could not be loaded',
  imageRequired: 'Choose an image.',
  imageTooLarge: 'The image must be 3 MB or smaller.',
  imageType: 'Choose a static JPEG, PNG or WebP whose contents match its file type.',
  imageInvalid: 'This image cannot be decoded or exceeds the pixel limit. Choose another image.',
  imageStorageFailed: 'The image could not be stored. Select an image again and retry.',
  imageRequestConflict: 'The upload details changed. Select an image again and retry.',
  imageRequestClosed: 'This upload expired. Select an image again.',
  productUnavailable: 'This product is unavailable in the selected store.',
  saveFailed: 'Image save was not confirmed. Keep the selection and select Save changes again.',
}
export function useImageLocale() {
  const { locale } = useLocale()
  return { t: (key: ImageKey) => (locale.value === 'en-US' ? en : zh)[key] }
}
export function imageError(error: unknown): ImageKey {
  const code = error instanceof Error ? error.message.replace(/^catalog\./, '') : ''
  return Object.hasOwn(zh, code) ? (code as ImageKey) : 'saveFailed'
}
