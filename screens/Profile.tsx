import { Pressable, Text, View } from 'react-native';
import { BackIcon, MenuIcon, MoreIcon } from '../components/icons';
import { RoomRow } from '../components/rooms';
import {
  Body,
  Chip,
  Eyebrow,
  ImageSlot,
  PrimaryButton,
  StatusStrip,
  TextButton,
} from '../components/ui';
import { hostedBy, useNow, type Person } from '../data';
import { router } from 'expo-router';
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

/** Someone else's profile. */
export function Profile({ person }: { person: Person }) {
  const { c } = useTheme();
  const now = useNow();
  const hosts = hostedBy(person.id, now);
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
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={10}>
            <BackIcon color={c.ink} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="More"
            onPress={() => router.push('/report')}
            hitSlop={10}>
            <MoreIcon color={c.ink} />
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
          <ImageSlot size={92} placeholder="Portrait" />
          <View style={{ flexShrink: 1 }}>
            <Text style={[name, { color: c.ink }]}>{person.name}</Text>
            <Text style={{ fontFamily: font.regular, fontSize: 13, color: c.mute, marginTop: 6 }}>
              {person.year} · {person.major}
            </Text>
            <Text style={{ fontFamily: font.regular, fontSize: 13, color: c.mute }}>
              {[person.dorm, `${hosts.length} ${hosts.length === 1 ? 'room' : 'rooms'} hosted`]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        </View>

        {person.interests?.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            {person.interests.map((i) => (
              <Chip key={i} label={i} />
            ))}
          </View>
        ) : null}

        {person.prompts?.length ? (
          <View style={{ gap: 18 }}>
            {person.prompts.map((p) => (
              <Prompt key={p.q} label={p.q} answer={p.a} />
            ))}
          </View>
        ) : null}

        {hosts.length ? (
          <View style={{ paddingTop: 18, borderTopWidth: 1, borderTopColor: c.hair, gap: 12 }}>
            <Eyebrow>ROOMS {person.short.toUpperCase()} HOSTS</Eyebrow>
            {hosts.map((room) => (
              <RoomRow key={room.id} room={room} now={now} small />
            ))}
          </View>
        ) : null}

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
            onPress={() => router.push('/report')}
            style={{ fontFamily: font.regular, fontSize: 13, color: c.mute }}
          />
        </View>
      </Body>
    </View>
  );
}

/** Your own profile the day you sign up — nothing filled in yet. */
export function ProfileEmpty() {
  const { c } = useTheme();
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
            onPress={() => router.push('/profile-setup')}
            style={{ flex: 1 }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            onPress={() => router.push('/report')}
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
    </View>
  );
}
