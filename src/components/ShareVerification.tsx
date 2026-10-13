import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';

interface TurnstileApi {
  render(
    element: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      language: string;
      size: string;
      callback: (token: string) => void;
      'error-callback': () => void;
      'expired-callback': () => void;
    },
  ): string;
  remove(id: string): void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}
let loading: Promise<TurnstileApi> | undefined;
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loading) return loading;
  loading = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src =
      'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    const timeout = window.setTimeout(fail, 20000);
    function fail() {
      window.clearTimeout(timeout);
      script.remove();
      loading = undefined;
      reject(new Error('verification_unavailable'));
    }
    script.onerror = fail;
    script.onload = () => {
      window.clearTimeout(timeout);
      if (window.turnstile) resolve(window.turnstile);
      else fail();
    };
    document.head.append(script);
  });
  return loading;
}

/** Loaded only when the user opens a configured sharing dialog. */
export function ShareVerification({
  siteKey,
  onToken,
}: {
  siteKey: string;
  onToken: (token: string) => void;
}) {
  const { t, language } = useI18n();
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    let widget: string | undefined;
    let api: TurnstileApi | undefined;
    onToken('');
    setFailed(false);
    void loadTurnstile()
      .then((loaded) => {
        if (!live || !host.current) return;
        api = loaded;
        widget = api.render(host.current, {
          sitekey: siteKey,
          action: 'share-upload',
          language,
          size: 'flexible',
          callback: (token) => {
            if (live) {
              onToken(token);
              setFailed(false);
            }
          },
          'error-callback': () => {
            if (live) {
              onToken('');
              setFailed(true);
            }
          },
          'expired-callback': () => {
            if (live) onToken('');
          },
        });
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
      if (widget !== undefined) api?.remove(widget);
    };
  }, [siteKey, language, attempt, onToken]);
  return (
    <div className="share-verification">
      <p className="fineprint">
        {t(
          'Complete the verification to create a link. Verification is provided by Cloudflare.',
          'Przejdź weryfikację, aby utworzyć link. Weryfikację zapewnia Cloudflare.',
        )}
      </p>
      <div
        ref={host}
        aria-label={t('Sharing verification', 'Weryfikacja udostępniania')}
      />
      {failed && (
        <div role="alert">
          <p>
            {t(
              'Verification could not load. Check your connection or content blocker.',
              'Nie udało się załadować weryfikacji. Sprawdź połączenie lub blokadę treści.',
            )}
          </p>
          <button
            className="text-button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            {t('Retry verification', 'Ponów weryfikację')}
          </button>
        </div>
      )}
    </div>
  );
}
