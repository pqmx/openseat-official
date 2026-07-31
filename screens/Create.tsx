import { Text, View } from 'react-native';
import { LockIcon, PeelCorner, PinIcon } from '../components/icons';
import {
  Body,
  Caret,
  Chip,
  Eyebrow,
  Field,
  PrimaryButton,
  StatusLine,
  StatusStrip,
  Toggle,
  YearChip,
} from '../components/ui';
import { em, font, radius, type, useTheme } from '../theme';

/** Cancel / STEP n / 2 / action — the bar on both create steps. */
const WizardBar = ({ left, step, right }: { left: string; step: string; right: string }) => {
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
      <Text style={{ fontFamily: font.regular, fontSize: 13.5, color: c.mute }}>{left}</Text>
      <Eyebrow>{step}</Eyebrow>
      <Text style={{ fontFamily: font.regular, fontSize: 13.5, color: c.disabled }}>{right}</Text>
    </View>
  );
};

const Footer = ({ children }: { children: React.ReactNode }) => {
  const { c } = useTheme();
  return (
    <View
      style={{
        paddingTop: 14,
        paddingHorizontal: 22,
        paddingBottom: 28,
        borderTopWidth: 1,
        borderTopColor: c.hair,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
      }}>
      {children}
    </View>
  );
};

/** One suggestion under the location field. */
const PlaceRow = ({
  title,
  sub,
  right,
  last,
}: {
  title: string;
  sub: string;
  right?: string;
  last?: boolean;
}) => {
  const { c } = useTheme();
  return (
    <View
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
        <Text style={{ fontFamily: font.medium, fontSize: 14, color: c.ink }}>{title}</Text>
        <Text style={{ fontFamily: font.regular, fontSize: 12, color: c.mute, marginTop: 2 }}>
          {sub}
        </Text>
      </View>
      {right ? (
        <Text style={{ fontFamily: font.regular, fontSize: 11, color: c.blue }}>{right}</Text>
      ) : null}
    </View>
  );
};

/** Create, step 1 — what and where. */
export function CreateStep1() {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <StatusStrip />
      <WizardBar left="Cancel" step="STEP 1 / 2" right="Next" />
      <Body contentStyle={{ paddingHorizontal: 22, paddingBottom: 24, gap: 26 }}>
        <Text style={[type.display, { color: c.ink }]}>
          Open a seat.{'\n'}What's happening?
        </Text>

        <View style={{ gap: 8 }}>
          <Field label="TITLE" focused>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[type.cardTitle, { color: c.ink }]}>Sunset set on Lot D roof</Text>
              <Caret height={17} />
            </View>
          </Field>
          <Text style={{ fontFamily: font.regular, fontSize: 11, color: c.faint, alignSelf: 'flex-end' }}>
            28 / 60
          </Text>
        </View>

        <Field label="DESCRIPTION" paddingBottom={12}>
          <Text
            style={{
              fontFamily: font.regular,
              fontSize: 14.5,
              lineHeight: 14.5 * 1.55,
              color: c.ink2,
            }}>
            Bringing the speaker + a blanket. Golden hour til it's dark, then we walk for pizza.
          </Text>
        </Field>

        <View style={{ gap: 8 }}>
          <Field label="LOCATION" focused>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
              <PinIcon color={c.mute2} />
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontFamily: font.regular, fontSize: 15, color: c.ink }}>lot d</Text>
                <Caret />
              </View>
            </View>
          </Field>
          <View>
            <PlaceRow
              title="Lot D rooftop, level 5"
              sub="Charles E Young Dr · 4 min walk"
              right="3 rooms here"
            />
            <PlaceRow title="Lot D bike racks" sub="Charles E Young Dr" />
            <PlaceRow title="Drop a custom pin" sub="Place it on the map yourself" last />
          </View>
        </View>
      </Body>

      <Footer>
        <Text
          style={{ fontFamily: font.regular, fontSize: 12, color: c.mute2, lineHeight: 12 * 1.4 }}>
          Nothing posts{'\n'}until step 2
        </Text>
        <PrimaryButton label="Next: when & who" height={44} style={{ flex: 1 }} />
      </Footer>
    </View>
  );
}

const Stepper = ({ value }: { value: number }) => {
  const { c } = useTheme();
  const box = (glyph: string, active?: boolean) => (
    <View
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
    </View>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      {box('−')}
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
      {box('+', true)}
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
export function CreateStep2({ peelCorner = true }: { peelCorner?: boolean }) {
  const { c } = useTheme();
  const divider = { paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: c.hair } as const;
  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <StatusStrip />
      <WizardBar left="Back" step="STEP 2 / 2" right="Draft" />
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
            <Chip label="Now" selected />
            <Chip label="+1 hr" color={c.mute} />
          </View>
        </View>

        <View style={divider}>
          <SettingRow
            title="Max people"
            sub="Room closes at the cap"
            right={<Stepper value={18} />}
          />
        </View>

        <View style={[divider, { gap: 11 }]}>
          <Text style={{ fontFamily: font.medium, fontSize: 15, color: c.ink }}>Who gets in</Text>
          <View style={{ flexDirection: 'row', gap: 7 }}>
            <View
              style={{
                flex: 1,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: radius.chip,
                borderWidth: 1.5,
                borderColor: c.ink,
              }}>
              <Text style={{ fontFamily: font.medium, fontSize: 13, color: c.ink }}>
                Anyone can join
              </Text>
            </View>
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 7,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: radius.chip,
                borderWidth: 1,
                borderColor: c.hair2,
              }}>
              <LockIcon size={12} color={c.mute2} />
              <Text style={{ fontFamily: font.regular, fontSize: 13, color: c.mute }}>
                Approve requests
              </Text>
            </View>
          </View>
          <Text style={{ fontFamily: font.regular, fontSize: 12.5, color: c.mute }}>
            Seats fill instantly until 18. Switch to approving and each request waits on you.
          </Text>
        </View>

        <View style={[divider, { gap: 12 }]}>
          <SettingRow
            title="Class years only"
            sub="Other years won't see the room at all"
            right={<Toggle on />}
          />
          <View style={{ flexDirection: 'row', gap: 7 }}>
            <YearChip label="'27" selected />
            <YearChip label="'28" selected />
            <YearChip label="'29" />
            <YearChip label="Grad" />
          </View>
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
              Lot D rooftop · 7:15 PM · 18 seats · '27–'28
            </Text>
            {peelCorner ? (
              <PeelCorner
                size={26}
                id="peelCreate"
                surface={c.surface}
                raised={c.raised}
                hair={c.hair}
                hair2={c.hair2}
              />
            ) : null}
          </View>
          <PrimaryButton label="Open the room" />
        </View>
      </Body>
    </View>
  );
}
