import { useLocale } from '@/i18n/locale'
const zh = {
  title: '商品图片',
  hint: '支持 JPEG、PNG 或 WebP，最大 3 MB；保存时转成适合菜单展示的 WebP。',
  current: '当前商品图片',
  preview: '待上传图片预览',
  choose: '选择图片',
  replace: '选择后上传并保存',
  upload: '上传并保存',
  saving: '正在保存图片…',
  cancel: '取消选择',
  remove: '移除商品图片',
  removeHint: '确认从当前商品移除图片。历史图片记录保留，不改动价格、规格、配方或库存。',
  confirm: '确认移除',
  keep: '保留图片',
  empty: '尚未设置商品图片',
  unavailable: '图片无法读取',
  selected: '待上传',
  size: '文件大小',
  version: '商品版本缺失，请更新服务后重新读取。',
  disabled: '请先保存或放弃其他分区的修改，再维护图片。',
  saved: '商品图片已更新',
  imageRequired: '请选择图片。',
  imageTooLarge: '图片不能超过 3 MB。',
  imageType: '请选择静态 JPEG、PNG 或 WebP 图片，文件内容须与类型一致。',
  imageInvalid: '图片无法解码或超过像素上限，请换一张图片。',
  imageStorageFailed: '图片未能保存，请重新读取商品并重新选择图片。',
  imageRequestConflict: '本次图片请求内容已变化，请先重新读取商品再选择图片。',
  imageRequestClosed: '本次上传已失效，请重新读取商品并重新选择图片。',
  stale: '商品已被其他操作修改，当前选择已保留；请重新读取并核对后再上传。',
  productUnavailable: '当前门店找不到该商品。',
  saveFailed: '保存未确认，请保留同一图片重试，或重新读取商品核对。',
  reload: '重新读取商品',
  reloadHint: '重新读取将放弃当前选择；如上一请求已保存，页面会显示最新商品图片。',
  confirmReload: '放弃选择并重新读取',
  back: '继续编辑',
} as const
export type ImageKey = keyof typeof zh
const en: Record<ImageKey, string> = {
  title: 'Product image',
  hint: 'JPEG, PNG or WebP, up to 3 MB. Saved images are optimized as WebP for the menu.',
  current: 'Current product image',
  preview: 'Selected image preview',
  choose: 'Choose image',
  replace: 'Select an image, then upload and save',
  upload: 'Upload and save',
  saving: 'Saving image…',
  cancel: 'Clear selection',
  remove: 'Remove product image',
  removeHint:
    'Remove the image from this product. Historical image records are retained. Prices, variants, recipes and stock stay unchanged.',
  confirm: 'Confirm removal',
  keep: 'Keep image',
  empty: 'No product image yet',
  unavailable: 'Image could not be loaded',
  selected: 'Selected file',
  size: 'File size',
  version: 'Product version is missing. Update the service and reload.',
  disabled: 'Save or discard changes in other sections before managing the image.',
  saved: 'Product image updated',
  imageRequired: 'Choose an image.',
  imageTooLarge: 'The image must be 3 MB or smaller.',
  imageType: 'Choose a static JPEG, PNG or WebP whose contents match its file type.',
  imageInvalid: 'This image cannot be decoded or exceeds the pixel limit. Choose another image.',
  imageStorageFailed: 'The image could not be stored. Reload the product and select the image again.',
  imageRequestConflict: 'The image request details have changed. Reload the product before selecting an image.',
  imageRequestClosed: 'This upload request has expired. Reload the product and select the image again.',
  stale:
    'Another operation changed this product. Your selection is retained. Reload and compare before uploading again.',
  productUnavailable: 'This product is unavailable in the selected store.',
  saveFailed: 'Save was not confirmed. Retry with the same image, or reload to check the product.',
  reload: 'Reload product',
  reloadHint:
    'Reloading discards your current selection. If the previous request was saved, the latest product image will be shown.',
  confirmReload: 'Discard selection and reload',
  back: 'Keep editing',
}
export function useImageLocale() {
  const { locale } = useLocale()
  return { t: (key: ImageKey) => (locale.value === 'en-US' ? en : zh)[key] }
}
export function imageError(error: unknown): ImageKey {
  const code = error instanceof Error ? error.message.replace(/^catalog\./, '') : ''
  return Object.hasOwn(zh, code) ? (code as ImageKey) : 'saveFailed'
}
