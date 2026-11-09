import { useEffect, useState } from 'react';
import { Alert, ScrollView, Share, Text, View } from 'react-native';
import { Button, InviteCode, Row, Screen, SubScreenHeader } from '@/components/ui';
import { fetchMembers, useAuth, type Member } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { radius, space, type, useColors } from '@/theme';

// Grupo familiar (from the menu): who is in the household and the code to invite someone.

type Household = { name: string; invite_code: string; members: Member[] };

async function fetchHousehold(householdId: string): Promise<Household> {
  const [household, members] = await Promise.all([
    supabase.from('households').select('name, invite_code').eq('id', householdId).single(),
    fetchMembers(householdId),
  ]);

  if (household.error) throw household.error;

  return { ...household.data, members: members.filter((member) => member.active) };
}

export default function Members() {
  const c = useColors();
  const { session, householdId } = useAuth();
  const [household, setHousehold] = useState<Household | null>(null);
  const me = session?.user.id;

  useEffect(() => {
    if (!householdId) return;

    fetchHousehold(householdId)
      .then(setHousehold)
      .catch((error: Error) => Alert.alert('Error', error.message));
  }, [householdId]);

  return (
    <Screen edges={['bottom']} style={{ padding: 0, gap: 0 }}>
      <SubScreenHeader title="Grupo familiar" />
      {household && (
        <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
          <Text accessibilityRole="header" style={[type.title, { color: c.text }]}>
            {household.name}
          </Text>

          <View style={{ gap: space.sm }}>
            <Text style={[type.caption, { color: c.muted }]}>Integrantes</Text>
            <View style={{ borderRadius: radius.field, overflow: 'hidden' }}>
              {household.members.map((member) => (
                <Row
                  key={member.id}
                  icon={member.name.charAt(0).toUpperCase()}
                  title={member.id === me ? `${member.name} (vos)` : member.name}
                />
              ))}
            </View>
          </View>

          <InviteCode code={household.invite_code}>
            <Button
              title="Compartir código"
              variant="secondary"
              onPress={() =>
                Share.share({
                  message: `Sumate a ${household.name} en Evenly con el código ${household.invite_code}`,
                }).catch((error: Error) => Alert.alert('Error', error.message))
              }
            />
          </InviteCode>
        </ScrollView>
      )}
    </Screen>
  );
}
