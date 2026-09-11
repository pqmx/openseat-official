import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { postUpdate } from '../api';
import { attendeeCountOf, type Room as RoomModel, type Update } from '../data';
import { useWrite } from '../feedback';
import { MAX_UPDATE_LENGTH } from '../room-rules';
import { useSession } from '../session';
import { font, radius, type, useTheme } from '../theme';
import { ago } from '../time';
import { Eyebrow, Footer, NoteItem, PrimaryButton } from './ui';

export const Updates = ({ updates, now, label }: { updates: Update[]; now: Date; label: string }) => {
  const { c } = useTheme();
  const { me } = useSession();
  return (
    <View style={{ gap: 14 }}>
      <Eyebrow>{label}</Eyebrow>
      {updates.length === 0 ? (
        <Text style={{ fontFamily: font.regular, fontSize: 13.5, color: c.mute }}>
          Nothing posted yet.
        </Text>
      ) : (
        updates.map((u, i) => {
          const mine = u.by.id === me?.id;
          return (
            <NoteItem
              key={u.id}
              text={u.text}
              meta={[mine ? 'You' : u.by.name, ago(u.at, now)].join(' · ')}
              accent={i === 0 ? c.green : undefined}
              muted={i > 0}
            />
          );
        })
      )}
    </View>
  );
};

/** Update composer shared by both host views. */
export const UpdateComposer = ({ room, reload }: { room: RoomModel; reload: () => Promise<void> }) => {
  const { c } = useTheme();
  const { me } = useSession();
  const { busy, run } = useWrite();
  const [draft, setDraft] = useState('');
  const post = () => {
    const text = draft.trim();
    if (!text || !me) return;
    run(async () => {
      await postUpdate(room.id, me.id, text);
      setDraft((current) => current === draft ? '' : current);
      await reload();
    });
  };
  return (
    <Footer raised column gap={11}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[type.eyebrow, { color: c.green }]}>POST AN UPDATE · HOST ONLY</Text>
        <Text style={{ fontFamily: font.regular, fontSize: 11.5, color: c.faint }}>
          Visible to {attendeeCountOf(room)} members
        </Text>
      </View>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        multiline
        maxLength={MAX_UPDATE_LENGTH}
        placeholder="Tell the room something"
        placeholderTextColor={c.faint}
        selectionColor={c.coral}
        style={{
          minHeight: 52,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderColor: draft ? c.ink : c.hair2,
          backgroundColor: c.surface,
          fontFamily: font.regular,
          fontSize: 14,
          lineHeight: 14 * 1.45,
          color: c.ink,
        }}
      />
      <View
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Text style={{ fontFamily: font.regular, fontSize: 12, color: c.mute }}>
          {draft.length}/{MAX_UPDATE_LENGTH} · Members read updates here
        </Text>
        <PrimaryButton
          label={busy ? 'Posting…' : 'Post update'}
          height={38}
          disabled={!draft.trim() || busy}
          onPress={post}
          style={{
            paddingHorizontal: 20,
            borderRadius: radius.md,
            backgroundColor: draft.trim() && !busy ? c.coral : c.disabled,
          }}
        />
      </View>
    </Footer>
  );
};

