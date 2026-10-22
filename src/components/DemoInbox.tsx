import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { demoTools, type DemoMail, isDemo } from '@/lib/api';
import { colors } from '@/theme';
import { Banner, Button, H3, P, Row, Small } from './ui';

/**
 * Sadece demo modunda görünür. Gerçek sistemde öğrencinin okul mailine
 * giden e-postayı uygulama içinde gösterir, böylece sunumda akış
 * mail hesabına girmeden gösterilebilir.
 */
export function DemoInbox({
  email,
  kind,
  onOpened,
  onUseCode,
}: {
  email: string;
  kind: 'signup' | 'otp';
  onOpened?: () => void;
  onUseCode?: (code: string) => void;
}) {
  const [mails, setMails] = useState<DemoMail[]>([]);

  const load = useCallback(async () => {
    const all = await demoTools.inbox(email);
    setMails(all.filter((m) => m.kind === kind).slice(0, 1));
  }, [email, kind]);

  useEffect(() => {
    if (!isDemo) return;
    load();
    const off = demoTools.onInboxChange(load);
    return () => {
      off();
    };
  }, [load]);

  if (!isDemo) return null;

  return (
    <Banner kind="demo" title="DEMO GELEN KUTUSU">
      <Small style={{ color: colors.ink, marginBottom: 8 }}>
        Gerçek sistemde bu mail {email || 'öğrencinin okul adresine'} gider. Sunum için burada gösteriliyor.
      </Small>
      {mails.length === 0 ? (
        <P style={{ fontSize: 14 }}>Henüz mail yok.</P>
      ) : (
        mails.map((m) => (
          <View key={m.id} style={{ borderWidth: 2, borderColor: colors.ink, backgroundColor: '#fff', padding: 10 }}>
            <Small>Kimden: no-reply@ugrak.app → {m.to}</Small>
            <H3 style={{ fontSize: 15, marginVertical: 4 }}>{m.subject}</H3>
            {m.kind === 'signup' ? (
              <>
                <P style={{ fontSize: 14, marginBottom: 8 }}>
                  Merhaba! Uğrak’a kaydını tamamlamak için aşağıdaki linke tıkla. Bu adım okul mailinin sana ait
                  olduğunu ve öğrenci olduğunu doğrular.
                </P>
                <Button
                  small
                  variant="success"
                  title={m.opened ? 'Doğrulandı ✓' : 'Adresimi doğrula'}
                  disabled={m.opened}
                  onPress={async () => {
                    await demoTools.openSignupLink(m.id);
                    onOpened?.();
                  }}
                />
              </>
            ) : (
              <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <P style={{ fontSize: 14 }}>
                  Doğrulama kodun: <P style={{ fontWeight: '700', letterSpacing: 3 }}>{m.code}</P>
                </P>
                {onUseCode && m.code ? (
                  <Button small variant="secondary" title="Kodu doldur" onPress={() => onUseCode(m.code!)} />
                ) : null}
              </Row>
            )}
          </View>
        ))
      )}
    </Banner>
  );
}
