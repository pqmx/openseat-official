import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Sentry from '@sentry/react-native';
import { LockIcon, PeelCorner } from '../components/icons';
import { Body, Chip, Eyebrow, PrimaryButton, StatusLine, StatusStrip, Toggle, YearChip } from '../components/ui';
import { WizardBar } from '../components/wizard-bar';
import { createRoom, useNow } from '../api';
import { tapFail, tapOk } from '../feedback';
import { classYears, yearsForHost } from '../data';
import { clock } from '../time';
import { em, font, radius, type, useTheme } from '../theme';
import { errorMessage } from '../errors';
import { ROOM_DURATION_HOURS } from '../room-rules';

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
  const chosenYears = new Set(years);
  const divider = { paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: c.hair } as const;
  const toggleYear = (y: string) => {
    if (y === myYear) return;
    setYears((v) => (v.includes(y) ? v.filter((x) => x !== y) : [...v, y]));
  };
  const previewYears = yearsOnly && years.length ? ` · ${years.join('–')}` : '';
  // Preview follows the clock; submission computes its own current start time.
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
      // Remove both wizard steps so Back returns to the screen that opened Create.
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
