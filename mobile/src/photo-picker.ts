import * as ImagePicker from 'expo-image-picker';

export async function selectPhoto(field: string, maxBytes: number): Promise<FormData | undefined> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.55, allowsEditing: true });
  if (result.canceled) return;
  const photo = result.assets[0];
  if (photo.fileSize && photo.fileSize > maxBytes) throw new Error(`图片过大，最大支持 ${Math.round(maxBytes / 1024)} KB。`);
  const form = new FormData();
  const name = photo.fileName ?? (photo.mimeType === 'image/png' ? 'image.png' : 'image.jpg');
  if (photo.file) form.append(field, photo.file);
  else form.append(field, { uri: photo.uri, name, type: photo.mimeType ?? 'image/jpeg' } as unknown as Blob);
  return form;
}
