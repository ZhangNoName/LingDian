import { Text, View } from 'react-native';
import { maxCartQuantity } from './cart-state';
import { IconButton, layout } from './ui';

export function Quantity({ quantity, onChange, min = 0, name }: {
  quantity: number; onChange: (value: number) => void; min?: number; name?: string;
}) {
  const decrease = quantity === 1 && min === 0 ? '移除商品' : '减少数量';
  return <View style={layout.horizontal}>
    <IconButton label={name ? `${decrease}，${name}` : decrease} icon="remove" disabled={quantity <= min}
      onPress={() => onChange(quantity - 1)} />
    <Text style={layout.strong}>{quantity}</Text>
    <IconButton label={name ? `增加数量，${name}` : '增加数量'} icon="add" disabled={quantity >= maxCartQuantity}
      onPress={() => onChange(quantity + 1)} />
  </View>;
}
