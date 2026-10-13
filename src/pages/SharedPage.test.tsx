import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SharedPage } from './SharedPage';
import { getSharedImport, importShareBundle } from '../sharing/bundle';
import {
  fetchShare,
  deleteShare,
  getMonthlyShareBlock,
  getOwnedShare,
  ShareError,
  type SharedContent,
} from '../sharing/client';
import type { ShareBundle } from '../../shared/share-contract';

vi.mock('../sharing/bundle', async (original) => ({
  ...(await original<object>()),
  getSharedImport: vi.fn(),
  importShareBundle: vi.fn(),
}));
vi.mock('../sharing/client', async (original) => ({
  ...(await original<object>()),
  fetchShare: vi.fn(),
  getOwnedShare: vi.fn(),
  deleteShare: vi.fn(),
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
      source:
        '---\ntitle: Shared chapter\nversion: "1.0"\n---\n\nA useful explanation.',
      folderId: null,
    },
  ],
  folders: [],
  assets: [],
};
const content = (): SharedContent => ({
  bundle,
  expiresAt: Date.now() + 604800000,
});
beforeEach(() => {
  vi.mocked(fetchShare).mockReset().mockResolvedValue(content());
  vi.mocked(getOwnedShare).mockReturnValue(null);
  vi.mocked(deleteShare).mockReset().mockResolvedValue(undefined);
  vi.mocked(getMonthlyShareBlock).mockReset().mockReturnValue(null);
  vi.mocked(getSharedImport).mockReset().mockResolvedValue(null);
  vi.mocked(importShareBundle)
    .mockReset()
    .mockResolvedValue({ noteId: 'new-copy', count: 1 });
});
describe('shared preview', () => {
  it('keeps revocation available when the monthly pause prevents preview loading', async () => {
    const now = Date.now();
    const resetAt = Date.UTC(
      new Date(now).getUTCFullYear(),
      new Date(now).getUTCMonth() + 1,
      1,
    );
    const block = { resetAt, retryAt: resetAt, receivedAt: now };
    vi.mocked(getMonthlyShareBlock).mockReturnValue(block);
    vi.mocked(fetchShare).mockRejectedValue(
      new ShareError(
        'monthly_limit',
        429,
        (resetAt - now) / 1000,
        resetAt,
        resetAt,
      ),
    );
    vi.mocked(getOwnedShare).mockReturnValue({
      id: 'abcdefghijklmnopqrstuvwxyz123456',
      createdAt: now,
      expiresAt: now + 604800000,
      deleteToken: 'owner-secret',
    });
    render(
      <SharedPage
        shareId="abcdefghijklmnopqrstuvwxyz123456"
        folders={[]}
        onNavigate={() => {}}
      />,
    );
    await act(async () => {});
    expect(screen.getByText(/Sharing paused until/)).toHaveTextContent(
      'Your local notes are still available',
    );
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDisabled();
    expect(
      screen.queryByText(/Try again in .* seconds/),
    ).not.toBeInTheDocument();
    const disable = screen.getByRole('button', { name: 'Disable link' });
    expect(disable).toBeEnabled();
    fireEvent.click(disable);
    await screen.findByText(/Link disabled/);
    expect(deleteShare).toHaveBeenCalledWith(
      'abcdefghijklmnopqrstuvwxyz123456',
      'owner-secret',
      expect.any(AbortSignal),
    );
    expect(fetchShare).toHaveBeenCalledOnce();
  });
  it('previews readable content without importing, then imports to the selected destination', async () => {
    const onNavigate = vi.fn();
    render(
      <SharedPage
        shareId="abcdefghijklmnopqrstuvwxyz123456"
        folders={[{ id: 'destination', name: 'My studies', parentId: null }]}
        onNavigate={onNavigate}
      />,
    );
    await screen.findByText('A useful explanation.');
    expect(importShareBundle).not.toHaveBeenCalled();
    expect(
      screen.getByText('Link valid for 7 days', { exact: false }),
    ).toBeVisible();
    fireEvent.change(
      screen.getByRole('combobox', { name: 'Destination folder' }),
      { target: { value: 'destination' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add to my library' }));
    await screen.findByText('Already in your library');
    expect(importShareBundle).toHaveBeenCalledWith(
      bundle,
      'destination',
      'abcdefghijklmnopqrstuvwxyz123456',
    );
    expect(onNavigate).toHaveBeenCalledWith('note/new-copy');
  });
  it('offers an existing local copy and requires explicit choice to import another', async () => {
    vi.mocked(getSharedImport).mockResolvedValue({
      noteId: 'previous-copy',
      count: 1,
    });
    const onNavigate = vi.fn();
    render(
      <SharedPage
        shareId="abcdefghijklmnopqrstuvwxyz123456"
        folders={[]}
        onNavigate={onNavigate}
      />,
    );
    await screen.findByText('Already in your library');
    expect(
      screen.queryByRole('button', { name: 'Add to my library' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open imported copy' }));
    expect(onNavigate).toHaveBeenCalledWith('note/previous-copy');
    fireEvent.click(screen.getByRole('button', { name: 'Add another copy' }));
    expect(
      screen.getByRole('button', { name: 'Add to my library' }),
    ).toBeEnabled();
    expect(importShareBundle).not.toHaveBeenCalled();
  });
  it('explains expired links without exposing an import action', async () => {
    vi.mocked(fetchShare).mockRejectedValue(new ShareError('expired', 410));
    render(
      <SharedPage
        shareId="abcdefghijklmnopqrstuvwxyz123456"
        folders={[]}
        onNavigate={() => {}}
      />,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This link has expired',
    );
    expect(
      screen.queryByRole('button', { name: 'Add to my library' }),
    ).not.toBeInTheDocument();
    expect(importShareBundle).not.toHaveBeenCalled();
  });
  it('ignores a stale fetch after changing links', async () => {
    let finish!: (value: SharedContent) => void;
    vi.mocked(fetchShare).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { rerender } = render(
      <SharedPage
        shareId="firstshareabcdefghijklmnopqrstuv"
        folders={[]}
        onNavigate={() => {}}
      />,
    );
    rerender(
      <SharedPage
        shareId="secondshareabcdefghijklmnopqrstu"
        folders={[]}
        onNavigate={() => {}}
      />,
    );
    await screen.findByText('A useful explanation.');
    await act(async () => {
      finish({
        bundle: { ...bundle, title: 'Stale title' },
        expiresAt: Date.now() + 604800000,
      });
    });
    expect(screen.queryByText('Stale title')).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Shared chapter' }),
    ).toBeVisible();
  });
});
