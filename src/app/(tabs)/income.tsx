import { useFocusEffect } from 'expo-router';
import { File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, Switch, Text, View } from 'react-native';
import {
  Button,
  Input,
  Money,
  MonthSelector,
  Row,
  Screen,
  RateCard,
  Sheet,
  TotalFooter,
} from '@/components/ui';
import { groupThousands, monthKey, monthLabel, parseWholeNumber } from '@/lib/fixed';
import {
  formatIncomeSheet,
  incomeTotals,
  isIncome,
  newIncomeId,
  parseIncomeSheet,
  type Currency,
  type Income,
} from '@/lib/income';
import { formatDollars } from '@/lib/money';
import { useShowUsd } from '@/lib/show-usd';
import { supabase } from '@/lib/supabase';
import { radius, space, type, useColors } from '@/theme';

// Ingresos (ARCHITECTURE.md § Income): only on this phone, never in Supabase. The only thing read
// from the server is the month's reference rate, to convert dollars.

const storageKey = 'incomes';

// ponytail: the whole list in one SecureStore value, rewritten on every change; fine for a few
// incomes a month for years. Move to expo-sqlite if it ever grows to thousands.
async function loadIncomes(): Promise<Income[]> {
  const stored = await SecureStore.getItemAsync(storageKey);

  if (stored === null) return [];

  // Never treat unreadable data as empty: the next save would erase it.
  const unreadable = new Error('Los ingresos guardados no se pueden leer.');
  let list: unknown;

  try {
    list = JSON.parse(stored);
  } catch {
    throw unreadable;
  }

  // Every item checked: one bad item refuses the list, so a save can't drop it.
  if (!Array.isArray(list) || !list.every(isIncome)) throw unreadable;

  return list;
}

async function saveIncomes(list: Income[]): Promise<void> {
  await SecureStore.setItemAsync(storageKey, JSON.stringify(list));
}

type Draft = { id: string | null; concept: string; amount: string; currency: Currency };

export default function IncomeScreen() {
  const c = useColors();
  const showUsd = useShowUsd();

  const [month, setMonth] = useState(() => {
    const now = new Date();

    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const key = monthKey(month);
  // `null` until read, and if the read failed: nothing can be saved over data we couldn't read.
  const [incomes, setIncomes] = useState<Income[] | null>(null);
  const [rate, setRate] = useState<{ key: string; value: number | null } | null>(null);
  const [inUsd, setInUsd] = useState(false);
  const [sheet, setSheet] = useState<'income' | null>(null);
  const [draft, setDraft] = useState<Draft>({ id: null, concept: '', amount: '', currency: 'ARS' });
  // The month on screen, for a rate that arrives after the user moved to another one.
  const shownKey = useRef(key);
  // State updates land on the next render; the ref stops a double tap from writing twice.
  const writing = useRef(false);

  useEffect(() => {
    loadIncomes()
      .then(setIncomes)
      .catch((error: Error) => Alert.alert('Error', error.message));
  }, []);

  // On focus too: the rate is edited in Fijos.
  useFocusEffect(
    useCallback(() => {
      supabase
        .from('reference_rates')
        .select('ars_per_usd')
        .eq('month', key)
        .maybeSingle()
        // No alert on failure (offline): the incomes are local and work without it; dollars just
        // stay unconverted until a later focus reads the rate.
        // A failure still settles the month (without a rate), so the screen doesn't wait on it.
        .then(({ data, error }) => {
          if (key === shownKey.current) {
            setRate({ key, value: error ? null : (data?.ars_per_usd ?? null) });
          }
        });
    }, [key]),
  );

  /** Saves, then shows it; `true` if it worked. A write while another runs is dropped. */
  async function store(next: Income[]): Promise<boolean> {
    if (writing.current) return false;

    writing.current = true;

    const saved = await saveIncomes(next).then(
      () => true,
      (error: Error) => {
        Alert.alert('Error', error.message);

        return false;
      },
    );

    writing.current = false;

    if (saved) setIncomes(next);

    return saved;
  }

  const monthIncomes = (incomes ?? [])
    .filter((income) => income.month === key)
    .sort((a, b) => a.concept.localeCompare(b.concept, 'es'));

  // The month's rate request settled (with or without a rate). Until then the rows and total wait,
  // so dollar incomes don't flash as unconverted.
  // ponytail: no timeout of its own; a hanging request keeps the month blank until it fails.
  const rateReady = rate?.key === key;
  const monthRate = rateReady ? rate.value : null;
  const totals = incomeTotals(monthIncomes, monthRate);
  // The rate as displayed: hidden with dollars off, and on an empty month (it reads as a field to
  // fill). Conversions still use `monthRate`.
  const shownRate = showUsd && monthIncomes.length > 0 ? monthRate : null;
  // `ARS | USD` on USD, with a rate to show: everything in dollars.
  const usdRate = inUsd ? shownRate : null;
  const parsed = parseWholeNumber(draft.amount);

  function openIncome(income: Income | null) {
    setDraft(
      income
        ? {
            id: income.id,
            concept: income.concept,
            amount: groupThousands(String(income.amount)),
            currency: income.currency,
          }
        : { id: null, concept: '', amount: '', currency: 'ARS' },
    );
    setSheet('income');
  }

  async function saveDraft() {
    if (!incomes || !parsed) return;

    const income: Income = {
      id: draft.id ?? newIncomeId(),
      month: key,
      concept: draft.concept.trim(),
      amount: parsed,
      currency: draft.currency,
    };

    const next = draft.id
      ? incomes.map((item) => (item.id === draft.id ? income : item))
      : [...incomes, income];

    if (await store(next)) setSheet(null);
  }

  function deleteDraft() {
    Alert.alert('¿Eliminar este ingreso?', undefined, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          if (incomes && (await store(incomes.filter((item) => item.id !== draft.id)))) {
            setSheet(null);
          }
        },
      },
    ]);
  }

  /** Importar: a file from the phone (an export, or the spreadsheet's rows saved as text). */
  async function importFile() {
    if (!incomes) return;

    let imported: Income[];

    try {
      const picked = await File.pickFileAsync();

      if (picked.canceled) return;

      imported = parseIncomeSheet(await picked.result.text());
    } catch (error) {
      // SAFETY: the picker and parseIncomeSheet throw Error; the parser's message is Spanish.
      Alert.alert('No se pudo importar', (error as Error).message);

      return;
    }

    if (imported.length === 0) {
      Alert.alert('No se pudo importar', 'El archivo no tiene ingresos.');

      return;
    }

    const months = new Set(imported.map((income) => income.month));

    // Replacing whole months makes a second import of the same file a no-op, not a duplicate.
    Alert.alert(
      'Importar',
      `Se importan ${imported.length} ingresos de ${months.size} meses. Reemplaza los de esos meses. Quedan solo en este teléfono.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Importar',
          onPress: () => {
            store([...incomes.filter((income) => !months.has(income.month)), ...imported]);
          },
        },
      ],
    );
  }

  /** Exportar: every income to `ingresos.txt`, handed to Android's share sheet (Drive, WhatsApp…). */
  async function exportFile() {
    if (!incomes) return;

    try {
      const file = new File(Paths.cache, 'ingresos.txt');

      file.create({ overwrite: true });
      await file.write(formatIncomeSheet(incomes));
      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/plain',
        dialogTitle: 'Exportar ingresos',
      });
    } catch (error) {
      // SAFETY: expo-file-system and expo-sharing reject with Error.
      Alert.alert('No se pudo exportar', (error as Error).message);
    }
  }

  function rightOf(income: Income) {
    if (income.currency === 'ARS') return <Money amount={income.amount} usdRate={usdRate} />;

    // Dollars shown as dollars when viewing in USD or when the month has no rate to convert them.
    if (usdRate || !monthRate) {
      return <Text style={[type.body, { color: c.text }]}>{formatDollars(income.amount)}</Text>;
    }

    return <Money amount={income.amount * monthRate} />;
  }

  const muted = [type.label, { color: c.muted, fontWeight: '400' as const }];

  return (
    <Screen edges={[]} style={{ padding: 0, gap: 0 }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md }}>
        <MonthSelector
          month={month}
          onChange={(next) => {
            shownKey.current = monthKey(next);
            setMonth(next);
          }}
        />

        {rateReady && showUsd && monthIncomes.length > 0 && (
          <RateCard
            rate={monthRate}
            usd={inUsd}
            onUsdChange={setInUsd}
            hint="Cargalo en Fijos para convertir los dólares."
          />
        )}

        {rateReady && monthIncomes.length > 0 && (
          <View style={{ borderRadius: radius.field, overflow: 'hidden' }}>
            {monthIncomes.map((income) => (
              <Row
                key={income.id}
                title={income.concept}
                // The dollars it came in, when the right side shows them converted.
                detail={
                  income.currency === 'USD' && monthRate && !usdRate
                    ? formatDollars(income.amount)
                    : undefined
                }
                onPress={() => openIncome(income)}
                right={rightOf(income)}
              />
            ))}
          </View>
        )}

        <Button
          title="Agregar ingreso"
          disabled={incomes === null}
          onPress={() => openIncome(null)}
        />

        <Text style={muted}>
          Se guarda solo en este teléfono. No se sube a la nube ni lo ve tu grupo familiar. Usá
          Exportar antes de cambiar de celular.
          {monthIncomes.length === 0
            ? ' Si desinstalás la app o cambiás de celular, se pierde.'
            : ''}
        </Text>

        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Button
              title="Importar"
              variant="secondary"
              disabled={incomes === null}
              onPress={importFile}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title="Exportar"
              variant="secondary"
              disabled={!incomes?.length}
              onPress={exportFile}
            />
          </View>
        </View>
      </ScrollView>

      {rateReady && (
        <TotalFooter total={totals.ars} rate={shownRate} usd={inUsd}>
          {totals.unconverted > 0 && (
            <Text style={muted}>+ {formatDollars(totals.unconverted)} sin convertir</Text>
          )}
        </TotalFooter>
      )}

      <Sheet
        visible={sheet === 'income'}
        onClose={() => setSheet(null)}
        title={draft.id ? 'Editar ingreso' : 'Nuevo ingreso'}
        subtitle={monthLabel(month)}
      >
        <Input
          label="Concepto"
          placeholder="Ej.: Sueldo"
          value={draft.concept}
          onChangeText={(concept) => setDraft({ ...draft, concept })}
          autoFocus={!draft.id}
        />
        <Input
          label="Monto"
          value={draft.amount}
          onChangeText={(next) => setDraft({ ...draft, amount: groupThousands(next) })}
          keyboardType="number-pad"
          style={[type.title, { fontVariant: ['tabular-nums'] }]}
        />
        {/* Hidden with dollars off, unless this income already is in dollars. */}
        {(showUsd || draft.currency === 'USD') && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Text style={[type.body, { flex: 1, color: c.text }]}>En dólares</Text>
            <Switch
              accessibilityLabel="En dólares"
              value={draft.currency === 'USD'}
              trackColor={{ true: c.accent, false: c.line }}
              thumbColor={c.surface}
              onValueChange={(usd) => setDraft({ ...draft, currency: usd ? 'USD' : 'ARS' })}
            />
          </View>
        )}
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {draft.id && (
            <View style={{ flex: 1 }}>
              <Button title="Eliminar" variant="danger" onPress={deleteDraft} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Button
              title="Guardar"
              disabled={!draft.concept.trim() || !parsed}
              onPress={saveDraft}
            />
          </View>
        </View>
      </Sheet>
    </Screen>
  );
}
