import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { Scores } from '@/lib/types';
import { CRITERIA, colors, fonts, scoreColor } from '@/theme';
import { Banner, Box, Button, H3, Row, Small } from './ui';

const EMPTY: Scores = { price: 0, study: 0, portion: 0, vibe: 0 };

export function ReviewForm({
  initial,
  initialComment,
  isEdit,
  busy,
  error,
  onSave,
  onDelete,
}: {
  initial?: Scores | null;
  initialComment?: string | null;
  isEdit: boolean;
  busy: boolean;
  error: string | null;
  onSave: (s: Scores, comment: string) => void;
  onDelete?: () => void;
}) {
  const [scores, setScores] = useState<Scores>(initial ?? EMPTY);
  const [comment, setComment] = useState(initialComment ?? '');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    setScores(initial ?? EMPTY);
    setComment(initialComment ?? '');
  }, [initial?.price, initial?.study, initial?.portion, initial?.vibe, initialComment]);

  const complete = Object.values(scores).every((v) => v >= 1);

  return (
    <Box>
      <H3>{isEdit ? 'Puanını düzenle' : 'Puan ver'}</H3>
      <Small style={{ marginBottom: 10 }}>Her öğrenci bir mekana bir kez puan verir; sonra düzenleyebilir.</Small>

      {CRITERIA.map((c) => (
        <View key={c.key} style={{ marginBottom: 10 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: fonts.pixel, fontSize: 14, color: colors.ink }}>{c.label}</Text>
            <Small>{c.hint}</Small>
          </Row>
          <Row style={{ gap: 6, marginTop: 4 }}>
            {[1, 2, 3, 4, 5].map((n) => {
              const on = scores[c.key] >= n;
              return (
                <Pressable
                  key={n}
                  onPress={() => setScores((s) => ({ ...s, [c.key]: n }))}
                  accessibilityRole="button"
                  accessibilityLabel={`${c.label} ${n} puan`}
                  style={{
                    flex: 1,
                    height: 34,
                    borderWidth: 3,
                    borderColor: colors.ink,
                    backgroundColor: on ? scoreColor(scores[c.key]) : colors.paper,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontFamily: fonts.pixel, fontSize: 14, color: colors.ink }}>{n}</Text>
                </Pressable>
              );
            })}
          </Row>
        </View>
      ))}

      <Text style={{ fontFamily: fonts.pixel, fontSize: 14, color: colors.ink, marginTop: 4, marginBottom: 6 }}>
        Yorum (isteğe bağlı)
      </Text>
      <TextInput
        value={comment}
        onChangeText={(t) => setComment(t.slice(0, 500))}
        multiline
        placeholder="Priz var mı, wifi nasıl, porsiyon doyurur mu?"
        placeholderTextColor="#9C9488"
        style={{
          borderWidth: 3,
          borderColor: colors.ink,
          backgroundColor: colors.card,
          minHeight: 90,
          padding: 10,
          fontSize: 15,
          textAlignVertical: 'top',
          color: colors.ink,
        }}
      />
      <Small style={{ textAlign: 'right', marginTop: 4 }}>{comment.length}/500</Small>

      {touched && !complete ? <Banner kind="warn" text="Dört kriterin hepsine puan ver." /> : null}
      {error ? <Banner kind="error" text={error} /> : null}

      <Row style={{ gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
        <Button
          title={isEdit ? 'GÜNCELLE' : 'GÖNDER'}
          variant="success"
          loading={busy}
          onPress={() => {
            setTouched(true);
            if (complete) onSave(scores, comment);
          }}
        />
        {isEdit && onDelete ? <Button title="Sil" variant="danger" small onPress={onDelete} /> : null}
      </Row>
    </Box>
  );
}
