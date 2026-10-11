import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider, LANGUAGE_KEY, initialLanguage, useI18n } from './i18n';

function LanguageProbe() {
  const { language, setLanguage, t } = useI18n();
  return (
    <>
      <p>{t('Your library', 'Twoja biblioteka')}</p>
      <span data-testid="language">{language}</span>
      <button onClick={() => setLanguage('en')}>English</button>
      <button onClick={() => setLanguage('pl')}>Polski</button>
    </>
  );
}

beforeEach(() => {
  localStorage.removeItem(LANGUAGE_KEY);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('interface language preferences', () => {
  it('uses Polish for a Polish preferred browser language without persisting a system default', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['pl-PL', 'en-US']);
    render(
      <I18nProvider>
        <LanguageProbe />
      </I18nProvider>,
    );
    expect(screen.getByText('Twoja biblioteka')).toBeVisible();
    expect(document.documentElement.lang).toBe('pl');
    expect(localStorage.getItem(LANGUAGE_KEY)).toBeNull();
  });

  it('defaults other browser languages to English and ignores unsupported saved values', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE', 'pl-PL']);
    localStorage.setItem(LANGUAGE_KEY, 'de');
    expect(initialLanguage()).toBe('en');
  });

  it('an explicit choice overrides the browser and survives remounting', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['pl-PL']);
    const first = render(
      <I18nProvider>
        <LanguageProbe />
      </I18nProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByText('Your library')).toBeVisible();
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem(LANGUAGE_KEY)).toBe('en');
    first.unmount();
    render(
      <I18nProvider>
        <LanguageProbe />
      </I18nProvider>,
    );
    expect(screen.getByText('Your library')).toBeVisible();
  });

  it('continues to translate when persistent preference storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Unavailable');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Unavailable');
    });
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-GB']);
    render(
      <I18nProvider>
        <LanguageProbe />
      </I18nProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Polski' }));
    expect(screen.getByText('Twoja biblioteka')).toBeVisible();
  });

  it('standalone readers receive an English fallback without a provider', () => {
    render(<LanguageProbe />);
    expect(screen.getByText('Your library')).toBeVisible();
  });
});
