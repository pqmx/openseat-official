import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import {
  Body,
  Field,
  PrimaryButton,
  Radio,
  StatusStrip,
  TextButton,
  Toggle,
} from '../components/ui';
import { router, useLocalSearchParams } from 'expo-router';
import { submitReport, useWrite } from '../api';
import { useSession } from '../session';
import { em, font, radius, useTheme } from '../theme';

const Reason = ({
  label,
  sub,
  on,
  last,
  onPress,
}: {
  label: string;
  sub?: string;
  on?: boolean;
  last?: boolean;
  onPress: () => void;
}) => {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: !!on }}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 13,
        paddingVertical: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: c.hairFaint,
      }}>
      <Radio on={!!on} />
      <View>
        <Text
          style={
            on
              ? { fontFamily: font.medium, fontSize: 14.5, color: c.ink }
              : { fontFamily: font.regular, fontSize: 14.5, color: c.ink2 }
          }>
          {label}
        </Text>
        {sub ? (
          <Text style={{ fontFamily: font.regular, fontSize: 12, color: c.mute, marginTop: 2 }}>
            {sub}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
};

const reasons = [
  { label: 'Harassment or bullying', sub: 'Messages, comments, or behavior in a room' },
  { label: 'Unsafe or threatening' },
  { label: 'Spam or scam' },
  { label: 'Something else' },
];

/**
 * Report & block. Reached as `/report?room=…&person=…&name=…`: the two ids are
 * what gets written, `name` only addresses the sheet. Naming somebody you can't
 * see is pointless rather than dangerous — the row is yours, and `reports_select`
 * shows it to nobody else.
 *
 * The design draws a dimmed, desaturated room behind the sheet because the mock
 * had no modal to put it behind. Here `presentation: 'formSheet'` leaves the
 * real screen showing, so the hand-drawn backdrop was two paragraphs of fixture
 * text pretending to be whatever you were actually looking at. It's gone.
 */
export function ReportSheet() {
  const { c } = useTheme();
  const { me } = useSession();
  const { room, person, name } = useLocalSearchParams<{
    room?: string;
    person?: string;
    name?: string;
  }>();
  const { busy, run } = useWrite();
  const [reason, setReason] = useState(reasons[0].label);
  const [detail, setDetail] = useState('');
  const [block, setBlock] = useState(false);
  const who = name ?? 'this room';
  const blocking = block && !!person;
  const send = () =>
    me &&
    run(async () => {
      await submitReport({
        reporterId: me.id,
        personId: person,
        roomId: room,
        reason,
        detail,
        blocked: blocking,
      });
      // A plain report changes nothing you can see, so going back is right.
      //
      // A block is the opposite: `private.blocked_with` is folded into
      // `can_see_room`, so the screen directly behind this sheet — their profile,
      // or a room they host — is the one thing the block just made unreadable.
      // Going back to it lands on "No room at that address," which reads as a
      // failure when it is actually the block working.
      //
      // Dismiss the sheet first, then replace what it was covering, so the dead
      // screen doesn't stay behind to be reached with a back gesture.
      if (!blocking) return router.back();
      router.dismiss();
      router.replace('/discover');
    });
  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <StatusStrip />
      <View
        style={{
          flex: 1,
          marginTop: 22,
          backgroundColor: c.surface,
          borderTopWidth: 1,
          borderTopColor: c.frame,
          borderTopLeftRadius: radius.sheet,
          borderTopRightRadius: radius.sheet,
          paddingTop: 14,
        }}>
        <View
          style={{
            width: 34,
            height: 4,
            borderRadius: radius.round,
            backgroundColor: c.hair2,
            alignSelf: 'center',
          }}
        />
        <Body contentStyle={{ paddingTop: 20, paddingHorizontal: 22, paddingBottom: 28, gap: 20 }}>
          <View>
            <Text
              style={{
                fontFamily: font.bold,
                fontSize: 21,
                letterSpacing: em(-0.018, 21),
                color: c.ink,
              }}>
              Report {who}
            </Text>
            <Text
              style={{
                fontFamily: font.regular,
                fontSize: 13,
                lineHeight: 13 * 1.55,
                color: c.mute,
                marginTop: 7,
                maxWidth: 300,
              }}>
              Goes to the openseat safety team only.{' '}
              {name ? `${name.split(' ')[0]} isn't told who reported them.` : "The host isn't told who reported it."}
            </Text>
          </View>

          <View>
            {reasons.map((r, i) => (
              <Reason
                key={r.label}
                label={r.label}
                sub={r.sub}
                on={r.label === reason}
                last={i === reasons.length - 1}
                onPress={() => setReason(r.label)}
              />
            ))}
          </View>

          <Field label="WHAT HAPPENED (OPTIONAL)">
            <TextInput
              value={detail}
              onChangeText={setDetail}
              multiline
              placeholder="A sentence is enough"
              placeholderTextColor={c.faint}
              selectionColor={c.coral}
              style={{ fontFamily: font.regular, fontSize: 14, color: c.ink, padding: 0 }}
            />
          </Field>

          <View style={{ gap: 14 }}>
            <PrimaryButton
              label={busy ? 'Sending…' : 'Submit report'}
              danger
              disabled={busy}
              onPress={send}
            />
            {/* Blocking needs somebody to block, so it only appears when the ⋯
                named a person rather than just a room. */}
            {person ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 14,
                  paddingTop: 16,
                  borderTopWidth: 1,
                  borderTopColor: c.hair,
                }}>
                <View>
                  <Text style={{ fontFamily: font.medium, fontSize: 14, color: c.ink }}>
                    Also block {who}
                  </Text>
                  <Text style={{ fontFamily: font.regular, fontSize: 12, color: c.mute, marginTop: 2 }}>
                    You won't see each other's rooms
                  </Text>
                </View>
                <Toggle on={block} onPress={() => setBlock((v) => !v)} />
              </View>
            ) : null}
            <TextButton
              label="Cancel"
              onPress={() => router.back()}
              style={{
                fontFamily: font.regular,
                fontSize: 13.5,
                color: c.mute,
                textAlign: 'center',
              }}
            />
          </View>
        </Body>
      </View>
    </View>
  );
}
