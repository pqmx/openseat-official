import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { PinIcon } from '../components/icons';
import { Body, Field, Footer, PrimaryButton, StatusStrip } from '../components/ui';
import { WizardBar } from '../components/wizard-bar';
import { resolvePlace, searchPlaces, type PlaceHit, type PlaceSuggestion } from '../api';
import { font, type, useTheme } from '../theme';

/** One suggestion under the location field. */
const PlaceRow = ({
  title,
  sub,
  last,
  selected,
  onPress,
}: {
  title: string;
  sub: string;
  last?: boolean;
  selected?: boolean;
  onPress?: () => void;
}) => {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 10,
        paddingVertical: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: c.hairFaint,
      }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: font.medium, fontSize: 14, color: selected ? c.coral : c.ink }}>
          {title}
        </Text>
        <Text
          numberOfLines={1}
          style={{ fontFamily: font.regular, fontSize: 12, color: c.mute, marginTop: 2 }}>
          {sub}
        </Text>
      </View>
    </Pressable>
  );
};

/** A Places billing session token. Both predictions and details may be billable. */
const newSession = () =>
  '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (ch) =>
    (+ch ^ (Math.floor(Math.random() * 256) & (15 >> (+ch / 4)))).toString(16),
  );

/** Create, step 1 — what and where. */
export function CreateStep1() {
  const { c } = useTheme();
  const [title, setTitle] = useState('');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<PlaceSuggestion[]>([]);
  const [searchFailed, setSearchFailed] = useState<string>();
  // Keep resolved coordinates with the selected suggestion.
  const [place, setPlace] = useState<PlaceHit & { id: string }>();
  const selection = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => selection.current?.abort(), []);
  const [picking, setPicking] = useState<string>();
  // Rotating the billing session must not trigger another prediction request.
  const [initialSession] = useState(newSession);
  const session = useRef(initialSession);

  // Debounce predictions and discard superseded responses.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setSearchFailed(undefined);
      return;
    }
    const ctl = new AbortController();
    const id = setTimeout(async () => {
      try {
        const results = await searchPlaces(q, session.current, ctl.signal);
        if (ctl.signal.aborted) return;
        setHits(results);
        setSearchFailed(undefined);
      } catch {
        if (ctl.signal.aborted) return;
        setSearchFailed('Place search failed.');
      }
    }, 150);
    return () => {
      clearTimeout(id);
      ctl.abort();
    };
  }, [query]);

  // Resolve only the latest selection; each details attempt consumes its search session.
  const pick = async (s: PlaceSuggestion) => {
    selection.current?.abort();
    const ctl = new AbortController();
    selection.current = ctl;
    const token = session.current;
    session.current = newSession();
    setPlace(undefined);
    setPicking(s.id);
    try {
      const { lat, lng } = await resolvePlace(s.id, token, ctl.signal);
      if (ctl.signal.aborted) return;
      setPlace({ id: s.id, title: s.title, sub: s.sub, lat, lng });
      setSearchFailed(undefined);
    } catch {
      if (ctl.signal.aborted) return;
      setSearchFailed('Could not pin that place.');
    } finally {
      if (!ctl.signal.aborted) setPicking(undefined);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <StatusStrip />
      <WizardBar left="Cancel" step="STEP 1 / 2" onLeft={() => router.back()} />
      <Body keyboardAware contentStyle={{ paddingHorizontal: 22, paddingBottom: 24, gap: 26 }}>
        <Text style={[type.display, { color: c.ink }]}>
          Open a seat.{'\n'}What's happening?
        </Text>

        <View style={{ gap: 8 }}>
          <Field label="TITLE" focused>
            <TextInput
              testID="create-title"
              value={title}
              onChangeText={(t) => setTitle(t.slice(0, 60))}
              placeholder="What's happening?"
              placeholderTextColor={c.faint}
              selectionColor={c.coral}
              style={[type.cardTitle, { color: c.ink, padding: 0 }]}
            />
          </Field>
          <Text style={{ fontFamily: font.regular, fontSize: 11, color: c.faint, alignSelf: 'flex-end' }}>
            {title.length} / 60
          </Text>
        </View>

        <View style={{ gap: 8 }}>
          <Field label="LOCATION" focused>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
              <PinIcon color={c.mute2} />
              <TextInput
                testID="create-location"
                value={query}
                onChangeText={(text) => {
                  selection.current?.abort();
                  setPicking(undefined);
                  setPlace(undefined);
                  setHits([]);
                  setQuery(text);
                }}
                maxLength={200}
                placeholder="Where?"
                placeholderTextColor={c.faint}
                selectionColor={c.coral}
                style={{ flex: 1, fontFamily: font.regular, fontSize: 15, color: c.ink, padding: 0 }}
              />
            </View>
          </Field>
          <View>
            {searchFailed ? (
              <Text style={{ fontFamily: font.regular, fontSize: 12.5, color: c.coral }}>
                {searchFailed}
              </Text>
            ) : (
              hits.map((p, i) => (
                <PlaceRow
                  key={p.id}
                  title={p.title}
                  sub={picking === p.id ? 'Pinning…' : p.sub}
                  last={i === hits.length - 1}
                  selected={p.id === place?.id}
                  onPress={() => pick(p)}
                />
              ))
            )}
          </View>
        </View>
      </Body>

      <Footer>
        <Text
          style={{ fontFamily: font.regular, fontSize: 12, color: c.mute2, lineHeight: 12 * 1.4 }}>
          Nothing posts{'\n'}until step 2
        </Text>
        <PrimaryButton
          label="Next: when & who"
          height={44}
          disabled={!place || !title.trim() || !!picking}
          onPress={() =>
            place &&
            router.push({
              pathname: '/create/details',
              params: { title: title.trim(), place: place.title, lat: place.lat, lng: place.lng },
            })
          }
          style={{ flex: 1 }}
        />
      </Footer>
    </View>
  );
}
