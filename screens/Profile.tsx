import { Pressable, Text, View } from 'react-native';
import { BackIcon, MenuIcon, MoreIcon } from '../components/icons';
import {
  Body,
  Chip,
  Eyebrow,
  ImageSlot,
  PrimaryButton,
  StatusLine,
  StatusStrip,
  TabBar,
  TextButton,
} from '../components/ui';
import { useNav } from '../nav';
import { em, font, radius, type, useTheme } from '../theme';

/** 25px name — only the two profile screens use it. */
const name = {
  fontFamily: font.bold,
  fontSize: 25,
  lineHeight: 25 * 1.08,
  letterSpacing: em(-0.022, 25),
} as const;

const Prompt = ({ label, answer, placeholder }: { label: string; answer: string; placeholder?: boolean }) => {
  const { c } = useTheme();
  return (
    <View style={{ paddingTop: 18, borderTopWidth: 1, borderTopColor: c.hair }}>
      <Eyebrow>{label}</Eyebrow>
      <Text style={[type.prompt, { color: placeholder ? c.faint : c.ink, marginTop: 8 }]}>
        {answer}
      </Text>
    </View>
  );
};

/** A room in the "rooms X hosts" list — smaller than a feed row. */
const HostedRoom = ({
  status,
  statusColor,
  pulse,
  title,
  right,
}: {
  status: string;
  statusColor: string;
  pulse?: boolean;
  title: string;
  right: string;
}) => {
  const { c } = useTheme();
  const { go } = useNav();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => go('room')}
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 12,
      }}>
      <View>
        <StatusLine label={status} color={statusColor} pulse={pulse} small />
        <Text
          style={{
            fontFamily: font.bold,
            fontSize: 15,
            letterSpacing: em(-0.015, 15),
            color: c.ink,
            marginTop: 5,
          }}>
          {title}
        </Text>
      </View>
      <Text style={{ fontFamily: font.regular, fontSize: 12, color: c.mute }}>{right}</Text>
    </Pressable>
  );
};

const interests = ['film photo', 'rooftops', 'house shows', 'thrifting', 'late library'];

/** Someone else's profile, fully filled in. */
export function Profile() {
  const { c } = useTheme();
  const { back, go } = useNav();
  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <StatusStrip />
      <Body contentStyle={{ paddingTop: 8, paddingHorizontal: 22, paddingBottom: 24, gap: 22, flexGrow: 1 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: -6,
          }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} hitSlop={10}>
            <BackIcon color={c.ink} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="More"
            onPress={() => go('report')}
            hitSlop={10}>
            <MoreIcon color={c.ink} />
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
          <ImageSlot size={92} placeholder="Portrait" />
          <View style={{ flexShrink: 1 }}>
            <Text style={[name, { color: c.ink }]}>Maya Jiménez</Text>
            <Text style={{ fontFamily: font.regular, fontSize: 13, color: c.mute, marginTop: 6 }}>
              '27 · Architecture
            </Text>
            <Text style={{ fontFamily: font.regular, fontSize: 13, color: c.mute }}>
              Rieber Hall · 7 rooms hosted
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
          {interests.map((i) => (
            <Chip key={i} label={i} />
          ))}
        </View>

        <View style={{ gap: 18 }}>
          <Prompt
            label="MY IDEAL FRIDAY IS"
            answer="Someone's speaker on a roof and zero plans after"
          />
          <Prompt
            label="TAKE ME TO A ROOM ABOUT"
            answer="Anything that ends up at Diddy Riese"
          />
        </View>

        <View style={{ paddingTop: 18, borderTopWidth: 1, borderTopColor: c.hair, gap: 12 }}>
          <Eyebrow>ROOMS MAYA HOSTS</Eyebrow>
          <HostedRoom
            status="LIVE"
            statusColor={c.green}
            pulse
            title="Sunset set on Lot D roof"
            right="14 here"
          />
          <HostedRoom
            status="SAT 4 PM"
            statusColor={c.blue}
            title="Film swap, Sunset Rec"
            right="9 seats"
          />
        </View>

        <View
          style={{
            marginTop: 'auto',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            paddingTop: 18,
            borderTopWidth: 1,
            borderTopColor: c.hair,
          }}>
          <Text
            style={{ fontFamily: font.regular, fontSize: 12.5, color: c.faint, lineHeight: 12.5 * 1.45 }}>
            Profiles are visible to{'\n'}verified Bruins only
          </Text>
          <TextButton
            label="Report or block"
            onPress={() => go('report')}
            style={{ fontFamily: font.regular, fontSize: 13, color: c.mute }}
          />
        </View>
      </Body>
      <TabBar active="you" />
    </View>
  );
}

/** Your own profile the day you sign up — nothing filled in yet. */
export function ProfileEmpty() {
  const { c } = useTheme();
  const { go } = useNav();
  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <StatusStrip />
      <Body contentStyle={{ paddingTop: 8, paddingHorizontal: 22, paddingBottom: 24, gap: 22, flexGrow: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
          <ImageSlot size={92} placeholder="Photo" />
          <View style={{ flexShrink: 1 }}>
            <Text style={[name, { color: c.ink }]}>Maya Jiménez</Text>
            <Text style={{ fontFamily: font.regular, fontSize: 13, color: c.mute, marginTop: 6 }}>
              '28 · Architecture
            </Text>
            <Text style={{ fontFamily: font.regular, fontSize: 13, color: c.blue, marginTop: 2 }}>
              Verified Bruin · joined today
            </Text>
          </View>
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderRadius: radius.card,
            backgroundColor: c.raised,
            borderWidth: 1,
            borderColor: c.hair,
          }}>
          <View>
            <Text style={{ fontFamily: font.medium, fontSize: 14, color: c.ink }}>
              Two things left
            </Text>
            <Text style={{ fontFamily: font.regular, fontSize: 12.5, color: c.mute, marginTop: 3 }}>
              Photo and one prompt — 40 seconds
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {[c.green, c.green, c.hair2, c.hair2].map((bar, i) => (
              <View
                key={i}
                style={{ width: 22, height: 3, borderRadius: radius.round, backgroundColor: bar }}
              />
            ))}
          </View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
          {['+ film photo', '+ rooftops', '+ house shows', '+ 18 more'].map((i) => (
            <Chip key={i} label={i} dashed color={c.mute} />
          ))}
        </View>

        <View style={{ gap: 18 }}>
          <Prompt
            label="MY IDEAL FRIDAY IS"
            answer="Ten words is plenty. Say the real one."
            placeholder
          />
          <Prompt
            label="TAKE ME TO A ROOM ABOUT"
            answer="Anything, as long as it's not another club fair."
            placeholder
          />
        </View>

        <View style={{ paddingTop: 18, borderTopWidth: 1, borderTopColor: c.hair }}>
          <Eyebrow>ROOMS YOU HOST</Eyebrow>
          <Text
            style={{
              fontFamily: font.regular,
              fontSize: 13.5,
              lineHeight: 13.5 * 1.55,
              color: c.mute,
              marginTop: 8,
            }}>
            None yet. The first one usually starts as a text you never sent.
          </Text>
        </View>

        <View style={{ marginTop: 'auto', marginBottom: 11, flexDirection: 'row', gap: 10 }}>
          {/* No prompt editor is designed — finishing the profile starts a room. */}
          <PrimaryButton
            label="Answer a prompt"
            height={44}
            onPress={() => go('onboard')}
            style={{ flex: 1 }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            onPress={() => go('report')}
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: c.hair2,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <MenuIcon color={c.ink2} />
          </Pressable>
        </View>
      </Body>
      <TabBar active="you" />
    </View>
  );
}
