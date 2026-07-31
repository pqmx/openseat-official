import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { PeelCorner } from '../components/icons';
import {
  Avatar,
  Body,
  Dot,
  MapPlate,
  MapSearchBar,
  PrimaryButton,
  StatusLine,
  TabBar,
} from '../components/ui';
import { useNav } from '../nav';
import { em, font, radius, type, useTheme } from '../theme';

const MapLabel = ({ text, color, left, top }: { text: string; color: string; left: number; top: number }) => (
  <Text
    style={{
      position: 'absolute',
      left,
      top,
      fontFamily: font.regular,
      fontSize: 10,
      letterSpacing: em(0.18, 10),
      textTransform: 'uppercase',
      color,
    }}>
    {text}
  </Text>
);

/** Named pin: glowing green dot with the room title beside it. */
const MapPin = ({
  left,
  top,
  title,
  sub,
}: {
  left: number;
  top: number;
  title: string;
  sub: string;
}) => {
  const { c } = useTheme();
  const { go } = useNav();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => go('room')}
      style={{ position: 'absolute', left: left - 5, top: top - 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {/* the glow ring pads the 14px dot back onto the design coords */}
        <Dot color={c.green} size={14} glow={c.greenGlow} />
        <View style={{ gap: 1 }}>
          <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: c.ink }}>{title}</Text>
          <Text style={{ fontFamily: font.regular, fontSize: 11, color: c.mute }}>{sub}</Text>
        </View>
      </View>
    </Pressable>
  );
};

/** The three overlapping 24px avatars on a live card. */
const AvatarStack = ({ people, tail }: { people: [string, string, string]; tail: string }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Avatar initials={people[0]} size={24} stacked />
      <View style={{ marginLeft: -7 }}>
        <Avatar initials={people[1]} tone="water" size={24} stacked />
      </View>
      <View style={{ marginLeft: -7 }}>
        <Avatar initials={people[2]} tone="park" size={24} stacked />
      </View>
      <Text style={{ marginLeft: 9, fontFamily: font.regular, fontSize: 12.5, color: c.mute }}>
        {tail}
      </Text>
    </View>
  );
};

const FeedTabs = () => {
  const { c } = useTheme();
  const [active, setActive] = useState('Live');
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 16,
        borderBottomWidth: 1,
        borderBottomColor: c.hair,
        paddingBottom: 10,
        marginTop: -8,
      }}>
      {['Live', 'Tonight', 'This week'].map((t) => (
        <Pressable
          key={t}
          accessibilityRole="button"
          accessibilityState={{ selected: t === active }}
          onPress={() => setActive(t)}>
          <Text
            style={
              t === active
                ? {
                    fontFamily: font.medium,
                    fontSize: 12.5,
                    color: c.ink,
                    borderBottomWidth: 1.5,
                    borderBottomColor: c.ink,
                    paddingBottom: 9,
                    marginBottom: -11,
                  }
                : { fontFamily: font.regular, fontSize: 12.5, color: c.mute2 }
            }>
            {t}
          </Text>
        </Pressable>
      ))}
    </View>
  );
};

/** The raised, peeling card at the top of the feed. */
const LiveCard = ({
  peelId,
  status,
  title,
  meta,
  people,
  tail,
  peelCorner = true,
}: {
  peelId: string;
  status: string;
  title: string;
  meta: string;
  people: [string, string, string];
  tail: string;
  peelCorner?: boolean;
}) => {
  const { c } = useTheme();
  const { go } = useNav();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => go('room')}
      style={{
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: radius.card,
        backgroundColor: c.raised,
        borderWidth: 1,
        borderColor: c.hair,
      }}>
      <StatusLine label={status} color={c.green} pulse />
      <Text style={[type.cardTitle, { color: c.ink, marginTop: 8, paddingRight: 30 }]}>
        {title}
      </Text>
      <Text style={{ fontFamily: font.regular, fontSize: 13, color: c.mute, marginTop: 5 }}>
        {meta}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 12,
        }}>
        <AvatarStack people={people} tail={tail} />
        <PrimaryButton
          label="Join"
          height={34}
          onPress={() => go('room')}
          style={{ paddingHorizontal: 16, borderRadius: radius.join }}
        />
      </View>
      {peelCorner ? (
        <PeelCorner
          id={peelId}
          surface={c.surface}
          raised={c.raised}
          hair={c.hair}
          hair2={c.hair2}
        />
      ) : null}
    </Pressable>
  );
};

/** Plain feed row — no card, just the status line, title and meta. */
const FeedRow = ({
  status,
  statusColor,
  pulse,
  title,
  meta,
}: {
  status: string;
  statusColor: string;
  pulse?: boolean;
  title: string;
  meta?: string;
}) => {
  const { c } = useTheme();
  const { go } = useNav();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={() => go('room')}>
      <StatusLine label={status} color={statusColor} pulse={pulse} />
      <Text style={[type.cardTitle, { color: c.ink, marginTop: 8 }]}>{title}</Text>
      {meta ? (
        <Text style={{ fontFamily: font.regular, fontSize: 13, color: c.mute, marginTop: 5 }}>
          {meta}
        </Text>
      ) : null}
    </Pressable>
  );
};

const DiscoverMap = ({ children }: { children?: React.ReactNode }) => {
  const { c } = useTheme();
  return (
    <MapPlate cellW={100} cellH={120} style={{ height: 352 }}>
      <View
        style={{ position: 'absolute', left: 0, top: 246, width: 210, height: 170, backgroundColor: c.park }}
      />
      <View
        style={{ position: 'absolute', left: -30, top: 118, width: 460, height: 14, backgroundColor: c.water }}
      />
      <MapLabel text="the quad" color={c.parkLabel} left={24} top={322} />
      <MapLabel text="sunset canyon" color={c.waterLabel} left={216} top={126} />
      {children}
      <MapSearchBar />
    </MapPlate>
  );
};

const feedPad = { paddingTop: 18, paddingHorizontal: 22, paddingBottom: 92, gap: 18 } as const;

/** Discover — the default '27 viewer. `liveCount` matches the design prop. */
export function Discover({
  liveCount = 12,
  peelCorner = true,
}: {
  liveCount?: number;
  peelCorner?: boolean;
}) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <DiscoverMap>
        <MapPin left={154} top={206} title="Sunset set" sub="14 here" />
        <View
          style={{ position: 'absolute', left: 262, top: 166 }}>
          <Dot color={c.blue} size={9} />
        </View>
        <View style={{ position: 'absolute', left: 72, top: 142 }}>
          <Dot color={c.blue} size={9} />
        </View>
        <View style={{ position: 'absolute', left: 296, top: 288 }}>
          <Dot color={c.dotMute} size={9} />
        </View>
      </DiscoverMap>

      <Body style={{ borderTopWidth: 1, borderTopColor: c.frame }} contentStyle={feedPad}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Text
            style={{
              fontFamily: font.bold,
              fontSize: 17,
              letterSpacing: em(-0.015, 17),
              color: c.ink,
            }}>
            {liveCount} rooms live nearby
          </Text>
          <Text style={{ fontFamily: font.regular, fontSize: 12.5, color: c.mute2 }}>Tonight</Text>
        </View>
        <FeedTabs />
        <View style={{ gap: 16 }}>
          <LiveCard
            peelId="peelDiscover"
            peelCorner={peelCorner}
            status="LIVE · 22M"
            title="Sunset set on Lot D roof"
            meta="Lot D rooftop · 4 min · Maya J"
            people={['MJ', 'AT', 'RK']}
            tail="+11 here"
          />
          <View style={{ paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: c.hair }}>
            <FeedRow
              status="9:30 PM"
              statusColor={c.blue}
              title="Econ 121 cram, no fear"
              meta="Powell Library, floor 2 · 8 min · 6 of 20 seats"
            />
          </View>
          <FeedRow status="SAT 2 PM" statusColor={c.blue} title="Thrift swap on Bruin Walk" />
        </View>
      </Body>

      <TabBar active="discover" />
    </View>
  );
}

/**
 * Discover as a '29 viewer. The three junior/senior-only rooms are absent —
 * from the list, from the map, and from the headline count.
 */
export function DiscoverFreshman({ peelCorner = true }: { peelCorner?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <DiscoverMap>
        <MapPin left={104} top={236} title="Diddy Riese run" sub="6 here" />
        <View style={{ position: 'absolute', left: 268, top: 196 }}>
          <Dot color={c.blue} size={9} />
        </View>
      </DiscoverMap>

      <Body style={{ borderTopWidth: 1, borderTopColor: c.frame }} contentStyle={feedPad}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Text
            style={{
              fontFamily: font.bold,
              fontSize: 17,
              letterSpacing: em(-0.015, 17),
              color: c.ink,
            }}>
            2 rooms live nearby
          </Text>
          <Text style={{ fontFamily: font.regular, fontSize: 12.5, color: c.mute2 }}>Tonight</Text>
        </View>
        <FeedTabs />
        <View style={{ gap: 16 }}>
          <LiveCard
            peelId="peelFreshman"
            peelCorner={peelCorner}
            status="LIVE · 8M"
            title="Diddy Riese run, then the hill"
            meta="Broxton Ave · 6 min · Sam P"
            people={['SP', 'EM', 'JC']}
            tail="+3 here"
          />
          <View style={{ paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: c.hair }}>
            <FeedRow
              status="LIVE · 41M"
              statusColor={c.green}
              pulse
              title="Hedrick lounge, bad movie"
              meta="Hedrick Hall, floor 1 · 3 min · 9 here"
            />
          </View>
          <FeedRow status="SAT 2 PM" statusColor={c.blue} title="Thrift swap on Bruin Walk" />
        </View>
      </Body>

      <TabBar active="discover" />
    </View>
  );
}

/** Nothing live within 15 minutes. */
export function DiscoverEmpty() {
  const { c } = useTheme();
  const { go } = useNav();
  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <MapPlate cellW={100} cellH={120} style={{ height: 300 }}>
        <View
          style={{ position: 'absolute', left: 0, top: 210, width: 210, height: 150, backgroundColor: c.park }}
        />
        <View
          style={{ position: 'absolute', left: -30, top: 112, width: 460, height: 14, backgroundColor: c.water }}
        />
        <View
          style={{
            position: 'absolute',
            left: 139,
            top: 170,
            width: 70,
            height: 70,
            borderRadius: radius.round,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: c.dash,
          }}
        />
        <View style={{ position: 'absolute', left: 166, top: 197 }}>
          <Dot color={c.dotMute} size={14} outline />
        </View>
        <MapSearchBar />
      </MapPlate>

      <Body
        style={{ borderTopWidth: 1, borderTopColor: c.frame }}
        contentStyle={{ paddingTop: 26, paddingHorizontal: 22, paddingBottom: 92, gap: 22 }}>
        <View>
          <StatusLine label="NOTHING LIVE WITHIN 15 MIN" color={c.mute2} outline />
          <Text
            style={[
              type.display,
              { fontSize: 24, lineHeight: 24 * 1.2, letterSpacing: em(-0.022, 24), color: c.ink, marginTop: 12 },
            ]}>
            Quiet out there.{'\n'}Tuesdays usually are.
          </Text>
          <Text
            style={{
              fontFamily: font.regular,
              fontSize: 14,
              lineHeight: 14 * 1.55,
              color: c.mute,
              marginTop: 10,
              maxWidth: 300,
            }}>
            31 rooms opened near campus last week. A blanket and a speaker is a room — takes about
            forty seconds.
          </Text>
        </View>

        <PrimaryButton label="Open a room" onPress={() => go('create1')} />

        <View style={{ gap: 14, paddingTop: 20, borderTopWidth: 1, borderTopColor: c.hair }}>
          <Text style={[type.eyebrow, { color: c.mute2 }]}>LATER THIS WEEK</Text>
          <View>
            <StatusLine label="THU 9:30 PM" color={c.blue} small />
            <Text
              style={{
                fontFamily: font.bold,
                fontSize: 17,
                letterSpacing: em(-0.018, 17),
                color: c.ink,
                marginTop: 6,
              }}>
              Econ 121 cram, no fear
            </Text>
            <Text style={{ fontFamily: font.regular, fontSize: 12.5, color: c.mute, marginTop: 3 }}>
              Powell Library, floor 2 · 6 of 20 seats
            </Text>
          </View>
          <View style={{ paddingTop: 14, borderTopWidth: 1, borderTopColor: c.hairFaint }}>
            <StatusLine label="SAT 2 PM" color={c.blue} small />
            <Text
              style={{
                fontFamily: font.bold,
                fontSize: 17,
                letterSpacing: em(-0.018, 17),
                color: c.ink,
                marginTop: 6,
              }}>
              Thrift swap on Bruin Walk
            </Text>
            <Text style={{ fontFamily: font.regular, fontSize: 12.5, color: c.mute, marginTop: 3 }}>
              Bruin Walk · 9 saved a seat
            </Text>
          </View>
        </View>
      </Body>

      <TabBar active="discover" />
    </View>
  );
}
