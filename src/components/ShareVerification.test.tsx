import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShareVerification } from './ShareVerification';

afterEach(() => {
  delete window.turnstile;
});
describe('share verification lifecycle', () => {
  it('uses the upload action, clears expired tokens and removes the widget when closed', async () => {
    const onToken = vi.fn();
    const renderWidget = vi.fn().mockReturnValue('widget-1');
    const remove = vi.fn();
    window.turnstile = { render: renderWidget, remove };
    const { unmount } = render(
      <ShareVerification siteKey="public-site-key" onToken={onToken} />,
    );
    await waitFor(() => expect(renderWidget).toHaveBeenCalledOnce());
    const options = renderWidget.mock.calls[0][1];
    expect(options).toMatchObject({
      sitekey: 'public-site-key',
      action: 'share-upload',
      size: 'flexible',
    });
    act(() => options.callback('token-for-upload'));
    expect(onToken).toHaveBeenLastCalledWith('token-for-upload');
    act(() => options['expired-callback']());
    expect(onToken).toHaveBeenLastCalledWith('');
    act(() => options['error-callback']());
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Verification could not load',
    );
    unmount();
    expect(remove).toHaveBeenCalledWith('widget-1');
    options.callback('late-token');
    expect(onToken).toHaveBeenLastCalledWith('');
  });
});
