import { Text } from 'react-native';
import { Screen } from '@/components/ui';
import { type, useColors } from '@/theme';

// Placeholder until T5 builds the screen.
export default function Shared() {
  const c = useColors();

  return (
    <Screen edges={[]}>
      <Text style={[type.body, { color: c.muted }]}>Compartidos</Text>
    </Screen>
  );
}
