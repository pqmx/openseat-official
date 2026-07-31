import { useState } from 'react';
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
import { em, font, radius, type, useTheme } from '../theme';

/** Cancel / STEP n / 2 / action — the bar on both create steps. */
const WizardBar = ({
  left,
  step,
  right,
  onLeft,
}: {
  left: string;
  step: string;
  right: string;
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
      <Text style={{ fontFamily: font.regular, fontSize: 13.5, color: c.disabled }}>{right}</Text>
    </View>
  );
};

/** One suggestion under the location field. */
const PlaceRow = ({
  title,
  sub,
  right,
  last,
  selected,
  onPress,
}: {
  title: string;
  sub: string;
  right?: string;
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
      <View>
        <Text style={{ fontFamily: font.medium, fontSize: 14, color: selected ? c.coral : c.ink }}>
          {title}
        </Text>
        <Text style={{ fontFamily: font.regular, fontSize: 12, color: c.mute, marginTop: 2 }}>
          {sub}
        </Text>
      </View>
      {right ? (
        <Text style={{ fontFamily: font.regular, fontSize: 11, color: c.blue }}>{right}</Text>
      ) : null}
    </Pressable>
  );
};

/** Create, step 1 — what and where. */
type Place = { title: string; sub: string; right?: string };

const places: Place[] = [
  { title: 'Lot D rooftop, level 5', sub: 'Charles E Young Dr · 4 min walk', right: '3 rooms here' },
  { title: 'Lot D bike racks', sub: 'Charles E Young Dr' },
];

/** Always offered, however the search goes. */
const customPin: Place = { title: 'Drop a custom pin', sub: 'Place it on the map yourself' };

export function CreateStep1() {
  const { c } = useTheme();
  const [title, setTitle] = useState('Sunset set on Lot D roof');
  const [description, setDescription] = useState(
    "Bringing the speaker + a blanket. Golden hour til it's dark, then we walk for pizza."
  );
  const [query, setQuery] = useState('lot d');
  const [place, setPlace] = useState(places[0].title);
  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <StatusStrip />
      <WizardBar left="Cancel" step="STEP 1 / 2" right="Next" onLeft={() => router.back()} />
      <Body contentStyle={{ paddingHorizontal: 22, paddingBottom: 24, gap: 26 }}>
        <Text style={[type.display, { color: c.ink }]}>
          Open a seat.{'\n'}What's happening?
        </Text>

        <View style={{ gap: 8 }}>
          <Field label="TITLE" focused>
            <TextInput
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

        <Field label="DESCRIPTION" paddingBottom={12}>
          <TextInput
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder="What should people know?"
            placeholderTextColor={c.faint}
            selectionColor={c.coral}
            style={{
              fontFamily: font.regular,
              fontSize: 14.5,
              lineHeight: 14.5 * 1.55,
              color: c.ink2,
              padding: 0,
            }}
          />
        </Field>

        <View style={{ gap: 8 }}>
          <Field label="LOCATION" focused>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
              <PinIcon color={c.mute2} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Where?"
                placeholderTextColor={c.faint}
                selectionColor={c.coral}
                style={{ flex: 1, fontFamily: font.regular, fontSize: 15, color: c.ink, padding: 0 }}
              />
            </View>
          </Field>
          <View>
            {[
              ...places.filter((p) =>
                p.title.toLowerCase().includes(query.trim().toLowerCase())
              ),
              customPin,
            ].map((p, i, shown) => (
              <PlaceRow
                key={p.title}
                title={p.title}
                sub={p.sub}
                right={p.right}
                last={i === shown.length - 1}
                selected={p.title === place}
                onPress={() => setPlace(p.title)}
              />
            ))}
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
          onPress={() => router.push('/create/details')}
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

/** Create, step 2 — when and who. */
const allYears = ["'27", "'28", "'29", 'Grad'];

export function CreateStep2() {
  const { c } = useTheme();
  const [when, setWhen] = useState('Now');
  const [cap, setCap] = useState(18);
  const [approve, setApprove] = useState(false);
  const [yearsOnly, setYearsOnly] = useState(true);
  const [years, setYears] = useState(["'27", "'28"]);
  const divider = { paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: c.hair } as const;
  const toggleYear = (y: string) =>
    setYears((v) => (v.includes(y) ? v.filter((x) => x !== y) : [...v, y]));
  const previewYears = yearsOnly && years.length ? ` · ${years.join('–')}` : '';
  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <StatusStrip />
      <WizardBar left="Back" step="STEP 2 / 2" right="Draft" onLeft={() => router.back()} />
      <Body contentStyle={{ paddingHorizontal: 22, gap: 18, flexGrow: 1 }}>
        <Text style={[type.display, { color: c.ink }]}>When does the{'\n'}room go live?</Text>

        <View
          style={{
            flexDirection: 'row',
            gap: 26,
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderBottomColor: c.hair,
          }}>
          {[
            ['DATE', 'Fri, Sep 12'],
            ['TIME', '7:15 PM'],
          ].map(([label, value]) => (
            <View key={label}>
              <Eyebrow>{label}</Eyebrow>
              <Text
                style={{
                  fontFamily: font.bold,
                  fontSize: 18,
                  letterSpacing: em(-0.015, 18),
                  color: c.ink,
                  marginTop: 6,
                }}>
                {value}
              </Text>
            </View>
          ))}
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
              {allYears.map((y) => (
                <YearChip
                  key={y}
                  label={y}
                  selected={years.includes(y)}
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
              Sunset set on Lot D roof
            </Text>
            <Text style={{ fontFamily: font.regular, fontSize: 12.5, color: c.mute, marginTop: 4 }}>
              Lot D rooftop · {when === 'Now' ? '7:15 PM' : '8:15 PM'} · {cap} seats{previewYears}
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
          {/* Approving requests is the only thing that changes where you land. */}
          <PrimaryButton
            label="Open the room"
            // Nothing persists yet, so the new room falls back to a fixture.
            onPress={() =>
              router.replace(`/room/new?view=${approve ? 'requests' : 'host'}`)
            }
          />
        </View>
      </Body>
    </View>
  );
}
