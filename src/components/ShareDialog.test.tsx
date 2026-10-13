import type { ReactNode } from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShareDialog } from './ShareDialog';
import { buildShareBundle } from '../sharing/bundle';
import {
  createShare,
  getSharingConfig,
  getMonthlyShareBlock,
  ShareError,
} from '../sharing/client';
import { I18nProvider, LANGUAGE_KEY } from '../i18n';
import type { ShareBundle } from '../../shared/share-contract';

vi.mock('./Modal', () => ({
  Modal: ({ children, title }: { children: ReactNode; title: string }) => (
    <section role="dialog" aria-label={title}>
      {children}
    </section>
  ),
}));
vi.mock('../sharing/bundle', async (original) => ({
  ...(await original<object>()),
  buildShareBundle: vi.fn(),
}));
vi.mock('../sharing/client', async (original) => ({
  ...(await original<object>()),
  createShare: vi.fn(),
  getSharingConfig: vi.fn(),
  getMonthlyShareBlock: vi.fn(),
}));
const bundle: ShareBundle = {
  format: 'learnmd-share',
  version: 1,
  kind: 'note',
  title: 'Shared chapter',
  notes: [
    {
      id: 'n1',
      title: 'Shared chapter',
      source: 'A useful explanation',
      folderId: null,
    },
  ],
  folders: [],
  assets: [],
};
beforeEach(() => {
  vi.mocked(buildShareBundle).mockReset().mockResolvedValue(bundle);
  vi.mocked(createShare).mockReset();
  vi.mocked(getMonthlyShareBlock).mockReset().mockReturnValue(null);
  vi.mocked(getSharingConfig).mockReturnValue({
    apiUrl: 'http://localhost:8787',
    siteKey: '',
    devBypass: true,
    canCreate: true,
  });
  localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe('sharing dialog', () => {
  it('shows a localized reset date instead of a long countdown and waits for a manual upload after reset', async () => {
    const resetAt = Date.UTC(2026, 10, 1);
    const receivedAt = resetAt - 3600000;
    vi.useFakeTimers();
    vi.setSystemTime(receivedAt);
    localStorage.setItem(LANGUAGE_KEY, 'pl');
    vi.mocked(getMonthlyShareBlock).mockImplementation(() =>
      Date.now() < resetAt ? { resetAt, retryAt: resetAt, receivedAt } : null,
    );
    render(
      <I18nProvider>
        <ShareDialog target={{ type: 'note', id: 'n1' }} onClose={() => {}} />
      </I18nProvider>,
    );
    await act(async () => {});
    expect(screen.getByRole('status')).toHaveTextContent(
      'Udostępnianie wstrzymane do',
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Twoje lokalne notatki są nadal dostępne',
    );
    expect(screen.queryByText(/Spróbuj ponownie za/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Utwórz link' })).toBeDisabled();
    await act(() => vi.advanceTimersByTimeAsync(3600000));
    expect(screen.getByRole('button', { name: 'Utwórz link' })).toBeEnabled();
    expect(createShare).not.toHaveBeenCalled();
  });
  it('explains unavailable sharing without preparing or uploading local notes', () => {
    vi.mocked(getSharingConfig).mockReturnValue({
      apiUrl: '',
      siteKey: '',
      devBypass: false,
      canCreate: false,
    });
    render(
      <ShareDialog target={{ type: 'note', id: 'n1' }} onClose={() => {}} />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Link sharing is not available',
    );
    expect(
      screen.queryByRole('button', { name: 'Create link' }),
    ).not.toBeInTheDocument();
    expect(buildShareBundle).not.toHaveBeenCalled();
    expect(createShare).not.toHaveBeenCalled();
  });
  it('explains seven-day expiry and uploads only after an explicit action', async () => {
    vi.mocked(createShare).mockResolvedValue({
      id: 'abcdefghijklmnopqrstuvwxyz123456',
      createdAt: Date.now(),
      expiresAt: Date.now() + 604800000,
      deleteToken: 'secret',
    });
    render(
      <ShareDialog target={{ type: 'note', id: 'n1' }} onClose={() => {}} />,
    );
    await screen.findByText('Shared chapter');
    expect(screen.getByText('Link valid for 7 days')).toBeVisible();
    expect(createShare).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Create link' }));
    const link = await screen.findByRole('textbox', { name: 'Share link' });
    expect((link as HTMLInputElement).value).toContain(
      '#share/abcdefghijklmnopqrstuvwxyz123456',
    );
    expect(screen.getByText('Expires:')).toBeVisible();
    expect(createShare).toHaveBeenCalledOnce();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('blocked')) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Select and copy the link below',
    );
    expect(link).toBeVisible();
  });
  it('honors the server cooldown before another upload', async () => {
    vi.mocked(createShare).mockRejectedValue(
      new ShareError('rate_limited', 429, 3),
    );
    render(
      <ShareDialog target={{ type: 'note', id: 'n1' }} onClose={() => {}} />,
    );
    await screen.findByText('Shared chapter');
    vi.useFakeTimers();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create link' }));
    });
    expect(screen.getByRole('button', { name: 'Create link' })).toBeDisabled();
    expect(screen.getByText('Try again in 3 seconds.')).toBeVisible();
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(screen.getByRole('button', { name: 'Create link' })).toBeEnabled();
  });
  it('prevents rapid repeated create actions during upload', async () => {
    let finish!: (value: Awaited<ReturnType<typeof createShare>>) => void;
    vi.mocked(createShare).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(
      <ShareDialog target={{ type: 'note', id: 'n1' }} onClose={() => {}} />,
    );
    await screen.findByText('Shared chapter');
    const create = screen.getByRole('button', { name: 'Create link' });
    fireEvent.click(create);
    fireEvent.click(create);
    expect(createShare).toHaveBeenCalledOnce();
    await act(async () => {
      finish({
        id: 'abcdefghijklmnopqrstuvwxyz123456',
        createdAt: Date.now(),
        expiresAt: Date.now() + 604800000,
        deleteToken: 'secret',
      });
    });
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Share link' })).toBeVisible(),
    );
  });
});
