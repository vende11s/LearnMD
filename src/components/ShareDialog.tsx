import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Link2, Share2 } from 'lucide-react';
import type { ShareBundle, ShareTarget } from '../../shared/share-contract';
import { buildShareBundle } from '../sharing/bundle';
import { ShareSourceLimitError } from '../sharing/sourceBudget';
import {
  createShare,
  deleteShare,
  getSharingConfig,
  rememberOwnedShare,
  shareErrorText,
  shareLink,
  ShareError,
  type CreatedShare,
} from '../sharing/client';
import { useShareCooldown } from '../sharing/useShareCooldown';
import { useI18n } from '../i18n';
import { Modal } from './Modal';
import { ShareVerification } from './ShareVerification';
import './share-dialog.css';

export function ShareDialog({
  target,
  onClose,
}: {
  target: ShareTarget;
  onClose: () => void;
}) {
  const { t, language } = useI18n();
  const config = getSharingConfig();
  const [bundle, setBundle] = useState<ShareBundle | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [share, setShare] = useState<CreatedShare | null>(null);
  const [removed, setRemoved] = useState(false);
  const [savedOwner, setSavedOwner] = useState(true);
  const [copied, setCopied] = useState(false);
  const [token, setToken] = useState(
    config.devBypass ? 'local-development' : '',
  );
  const [verification, setVerification] = useState(0);
  const request = useRef<AbortController | null>(null);
  const lock = useRef(false);
  const alive = useRef(true);
  const { remaining, monthlyBlock, monthlyMessage, handleRateLimit } =
    useShareCooldown();
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      request.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!config.canCreate) return;
    let live = true;
    setBundle(null);
    void buildShareBundle(target)
      .then((value) => {
        if (live) setBundle(value);
      })
      .catch((failure) => {
        if (live)
          setError(
            failure instanceof Error &&
              !(failure instanceof ShareSourceLimitError)
              ? failure.message
              : shareErrorText(failure, t),
          );
      });
    return () => {
      live = false;
    };
  }, [target.type, target.id, config.canCreate, t]);
  async function create() {
    if (!bundle || !token || lock.current || remaining || monthlyBlock) return;
    lock.current = true;
    setBusy(true);
    setError('');
    request.current = new AbortController();
    try {
      const result = await createShare(bundle, token, request.current.signal);
      const saved = rememberOwnedShare(result);
      if (!alive.current) return;
      setShare(result);
      setSavedOwner(saved);
    } catch (failure) {
      if (!alive.current || request.current.signal.aborted) return;
      setError(
        failure instanceof ShareError &&
          failure.code === 'monthly_limit' &&
          failure.resetAt
          ? ''
          : shareErrorText(failure, t),
      );
      handleRateLimit(failure);
      if (!config.devBypass) {
        setToken('');
        setVerification((value) => value + 1);
      }
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function disable() {
    if (!share || lock.current || remaining) return;
    lock.current = true;
    setBusy(true);
    setError('');
    request.current = new AbortController();
    try {
      await deleteShare(share.id, share.deleteToken, request.current.signal);
      if (alive.current) setRemoved(true);
    } catch (failure) {
      if (alive.current && !request.current.signal.aborted) {
        setError(shareErrorText(failure, t));
        handleRateLimit(failure);
      }
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function copy() {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(shareLink(share.id));
      if (alive.current) {
        setCopied(true);
        setError('');
      }
    } catch {
      if (alive.current)
        setError(
          t(
            'Clipboard access is unavailable. Select and copy the link below.',
            'Schowek jest niedostępny. Zaznacz i skopiuj link poniżej.',
          ),
        );
    }
  }
  return (
    <Modal
      title={t('Share a copy', 'Udostępnij kopię')}
      onClose={() => {
        if (!lock.current) onClose();
      }}
    >
      <div className="share-lifetime">
        <Link2 size={19} />
        <strong>{t('Link valid for 7 days', 'Link ważny przez 7 dni')}</strong>
      </div>
      {!config.canCreate ? (
        <div className="share-unavailable" role="status">
          <p>
            {t(
              'Link sharing is not available in this installation yet.',
              'Udostępnianie linkiem nie jest jeszcze dostępne w tej wersji aplikacji.',
            )}
          </p>
          <p className="fineprint">
            {t(
              'You can still export your notes from Settings → Export library.',
              'Nadal możesz wyeksportować notatki przez Ustawienia → Eksportuj bibliotekę.',
            )}
          </p>
        </div>
      ) : removed ? (
        <p role="status">
          {t(
            'Link disabled. Copies already imported remain in their recipients’ libraries.',
            'Link wyłączony. Wcześniej zaimportowane kopie pozostają w bibliotekach odbiorców.',
          )}
        </p>
      ) : share ? (
        <>
          <p className="share-success" role="status">
            <Check size={18} />
            {t('Your link is ready.', 'Twój link jest gotowy.')}
          </p>
          <p>
            {t('Expires:', 'Wygasa:')}{' '}
            <time dateTime={new Date(share.expiresAt).toISOString()}>
              {new Date(share.expiresAt).toLocaleString(
                language === 'pl' ? 'pl-PL' : 'en-GB',
              )}
            </time>
          </p>
          <label className="field-label">
            {t('Share link', 'Link do udostępnienia')}
            <input
              readOnly
              value={shareLink(share.id)}
              onFocus={(event) => event.currentTarget.select()}
            />
          </label>
          <div className="button-row share-actions">
            <button className="button primary" onClick={() => void copy()}>
              <Copy size={16} />
              {copied
                ? t('Copied', 'Skopiowano')
                : t('Copy link', 'Kopiuj link')}
            </button>
            <a
              className="button secondary"
              href={shareLink(share.id)}
              onClick={onClose}
            >
              {t('Open preview', 'Otwórz podgląd')}
            </a>
          </div>
          <p className="fineprint">
            {t(
              'Anyone with this link can read and import the copy. Changes to your local notes do not update this link.',
              'Każdy z tym linkiem może przeczytać i zaimportować kopię. Zmiany w Twoich lokalnych notatkach nie aktualizują linku.',
            )}
          </p>
          <p className="fineprint">
            {savedOwner
              ? t(
                  'You can disable this link here or on its preview page in this browser. Already imported copies will remain.',
                  'Możesz wyłączyć link tutaj lub na stronie podglądu w tej przeglądarce. Już zaimportowane kopie pozostaną.',
                )
              : t(
                  'This browser could not save the ability to disable the link. You can disable it now; otherwise it will expire after 7 days.',
                  'Przeglądarka nie zapisała możliwości wyłączenia linku. Możesz wyłączyć go teraz; później wygaśnie automatycznie po 7 dniach.',
                )}
          </p>
          <button
            className="text-button danger"
            disabled={busy || remaining > 0}
            onClick={() => void disable()}
          >
            {busy
              ? t('Disabling…', 'Wyłączanie…')
              : t('Disable link', 'Wyłącz link')}
          </button>
        </>
      ) : (
        <>
          {bundle ? (
            <div className="share-summary">
              <Share2 size={23} />
              <div>
                <strong>{bundle.title}</strong>
                <p>
                  {t('Notes', 'Notatki')}: {bundle.notes.length} ·{' '}
                  {t('Folders', 'Foldery')}: {bundle.folders.length} ·{' '}
                  {t('Images', 'Obrazy')}: {bundle.assets.length}
                </p>
              </div>
            </div>
          ) : (
            !error && (
              <p role="status">
                {t('Preparing your copy…', 'Przygotowywanie kopii…')}
              </p>
            )
          )}
          <p>
            {t(
              'A copy of the selected notes and bundled images will be uploaded. Anyone with the link can read and import it into their own library.',
              'Kopia wybranych notatek i dołączonych obrazów trafi do chmury. Każdy z linkiem może ją przeczytać i zaimportować do swojej biblioteki.',
            )}
          </p>
          <p className="fineprint">
            {t(
              'The link expires automatically after 7 days. Imported copies stay available. Later edits to your notes are not shared. Maximum copy size: 20 MB.',
              'Link wygaśnie automatycznie po 7 dniach. Zaimportowane kopie pozostaną dostępne. Późniejsze zmiany w Twoich notatkach nie są udostępniane. Maksymalny rozmiar kopii: 20 MB.',
            )}
          </p>
          {!config.devBypass && bundle && !monthlyBlock && (
            <ShareVerification
              key={verification}
              siteKey={config.siteKey}
              onToken={setToken}
            />
          )}
          <div className="share-actions">
            <button
              className="button primary"
              disabled={
                !bundle ||
                !token ||
                busy ||
                remaining > 0 ||
                Boolean(monthlyBlock)
              }
              onClick={() => void create()}
            >
              <Link2 size={16} />
              {busy
                ? t('Creating link…', 'Tworzenie linku…')
                : t('Create link', 'Utwórz link')}
            </button>
          </div>
        </>
      )}
      {monthlyMessage && (
        <p className="error-banner" role="status">
          {monthlyMessage}
        </p>
      )}
      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}
      {remaining > 0 && (
        <p className="fineprint" role="status">
          {t(
            `Try again in ${remaining} seconds.`,
            `Spróbuj ponownie za ${remaining} s.`,
          )}
        </p>
      )}
    </Modal>
  );
}
