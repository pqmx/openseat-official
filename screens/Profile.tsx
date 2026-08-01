import { Alert, Pressable, Text, View } from 'react-native';
import { BackIcon, MenuIcon, MoreIcon } from '../components/icons';
import { RoomRow } from '../components/rooms';
import {
  Avatar,
  Body,
  Chip,
  Eyebrow,
  PrimaryButton,
  StatusStrip,
  TextButton,
} from '../components/ui';
import { useNow } from '../api';
import { hostedBy, type Person, type Room } from '../data';
import { useSession } from '../session';
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
/** The sheet writes from the id; `name` is only so it can address you. */
const reportHref = (person: Person) =>
  `/report?person=${person.id}&name=${encodeURIComponent(person.name)}`;

export function Profile({ person, rooms }: { person: Person; rooms: Room[] }) {
  const { c } = useTheme();
  const now = useNow();
  const hosts = hostedBy(rooms, person.id, now);
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
            onPress={() => router.push(reportHref(person) as never)}
            hitSlop={10}>
            <MoreIcon color={c.ink} />
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
          {/*
            Initials, not a dashed "Portrait" box. There's no upload path, so a
            photo slot was a promise the app couldn't keep — and initials are
            already how a person reads in every roster and feed card.
          */}
          <Avatar initials={person.initials} tone={person.tone} size={92} />
          <View style={{ flexShrink: 1 }}>
            <Text style={[name, { color: c.ink }]}>{person.name}</Text>
            <Text style={{ fontFamily: font.regular, fontSize: 13, color: c.mute, marginTop: 6 }}>
              {person.year} · {person.major}
            </Text>
            <Text style={{ fontFamily: font.regular, fontSize: 13, color: c.mute }}>
              {hosts.length} {hosts.length === 1 ? 'room' : 'rooms'} hosted
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
            onPress={() => router.push(reportHref(person) as never)}
            style={{ fontFamily: font.regular, fontSize: 13, color: c.mute }}
          />
        </View>
      </Body>
    </View>
  );
}

/** Your own profile the day you sign up — nothing filled in yet. */
export function ProfileEmpty({ me }: { me: Person }) {
  const { c } = useTheme();
  const { signOut } = useSession();
  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <StatusStrip />
      <Body contentStyle={{ paddingTop: 8, paddingHorizontal: 22, paddingBottom: 24, gap: 22, flexGrow: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
          <Avatar initials={me.initials} tone={me.tone} size={92} />
          <View style={{ flexShrink: 1 }}>
            {/* Read from the session rather than retyped, so it can't drift. */}
            <Text style={[name, { color: c.ink }]}>{me.name}</Text>
            <Text style={{ fontFamily: font.regular, fontSize: 13, color: c.mute, marginTop: 6 }}>
              {me.year} · {me.major}
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
              One thing left
            </Text>
            {/* Was "Photo and one prompt" — there are no photos to add now. */}
            <Text style={{ fontFamily: font.regular, fontSize: 12.5, color: c.mute, marginTop: 3 }}>
              One prompt — 20 seconds
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {/* Three steps since the photo one went: name, interests, prompt. */}
            {[
              { id: 'name', color: c.green },
              { id: 'interests', color: c.green },
              { id: 'prompt', color: c.hair2 },
            ].map((step) => (
              <View
                key={step.id}
                style={{ width: 22, height: 3, borderRadius: radius.round, backgroundColor: step.color }}
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
          {/*
            No prompt editor is designed, and the onboarding screen this used to
            open is gone — sign-in belongs to Google now. So the button says what
            it actually does, which is what the old comment always claimed:
            finishing the profile starts a room.
          */}
          <PrimaryButton
            label="Open a room"
            height={44}
            onPress={() => router.push('/create')}
            style={{ flex: 1 }}
          />
          {/*
            This opened the report sheet, which on your own profile meant
            offering to report yourself. Sign-out had no button anywhere in the
            app — you could get in and never out — so this is where it lives.
          */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            onPress={() =>
              Alert.alert('Sign out?', 'You can sign back in with Google any time.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
              ])
            }
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
