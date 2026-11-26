import Ionicons from '@expo/vector-icons/Ionicons';
import { type PropsWithChildren, type ReactNode } from 'react';
import {
  ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, type TextInputProps,
  View, type StyleProp, type ViewStyle, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const colors = {
  ink: '#201735', muted: '#665C76', soft: '#7C7488', line: '#E7E1ED', canvas: '#F8F6FA',
  white: '#FFFFFF', primary: '#5937B7', primaryDeep: '#342061', lavender: '#F0E9FE',
  lilac: '#DAC8FF', dark: '#2C194D', green: '#176848', greenBg: '#E4F3EB', danger: '#A12946',
  dangerBg: '#FCEBF0', amber: '#85521C', amberBg: '#FFF0DA',
};
export type IconName = keyof typeof Ionicons.glyphMap;
export const Icon = ({ name, size = 22, color = colors.ink }: { name: IconName; size?: number; color?: string }) =>
  <Ionicons name={name} size={size} color={color} accessible={false} aria-hidden />;

export function Button({
  label, icon, onPress, disabled, busy, variant = 'primary', style, accessibilityLabel,
}: {
  label: string; icon?: IconName; onPress: () => void; disabled?: boolean; busy?: boolean; accessibilityLabel?: string;
  variant?: 'primary' | 'secondary' | 'plain' | 'danger'; style?: StyleProp<ViewStyle>;
}) {
  const textColor = variant === 'primary' ? colors.white : variant === 'danger' ? colors.danger : colors.primary;
  return <Pressable
    accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label}
    accessibilityState={{ disabled: !!(disabled || busy), busy: !!busy }}
    onPress={onPress} disabled={disabled || busy}
    style={({ pressed }) => [styles.button, variant === 'primary' && styles.primary,
      variant === 'secondary' && styles.secondary, variant === 'danger' && styles.danger,
      (disabled || busy || pressed) && styles.dimmed, style]}
  >
    {busy ? <ActivityIndicator size="small" color={textColor} /> : icon && <Icon name={icon} size={18} color={textColor} />}
    <Text style={[styles.buttonText, { color: textColor }]}>{label}</Text>
  </Pressable>;
}

export function IconButton({ label, icon, onPress, badge, disabled }: {
  label: string; icon: IconName; onPress: () => void; badge?: number; disabled?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={badge ? `${label}，${badge} 条未读` : label}
    accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.iconButton, (pressed || disabled) && styles.dimmed]}>
    <Icon name={icon} size={22} />
    {!!badge && <View style={styles.dot} />}
  </Pressable>;
}

export function Badge({ label, tone = 'purple' }: { label: string; tone?: 'purple' | 'green' | 'amber' | 'red' }) {
  const palette = {
    purple: [colors.lavender, colors.primary],
    green: [colors.greenBg, colors.green],
    amber: [colors.amberBg, colors.amber],
    red: [colors.dangerBg, colors.danger],
  }[tone];
  return <View style={[styles.badge, { backgroundColor: palette[0] }]}>
    <Text style={[styles.badgeText, { color: palette[1] }]}>{label}</Text>
  </View>;
}

export function Chip({ label, selected = false, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress}
    style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.dimmed]}>
    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
  </Pressable>;
}

export function ChipRow({ children }: PropsWithChildren) {
  return <ScrollView horizontal contentContainerStyle={styles.chipRow} keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false}>
    {children}
  </ScrollView>;
}

export function Field({ label, style, ...props }: TextInputProps & { label: string }) {
  return <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      accessibilityLabel={label} placeholderTextColor={colors.soft}
      selectionColor={colors.primary} autoCapitalize="none"
      {...props} style={[styles.input, props.multiline && styles.multiline, style]}
    />
  </View>;
}

export function Section({ title, accessory, children }: PropsWithChildren<{ title: string; accessory?: ReactNode }>) {
  return <View style={styles.section}>
    <View style={styles.sectionHeading}><Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>{accessory}</View>
    {children}
  </View>;
}

export function Panel({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function ListRow({
  title, detail, value, icon, onPress, trailing, accessibilityLabel,
}: { title: string; detail?: string; value?: string; icon?: IconName; onPress?: () => void; trailing?: ReactNode; accessibilityLabel?: string }) {
  const body = <>
    {icon && <View style={styles.rowIcon}><Icon name={icon} size={20} color={colors.primary} /></View>}
    <View style={styles.rowLabels}>
      <Text style={styles.rowTitle}>{title}</Text>
      {!!detail && <Text style={styles.rowDetail}>{detail}</Text>}
    </View>
    {!!value && <Text style={styles.value}>{value}</Text>}
    {trailing}
    {onPress && <Icon name="chevron-forward" size={16} color={colors.soft} />}
  </>;
  return onPress
    ? <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? [title, detail, value].filter(Boolean).join("，")} onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>{body}</Pressable>
    : <View style={styles.row}>{body}</View>;
}

export function Empty({ title, detail, icon = 'file-tray-outline', action, onAction }:
  { title: string; detail?: string; icon?: IconName; action?: string; onAction?: () => void }) {
  return <View style={styles.empty}>
    <View style={styles.emptyIcon}><Icon name={icon} size={28} color={colors.primary} /></View>
    <Text style={styles.emptyTitle}>{title}</Text>
    {!!detail && <Text style={styles.emptyDetail}>{detail}</Text>}
    {action && onAction && <Button label={action} onPress={onAction} variant="secondary" />}
  </View>;
}

export function Loading({ label = '加载中…' }: { label?: string }) {
  return <View style={styles.loading} accessibilityLabel={label}>
    <ActivityIndicator color={colors.primary} />
    <Text style={styles.rowDetail}>{label}</Text>
  </View>;
}

export function ErrorLine({ message }: { message?: string }) {
  if (!message) return null;
  return <Text accessibilityRole="alert" style={styles.error}>{message}</Text>;
}

export function Page({ children, footer }: PropsWithChildren<{ footer?: ReactNode }>) {
  const { width } = useWindowDimensions();
  return <View style={styles.page}>
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'} contentContainerStyle={[styles.content, width >= 700 && styles.wide]}>
      {children}
    </ScrollView>
    {footer && <View style={styles.footer}>{footer}</View>}
  </View>;
}

export function Sheet({ visible, title, children, onClose, accessory, footer, scroll = true }: PropsWithChildren<{
  visible: boolean; title: string; onClose: () => void; accessory?: ReactNode; footer?: ReactNode; scroll?: boolean;
}>) {
  const { bottom } = useSafeAreaInsets();
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={styles.sheetOverlay}>
      <Pressable accessibilityElementsHidden importantForAccessibility="no" style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: Math.max(18, bottom + 5) }]} accessibilityViewIsModal>
        <View style={styles.sheetHandle} />
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>
          <View style={layout.horizontal}>
            {accessory}
            <IconButton label="关闭" icon="close" onPress={onClose} />
          </View>
        </View>
        {scroll ? <ScrollView style={footer ? styles.sheetScroll : undefined} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetContent}>{children}</ScrollView>
          : <View style={styles.sheetContent}>{children}</View>}
        {footer && <View style={styles.sheetFooter}>{footer}</View>}
      </View>
    </View>
  </Modal>;
}

export const layout = StyleSheet.create({
  stack: { gap: 12 },
  compact: { gap: 8 },
  horizontal: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  split: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  flex: { flex: 1 },
  body: { color: colors.ink, fontSize: 15, lineHeight: 23 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  strong: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  price: { color: colors.primary, fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  heading: { color: colors.ink, fontSize: 29, lineHeight: 39, fontWeight: '800', letterSpacing: -0.7 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  pad: { padding: 17 },
  list: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 28, gap: 10, width: '100%', maxWidth: 700, alignSelf: 'center' },
});

const styles = StyleSheet.create({
  button: { minHeight: 46, borderRadius: 13, paddingHorizontal: 15, paddingVertical: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7 },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.lavender },
  danger: { backgroundColor: colors.dangerBg },
  dimmed: { opacity: 0.62 },
  buttonText: { fontSize: 14, fontWeight: '700' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, borderRadius: 15 },
  dot: { position: 'absolute', right: 8, top: 7, width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: colors.white, backgroundColor: colors.danger },
  badge: { alignSelf: 'flex-start', borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  chip: { minHeight: 44, justifyContent: 'center', borderRadius: 12, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.muted },
  chipTextSelected: { color: colors.white },
  chipRow: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 3 },
  field: { gap: 6 },
  fieldLabel: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  input: { minHeight: 48, paddingHorizontal: 13, paddingVertical: 9, fontSize: 16, color: colors.ink, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 12 },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  section: { gap: 10 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  sectionTitle: { flexShrink: 1, fontSize: 19, fontWeight: '800', color: colors.ink, letterSpacing: -0.25 },
  panel: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 16, overflow: 'hidden' },
  row: { minHeight: 61, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowPressed: { backgroundColor: colors.lavender },
  rowIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center' },
  rowLabels: { flex: 1, gap: 4 },
  rowTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  rowDetail: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  value: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 11, paddingVertical: 34, paddingHorizontal: 21 },
  emptyIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: colors.ink, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  emptyDetail: { color: colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  loading: { minHeight: 150, justifyContent: 'center', alignItems: 'center', gap: 10 },
  error: { color: colors.danger, backgroundColor: colors.dangerBg, fontSize: 13, lineHeight: 20, padding: 11, borderRadius: 10 },
  page: { flex: 1 },
  content: { gap: 18, padding: 18, paddingBottom: 28, width: '100%', alignSelf: 'center' },
  wide: { maxWidth: 700 },
  footer: { paddingHorizontal: 18, paddingVertical: 11, backgroundColor: colors.white, borderTopColor: colors.line, borderTopWidth: 1, width: '100%', maxWidth: 700, alignSelf: 'center' },
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#20173580' },
  sheet: { maxHeight: '85%', backgroundColor: colors.canvas, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 9, width: '100%', maxWidth: 700, alignSelf: 'center' },
  sheetHandle: { width: 34, height: 4, backgroundColor: '#CCC1D8', borderRadius: 4, alignSelf: 'center', marginBottom: 7 },
  sheetContent: { gap: 13, paddingTop: 12, paddingBottom: 4 },
  sheetScroll: { minHeight: 0, flexGrow: 0, flexShrink: 1 },
  sheetFooter: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, marginTop: 8, paddingTop: 10 },
});
