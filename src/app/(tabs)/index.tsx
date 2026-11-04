import { useState } from 'react';
import { Text, View } from 'react-native';
import { Money, MonthSelector, Row, Screen } from '@/components/ui';
import { radius, type, useColors } from '@/theme';

// Placeholder until T4 builds the screen: shows the base components so a dev build can check
// them in both system themes.
export default function Fixed() {
  const c = useColors();

  const [month, setMonth] = useState(() => {
    const now = new Date();

    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  return (
    <Screen edges={[]}>
      <MonthSelector month={month} onChange={setMonth} />
      <View style={{ borderRadius: radius.field, overflow: 'hidden' }}>
        <Row
          icon="🚗"
          title="Auto"
          right={<Money amount={180000} style={{ fontWeight: '500' }} />}
        />
        <Row
          icon="P"
          title="Prepaga"
          detail="Compartido"
          right={<Text style={[type.label, { color: c.warn }]}>Pendiente</Text>}
        />
      </View>
    </Screen>
  );
}
