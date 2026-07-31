import { Text, View } from 'react-native';
import {
  Body,
  Field,
  PrimaryButton,
  Radio,
  StatusStrip,
  Toggle,
} from '../components/ui';
import { em, font, radius, type, useTheme } from '../theme';

const Reason = ({
  label,
  sub,
  on,
  last,
}: {
  label: string;
  sub?: string;
  on?: boolean;
  last?: boolean;
}) => {
  const { c } = useTheme();
  return (
    <View
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
    </View>
  );
};

/**
 * Report & block, over a dimmed room. The design also desaturates the backdrop
 * (`filter:saturate(.5)`); RN has no filter, so only the opacity carries it.
 */
export function ReportSheet() {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <View style={{ opacity: 0.4 }}>
        <StatusStrip />
        <View style={{ paddingTop: 20, paddingHorizontal: 22 }}>
          <Text style={[type.display, { color: c.ink }]}>Sunset set on Lot D roof</Text>
          <Text style={{ fontFamily: font.regular, fontSize: 13, color: c.mute, marginTop: 8 }}>
            Hosted by Maya J · 14 here now
          </Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 22 }}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.round,
                  backgroundColor: c.fill,
                  borderWidth: 1,
                  borderColor: c.hair,
                }}
              />
            ))}
          </View>
        </View>
      </View>

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
              Report Ade T.
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
              Goes to the openseat safety team only. Ade isn't told who reported them.
            </Text>
          </View>

          <View>
            <Reason
              label="Harassment or bullying"
              sub="Messages, comments, or behavior in a room"
              on
            />
            <Reason label="Unsafe or threatening" />
            <Reason label="Spam or scam" />
            <Reason label="Something else" last />
          </View>

          <Field label="WHAT HAPPENED (OPTIONAL)">
            <Text style={{ fontFamily: font.regular, fontSize: 14, color: c.faint }}>
              A sentence is enough
            </Text>
          </Field>

          <View style={{ gap: 14 }}>
            <PrimaryButton label="Submit report" danger />
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
                  Also block Ade T.
                </Text>
                <Text style={{ fontFamily: font.regular, fontSize: 12, color: c.mute, marginTop: 2 }}>
                  You won't see each other's rooms
                </Text>
              </View>
              <Toggle on={false} />
            </View>
            <Text
              style={{
                fontFamily: font.regular,
                fontSize: 13.5,
                color: c.mute,
                textAlign: 'center',
              }}>
              Cancel
            </Text>
          </View>
        </Body>
      </View>
    </View>
  );
}
