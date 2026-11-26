import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { colors, Icon } from './ui';

export function ProductPhoto({ uri, style }: { uri?: string; style: object }) {
  return uri ? <Image source={uri} style={style} contentFit="cover" cachePolicy="memory-disk" transition={140} />
    : <View style={[style, styles.placeholder]}><Icon name="restaurant-outline" color={colors.primary} size={27} /></View>;
}

const styles = StyleSheet.create({
  placeholder: { backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center' },
});
