import { useInfiniteQuery, useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FlatList, Switch, Text, View } from 'react-native';
import { ApiError, endpoint, humanError, request, type RequestOptions } from './api';
import { useApi, useScreenActive, useWorkspace } from './context';
import { dateInChina, type DateRange } from './format';
import { Button, Chip, ChipRow, colors, Empty, ErrorLine, Field, layout, ListRow, Loading, Page, Panel, Section, Sheet } from './ui';

export type PageResult<T> = { items: T[]; total: number; page: number; pageSize?: number; page_size?: number };

export function PagedList<T>({ path, title, filters, searchable, publicRead, controls, add, recordKey, render }: {
  path: string; title?: string; filters?: Record<string, string | number | undefined>; searchable?: boolean;
  publicRead?: boolean; controls?: ReactNode; add?: () => void; recordKey: (item: T) => string; render: (item: T) => ReactNode;
}) {
  const api = useApi();
  const active = useScreenActive();
  const [search, setSearch] = useState('');
  const [keyword, setKeyword] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setKeyword(search.trim()), 280);
    return () => clearTimeout(timer);
  }, [search]);
  const query = useInfiniteQuery({
    queryKey: [publicRead ? 'public' : api.key, path, filters, keyword],
    subscribed: active,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => (publicRead ? request : api.call)<PageResult<T>>(
      endpoint(path, { page: pageParam, pageSize: 20, ...filters, keyword: keyword || undefined }), { signal }),
    getNextPageParam: (last) => last.page * (last.pageSize ?? last.page_size ?? 20) < last.total ? last.page + 1 : undefined,
  });
  const items = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data?.pages]);
  return <FlatList data={items} keyExtractor={recordKey}
    contentContainerStyle={layout.list} initialNumToRender={8} windowSize={7}
    keyboardShouldPersistTaps="handled" refreshing={query.isRefetching && !query.isFetchingNextPage} onRefresh={() => { if (active) void query.refetch(); }}
    onEndReachedThreshold={0.35} onEndReached={() => { if (active && query.hasNextPage && !query.isFetching) void query.fetchNextPage(); }}
    ListHeaderComponent={<View style={layout.stack}>
      {(title || add) && <View style={layout.split}>
        {title && <Text style={[layout.heading, layout.flex]}>{title}</Text>}
        {add && <Button label="新增" icon="add" onPress={add} />}
      </View>}
      {searchable && <Field label="搜索" value={search} onChangeText={setSearch} placeholder="输入关键词" maxLength={120} />}
      {controls}
      <ErrorLine message={query.isRefetchError ? '刷新失败，当前显示上次加载的数据。' : undefined} />
    </View>}
    renderItem={({ item }) => <Panel>{render(item)}</Panel>}
    ListEmptyComponent={query.isPending ? <Loading /> : query.isError
      ? <Empty title="暂时无法加载" detail={humanError(query.error)} action="重试" onAction={() => void query.refetch()} />
      : <Empty title="没有符合条件的记录" />}
    ListFooterComponent={query.isFetchingNextPage ? <Loading label="加载更多…" /> : query.isFetchNextPageError
      ? <Button label="重新加载更多" variant="secondary" onPress={() => void query.fetchNextPage()} /> : null} />;
}

export function Options({ values, value, onChange }: { values: Array<[string, string]>; value: string; onChange: (value: string) => void }) {
  return <ChipRow>{values.map(([key, label]) => <Chip key={key} label={label} selected={value === key} onPress={() => onChange(key)} />)}</ChipRow>;
}

export function Toggle({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <View style={layout.split}>
    <Text style={[layout.strong, layout.flex]}>{label}</Text>
    <Switch accessibilityLabel={label} value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: colors.primary }} />
  </View>;
}

export { dateInChina, period, startDate } from './format';

export function DateFields({ range, onChange }: { range: DateRange; onChange: (value: DateRange) => void }) {
  const now = Date.now();
  return <View style={layout.stack}>
    <ChipRow>{([[1, '今天'], [7, '近 7 天'], [30, '近 30 天']] as const).map(([days, label]) => {
      const preset = { from: dateInChina(1 - days, now), to: dateInChina(0, now) };
      return <Chip key={days} label={label} selected={range.from === preset.from && range.to === preset.to} onPress={() => onChange(preset)} />;
    })}</ChipRow>
    <Field label="开始日期" value={range.from} onChangeText={(from) => onChange({ ...range, from })} placeholder="YYYY-MM-DD" maxLength={10} />
    <Field label="结束日期" value={range.to} onChangeText={(to) => onChange({ ...range, to })} placeholder="YYYY-MM-DD" maxLength={10} />
  </View>;
}

type PickOption = { id: string; label: string; detail?: string; disabled?: boolean };
export function Picker<T>({ label, path, selected, onSelect, map, filters, multiple, searchable = true }: {
  label: string; path: string; selected: PickOption[]; onSelect: (value: PickOption[]) => void; map: (record: T) => PickOption;
  filters?: Record<string, string | number | undefined>; multiple?: boolean; searchable?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return <>
    <Panel><ListRow title={label} detail={selected.map((option) => option.label).join('、') || '请选择'} onPress={() => setVisible(true)} /></Panel>
    <Sheet visible={visible} title={label} scroll={false} onClose={() => setVisible(false)}>
      {visible && <View style={{ height: 360, maxHeight: "70%" }}>
        <PagedList<T> path={path} searchable={searchable} filters={filters}
          recordKey={(item) => map(item).id} render={(item) => {
            const option = map(item);
            const active = selected.some(({ id }) => id === option.id);
            return <ListRow title={option.label} detail={option.detail} icon={active ? 'checkmark-circle' : 'ellipse-outline'}
              onPress={option.disabled ? undefined : () => {
                onSelect(multiple ? active ? selected.filter(({ id }) => id !== option.id) : [...selected, option] : [option]);
                if (!multiple) setVisible(false);
              }} />;
          }} />
      </View>}
      {multiple && <Button label="完成选择" onPress={() => setVisible(false)} />}
    </Sheet>
  </>;
}

export function Save({ title, label = '保存', path, method, build, disabled, invalidateAlso, onSuccess, children }: {
  title: string; label?: string; path: string; method: RequestOptions['method']; build: () => object | undefined;
  disabled?: boolean; invalidateAlso?: QueryKey; onSuccess?: (data: unknown) => void; children: ReactNode;
}) {
  const api = useApi();
  const { back, show, isCurrent } = useWorkspace();
  const client = useQueryClient();
  const submitting = useRef(false);
  const save = useMutation({
    mutationFn: () => api.call(path, { method, body: build() }),
    onSuccess: (data) => {
      void client.invalidateQueries({ queryKey: [api.key] });
      if (invalidateAlso) void client.invalidateQueries({ queryKey: invalidateAlso });
      if (!isCurrent()) return;
      show('操作已完成');
      if (onSuccess) onSuccess(data);
      else back();
    },
    onSettled: () => { submitting.current = false; },
  });
  const conflict = save.error instanceof ApiError && save.error.status === 409;
  return <Page footer={<Button label={label} disabled={disabled} busy={save.isPending} onPress={() => {
    if (!submitting.current) { submitting.current = true; save.mutate(); }
  }} />}>
    <Section title={title}>{children}</Section>
    <ErrorLine message={save.error ? humanError(save.error) : undefined} />
    {conflict && <Button label="返回并刷新记录" variant="secondary" onPress={() => {
      void client.invalidateQueries({ queryKey: [api.key] });
      back();
    }} />}
  </Page>;
}

export function DataState({ pending, error, reload }: { pending: boolean; error: unknown; reload: () => void }) {
  return pending ? <Loading /> : <Empty title="暂时无法加载" detail={humanError(error)} action="重试" onAction={reload} />;
}
