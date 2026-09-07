import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
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
import { fetchBlocks, saveProfile, unblock, useNow, useWrite, type Block } from '../api';
import {
  hostedBy,
  interestTags,
  maxAnswer,
  maxInterests,
  promptQuestions,
  withAnswer,
  type MapsApp,
  type Person,
  type Room,
} from '../data';
import { getMapsApp, setMapsApp } from '../prefs';
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

/** A profile prompt with an answer. */
const Prompt = ({ label, answer }: { label: string; answer: string }) => {
  const { c } = useTheme();
  return (
    <View style={{ paddingTop: 18, borderTopWidth: 1, borderTopColor: c.hair }}>
      <Eyebrow>{label}</Eyebrow>
      <Text style={[type.prompt, { color: c.ink, marginTop: 8 }]}>{answer}</Text>
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

/** Editable profile answer with a placeholder for empty values. */
const PromptField = ({
  q,
  placeholder,
  answer,
  onSave,
}: {
  q: string;
  placeholder: string;
  answer: string;
  onSave: (text: string) => void;
}) => {
  const { c } = useTheme();
  const [text, setText] = useState(answer);
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ paddingTop: 18, borderTopWidth: 1, borderTopColor: focused ? c.ink2 : c.hair }}>
      <Eyebrow>{q}</Eyebrow>
      <TextInput
        multiline
        maxLength={maxAnswer}
        value={text}
        onChangeText={setText}
        onFocus={() => setFocused(true)}
        // Saved on blur, not per keystroke: one write per answer instead of one
        // per letter, and nothing to debounce.
        onBlur={() => {
          setFocused(false);
          if (text.trim() !== answer) onSave(text);
        }}
        placeholder={placeholder}
        placeholderTextColor={c.faint}
        style={[type.prompt, { color: c.ink, marginTop: 8, padding: 0 }]}
      />
    </View>
  );
};

/** Profile editing, hosted rooms, and account settings. */
export function YourProfile({ me, rooms }: { me: Person; rooms: Room[] }) {
  const { c } = useTheme();
  const { signOut, deleteAccount, reloadMe } = useSession();
  const now = useNow();
  const { run } = useWrite();
  // Blocking someone is what hides them, so this can't be read off `rooms` or
  // any profile select — it comes from `my_blocks()`. Loaded here rather than in
  // the route because it is this section's own data and nothing else reads it.
  const [blocks, setBlocks] = useState<Block[]>([]);
  const loadBlocks = useCallback(() => void fetchBlocks().then(setBlocks).catch(() => {}), []);
  useEffect(loadBlocks, [loadBlocks]);
  const hosts = hostedBy(rooms, me.id, now);
  const interests = me.interests ?? [];
  // Built once per render rather than rescanned per chip in the `interestTags` row.
  const chosen = new Set(interests);
  const prompts = me.prompts ?? [];
  // Read once on mount rather than held in a context: the room screen reads
  // storage at press time, so there is no second copy of this to keep in sync.
  const [mapsApp, setMapsAppState] = useState<MapsApp>();
  useEffect(() => {
    void getMapsApp().then(setMapsAppState);
  }, []);

  // `reloadMe` rather than local state: the row Postgres kept is the profile,
  // and a constraint or a grant can refuse a write this screen thought landed.
  const save = (patch: Parameters<typeof saveProfile>[1]) =>
    void run(async () => {
      await saveProfile(me.id, patch);
      await reloadMe();
    });

  const toggle = (tag: string) => {
    if (chosen.has(tag)) return save({ interests: interests.filter((t) => t !== tag) });
    // At the cap the tap does nothing — the alternative is dropping somebody's
    // oldest tag to make room for one they may have hit by accident.
    if (interests.length < maxInterests) save({ interests: [...interests, tag] });
  };

  const todo = [
    interests.length ? null : 'a tag or two',
    prompts.length ? null : 'one prompt',
  ].filter(Boolean);

  // Two taps, and the second one spells out what survives. Apple requires the
  // account be deletable from inside the app; it does not require it be easy to
  // do by accident.
  const confirmDelete = () =>
    Alert.alert(
      'Delete your account?',
      'This cannot be undone. Rooms you host are called off so the people who joined find out, ' +
        'your name and profile are erased, and you are signed out. Anyone you blocked stays blocked.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void run(() => deleteAccount()),
        },
      ],
    );

  const openAccountMenu = () =>
    Alert.alert('Account', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete account', style: 'destructive', onPress: confirmDelete },
      { text: 'Sign out', onPress: () => void signOut() },
    ]);

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
              Verified Bruin
            </Text>
          </View>
        </View>

        {/* Gone once there's nothing left to do, rather than stuck on "One
            thing left" forever — it counts what's actually missing. */}
        {todo.length ? (
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
            <View style={{ flexShrink: 1 }}>
              <Text style={{ fontFamily: font.medium, fontSize: 14, color: c.ink }}>
                {todo.length === 1 ? 'One thing left' : 'Two things left'}
              </Text>
              {/* Was "Photo and one prompt" — there are no photos to add now. */}
              <Text style={{ fontFamily: font.regular, fontSize: 12.5, color: c.mute, marginTop: 3 }}>
                {todo.join(' and ')} — 20 seconds
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {/* Three steps since the photo one went. Google filled the name
                  in, so it is always done. */}
              {[
                { step: 'name', done: true },
                { step: 'interests', done: interests.length > 0 },
                { step: 'prompts', done: prompts.length > 0 },
              ].map(({ step, done }) => (
                <View
                  key={step}
                  style={{
                    width: 22,
                    height: 3,
                    borderRadius: radius.round,
                    backgroundColor: done ? c.green : c.hair2,
                  }}
                />
              ))}
            </View>
          </View>
        ) : null}

        <View style={{ gap: 10 }}>
          <Eyebrow>WHAT YOU'D SHOW UP FOR</Eyebrow>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            {interestTags.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                selected={chosen.has(tag)}
                onPress={() => toggle(tag)}
              />
            ))}
          </View>
          <Text style={{ fontFamily: font.regular, fontSize: 12.5, color: c.mute }}>
            {interests.length >= maxInterests
              ? `${maxInterests} is the limit — tap one off to swap it.`
              : `Up to ${maxInterests}. They show on your profile, nowhere else.`}
          </Text>
        </View>

        <View style={{ gap: 18 }}>
          {promptQuestions.map(({ q, placeholder }) => (
            <PromptField
              key={q}
              q={q}
              placeholder={placeholder}
              answer={prompts.find((p) => p.q === q)?.a ?? ''}
              onSave={(text) => save({ prompts: withAnswer(prompts, q, text) })}
            />
          ))}
        </View>

        <View style={{ paddingTop: 18, borderTopWidth: 1, borderTopColor: c.hair, gap: 12 }}>
          <Eyebrow>ROOMS YOU HOST</Eyebrow>
          {hosts.length ? (
            hosts.map((room) => <RoomRow key={room.id} room={room} now={now} small />)
          ) : (
            <Text
              style={{
                fontFamily: font.regular,
                fontSize: 13.5,
                lineHeight: 13.5 * 1.55,
                color: c.mute,
              }}>
              None yet. The first one usually starts as a text you never sent.
            </Text>
          )}
        </View>

        <View style={{ paddingTop: 18, borderTopWidth: 1, borderTopColor: c.hair, gap: 10 }}>
          <Eyebrow>ROOM LOCATIONS OPEN IN</Eyebrow>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['google', 'apple'] as const).map((app) => (
              <Chip
                key={app}
                label={app === 'google' ? 'Google Maps' : 'Apple Maps'}
                selected={mapsApp === app}
                onPress={() => {
                  setMapsAppState(app);
                  void setMapsApp(app);
                }}
              />
            ))}
          </View>
          {mapsApp ? null : (
            <Text style={{ fontFamily: font.regular, fontSize: 12.5, color: c.mute }}>
              Asked the first time you open a room's map.
            </Text>
          )}
        </View>

        {blocks.length ? (
          <View style={{ paddingTop: 18, borderTopWidth: 1, borderTopColor: c.hair, gap: 12 }}>
            <Eyebrow>BLOCKED</Eyebrow>
            {blocks.map((b) => (
              <View
                key={b.reportId}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar initials={b.person.initials} tone={b.person.tone} size={36} />
                <Text
                  style={{ flex: 1, fontFamily: font.medium, fontSize: 14.5, color: c.ink }}
                  numberOfLines={1}>
                  {b.person.name}
                </Text>
                <TextButton
                  label="Unblock"
                  style={{ fontFamily: font.medium, fontSize: 13.5, color: c.ink2 }}
                  onPress={() =>
                    void run(async () => {
                      await unblock(b.reportId);
                      loadBlocks();
                    })
                  }
                />
              </View>
            ))}
            <Text style={{ fontFamily: font.regular, fontSize: 12.5, color: c.mute }}>
              Neither of you sees the other's rooms until this is lifted.
            </Text>
          </View>
        ) : null}

        <View style={{ marginTop: 'auto', marginBottom: 11, flexDirection: 'row', gap: 10 }}>
          <PrimaryButton
            label="Open a room"
            height={44}
            onPress={() => router.push('/create')}
            style={{ flex: 1 }}
          />
          <Pressable
            testID="account-options"
            accessibilityRole="button"
            accessibilityLabel="Account options"
            onPress={openAccountMenu}
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
