import { useMutation } from '@tanstack/react-query';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { humanError } from './api';
import { Button, ErrorLine } from './ui';

import { asCsv, type CsvCell } from './format';

async function shareCsv(name: string, rows: CsvCell[][]) {
  const csv = asCsv(rows);
  const filename = `${name}.csv`;
  if (Platform.OS === 'web') {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
    return;
  }
  if (!await Sharing.isAvailableAsync()) throw new Error('当前设备不支持共享文件。');
  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true });
  try {
    file.write(csv);
    await Sharing.shareAsync(file.uri, { dialogTitle: '导出 CSV', mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
  } finally {
    if (file.exists) file.delete();
  }
}

export function ExportCsv({ name, rows, label = '导出完整报表' }: { name: string; rows: () => CsvCell[][]; label?: string }) {
  const save = useMutation({ mutationFn: () => shareCsv(name, rows()) });
  return <>
    <Button label={label} variant="secondary" icon="download-outline" busy={save.isPending} onPress={() => save.mutate()} />
    <ErrorLine message={save.error ? humanError(save.error) : undefined} />
  </>;
}
