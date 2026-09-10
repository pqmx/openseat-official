import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { LockIcon, PeelCorner, PinIcon } from '../components/icons';
import {
  Body,
  Chip,
  Eyebrow,
  Field,
  Footer,
  PrimaryButton,
  StatusLine,
  StatusStrip,
  TextButton,
  Toggle,
  YearChip,
} from '../components/ui';
import { router } from 'expo-router';
import {
  createRoom,
  resolvePlace,
  searchPlaces,
  useNow,
  type PlaceHit,
  type PlaceSuggestion,
} from '../api';
import { tapFail, tapOk } from '../feedback';
import { classYears, yearsForHost } from '../data';
import { clock } from '../time';
import { em, font, radius, type, useTheme } from '../theme';
import { errorMessage } from '../errors';
import { ROOM_DURATION_HOURS } from '../room-rules';
import * as Sentry from '@sentry/react-native';

/** Cancel / Back, and the STEP n / 2 counter — the bar on both create steps. */
const WizardBar = ({
  left,
  step,
  onLeft,
}: {
  left: string;
  step: string;
  onLeft: () => void;
}) => {
  const { c } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 2,
        paddingHorizontal: 22,
        paddingBottom: 18,
      }}>
      <TextButton
        label={left}
        onPress={onLeft}
        style={{ fontFamily: font.regular, fontSize: 13.5, color: c.mute }}
      />
      <Eyebrow>{step}</Eyebrow>
    </View>
  );
};

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
  // The picked place is the whole hit, not its name: step 2 needs the
  // coordinates, and a title alone is what used to put every room at the centre
  // of campus.
  const [place, setPlace] = useState<PlaceHit & { id: string }>();
  const selection = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => selection.current?.abort(), []);
  // Which row is being turned into coordinates. A prediction has none, so the
  // tap costs a round trip the old flow didn't have and has to say so.
  const [picking, setPicking] = useState<string>();
  // A ref, not state: nothing renders from it, and as state it would land in the
  // effect's deps and fire a fresh search the moment a pick replaced the token.
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
      {/* `keyboardAware` is what makes the suggestions usable: without it they
          render behind the keyboard and the first tap on one is swallowed. */}
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
          // No place, no pin, no room — and no title, now that the field starts
          // empty rather than prefilled with a mock one.
          disabled={!place || !title.trim() || !!picking}
          // Step 2 owns the draft's other half, so what you typed here rides
          // along in the URL — otherwise the room you create isn't the one you
          // described.
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

const Stepper = ({ value, onChange }: { value: number; onChange: (n: number) => void }) => {
  const { c } = useTheme();
  const box = (glyph: string, active: boolean, to: number) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={glyph === '+' ? 'More people' : 'Fewer people'}
      onPress={() => onChange(to)}
      style={{
        width: 28,
        height: 28,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: active ? c.ink : c.hair2,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{ fontFamily: font.regular, fontSize: 14, color: active ? c.ink : c.mute }}>
        {glyph}
      </Text>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      {box('−', value > 2, Math.max(2, value - 1))}
      <Text
        style={{
          fontFamily: font.bold,
          fontSize: 17,
          minWidth: 20,
          textAlign: 'center',
          color: c.ink,
        }}>
        {value}
      </Text>
      {box('+', true, value + 1)}
    </View>
  );
};

const SettingRow = ({ title, sub, right }: { title: string; sub: string; right: React.ReactNode }) => {
  const { c } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 14,
      }}>
      <View>
        <Text style={{ fontFamily: font.medium, fontSize: 15, color: c.ink }}>{title}</Text>
        <Text style={{ fontFamily: font.regular, fontSize: 12.5, color: c.mute, marginTop: 2 }}>
          {sub}
        </Text>
      </View>
      {right}
    </View>
  );
};

/** Schedule and access settings for the validated place from step 1. */
export function CreateStep2({
  title,
  place,
  lat,
  lng,
  myYear,
}: {
  title: string;
  place: string;
  lat: number;
  lng: number;
  /** Preselected and required when restricting by class year. */
  myYear?: string;
}) {
  const { c } = useTheme();
  const now = useNow();
  const [when, setWhen] = useState('Now');
  const [cap, setCap] = useState(3);
  const [approve, setApprove] = useState(false);
  // Year restrictions are opt-in and always include the host.
  const [yearsOnly, setYearsOnly] = useState(false);
  const [years, setYears] = useState<string[]>(myYear ? [myYear] : []);
  // Built once per render rather than rescanned per chip in the year row.
  const chosenYears = new Set(years);
  const divider = { paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: c.hair } as const;
  const toggleYear = (y: string) => {
    if (y === myYear) return;
    setYears((v) => (v.includes(y) ? v.filter((x) => x !== y) : [...v, y]));
  };
  const previewYears = yearsOnly && years.length ? ` · ${years.join('–')}` : '';
  // One clock for the label, the preview and the write, so the screen can't
  // promise a time the room doesn't open at. "Now" is the moment you press it.
  const startsAt = when === 'Now' ? now : new Date(now.getTime() + 60 * 60_000);

  const [opening, setOpening] = useState(false);
  const openingLock = useRef(false);
  const [failed, setFailed] = useState<string>();

  const open = async () => {
    if (openingLock.current) return;
    openingLock.current = true;
    setOpening(true);
    setFailed(undefined);
    try {
      const id = await createRoom(
        {
          title,
          place,
          startsAt: new Date(Date.now() + (when === 'Now' ? 0 : 3_600_000)),
          capacity: cap,
          access: approve ? 'approve' : 'open',
          years: yearsOnly && years.length ? yearsForHost(years, myYear) : undefined,
        },
        lat,
        lng
      );
      // `replace` only swaps this screen for the room — step 1 stayed underneath
      // in the stack, so "back" from a room you just opened landed you on the
      // create form you just submitted, with no way out of it but starting over.
      // Every entry point pushes step 1 then step 2, always exactly two deep, so
      // dismissing both and pushing fresh lands "back" wherever Create was opened
      // from instead.
      // Opening a room is the one thing this whole screen exists for, so it is
      // the one write that doesn't go through `useWrite` and needs its own.
      tapOk();
      router.dismiss(2);
      router.push(`/room/${id}`);
    } catch (error) {
      tapFail();
      Sentry.captureException(error, { tags: { operation: 'create-room' } });
      setFailed(errorMessage(error));
    } finally {
      openingLock.current = false;
      setOpening(false);
    }
  };
  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <StatusStrip />
      <WizardBar left="Back" step="STEP 2 / 2" onLeft={() => router.back()} />
      <Body contentStyle={{ paddingHorizontal: 22, gap: 18, flexGrow: 1 }}>
        <Text style={[type.display, { color: c.ink }]}>When does the{'\n'}room go live?</Text>
        <Text style={{ color: c.mute, fontFamily: font.regular }}>Rooms end {ROOM_DURATION_HOURS} hours after starting. You can end yours early.</Text>

        <View
          style={{
            flexDirection: 'row',
            gap: 26,
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderBottomColor: c.hair,
          }}>
          {/* Derived from the chips beside it, not typed in — both stops are
              today, so the time is the whole answer. */}
          <View>
            <Eyebrow>GOES LIVE</Eyebrow>
            <Text
              style={{
                fontFamily: font.bold,
                fontSize: 18,
                letterSpacing: em(-0.015, 18),
                color: c.ink,
                marginTop: 6,
              }}>
              {clock(startsAt)}
            </Text>
          </View>
          <View style={{ marginLeft: 'auto', alignSelf: 'flex-end', flexDirection: 'row', gap: 7 }}>
            {['Now', '+1 hr'].map((w) => (
              <Chip
                key={w}
                label={w}
                selected={w === when}
                color={w === when ? undefined : c.mute}
                onPress={() => setWhen(w)}
              />
            ))}
          </View>
        </View>

        <View style={divider}>
          <SettingRow
            title="Max people"
            sub="Room closes at the cap"
            right={<Stepper value={cap} onChange={setCap} />}
          />
        </View>

        <View style={[divider, { gap: 11 }]}>
          <Text style={{ fontFamily: font.medium, fontSize: 15, color: c.ink }}>Who gets in</Text>
          <View style={{ flexDirection: 'row', gap: 7 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: !approve }}
              onPress={() => setApprove(false)}
              style={{
                flex: 1,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: radius.chip,
                borderWidth: approve ? 1 : 1.5,
                borderColor: approve ? c.hair2 : c.ink,
              }}>
              <Text
                style={
                  approve
                    ? { fontFamily: font.regular, fontSize: 13, color: c.mute }
                    : { fontFamily: font.medium, fontSize: 13, color: c.ink }
                }>
                Anyone can join
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: approve }}
              onPress={() => setApprove(true)}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 7,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: radius.chip,
                borderWidth: approve ? 1.5 : 1,
                borderColor: approve ? c.ink : c.hair2,
              }}>
              <LockIcon size={12} color={approve ? c.ink : c.mute2} />
              <Text
                style={
                  approve
                    ? { fontFamily: font.medium, fontSize: 13, color: c.ink }
                    : { fontFamily: font.regular, fontSize: 13, color: c.mute }
                }>
                Approve requests
              </Text>
            </Pressable>
          </View>
          <Text style={{ fontFamily: font.regular, fontSize: 12.5, color: c.mute }}>
            {approve
              ? `Each request waits on you until the ${cap} seats are gone.`
              : `Seats fill instantly until ${cap}. Switch to approving and each request waits on you.`}
          </Text>
        </View>

        <View style={[divider, { gap: 12 }]}>
          <SettingRow
            title="Class years only"
            sub="Other years won't see the room at all"
            right={<Toggle on={yearsOnly} onPress={() => setYearsOnly((v) => !v)} />}
          />
          {yearsOnly ? (
            <View style={{ flexDirection: 'row', gap: 7 }}>
              {[...new Set([...classYears, ...(myYear ? [myYear] : [])])].map((y) => (
                <YearChip
                  key={y}
                  label={y}
                  selected={chosenYears.has(y)}
                  onPress={() => toggleYear(y)}
                />
              ))}
            </View>
          ) : null}
        </View>

        <View style={{ marginTop: 'auto', marginBottom: 24, gap: 14 }}>
          <View
            style={{
              paddingVertical: 14,
              paddingHorizontal: 16,
              borderRadius: radius.card,
              backgroundColor: c.raised,
              borderWidth: 1,
              borderColor: c.hair,
            }}>
            <StatusLine label="PREVIEW" color={c.green} small />
            <Text
              style={{
                fontFamily: font.bold,
                fontSize: 18,
                letterSpacing: em(-0.018, 18),
                color: c.ink,
                marginTop: 8,
                paddingRight: 26,
              }}>
              {title}
            </Text>
            <Text style={{ fontFamily: font.regular, fontSize: 12.5, color: c.mute, marginTop: 4 }}>
              {place} · {clock(startsAt)} · {cap} seats{previewYears}
            </Text>
            <PeelCorner
              size={26}
              id="peelCreate"
              surface={c.surface}
              raised={c.raised}
              hair={c.hair}
              hair2={c.hair2}
            />
          </View>
          {failed ? (
            <Text
              style={{ fontFamily: font.regular, fontSize: 13, color: c.coral, marginBottom: 10 }}>
              {failed}
            </Text>
          ) : null}
          <PrimaryButton
            label={opening ? 'Opening…' : 'Open the room'}
            disabled={opening}
            onPress={open}
          />
        </View>
      </Body>
    </View>
  );
}
