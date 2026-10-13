import { useEffect, useState } from 'react';
import {
  getMonthlyShareBlock,
  monthlyShareMessage,
  SHARE_MONTHLY_BLOCK_EVENT,
  ShareError,
  type MonthlyShareBlock,
} from './client';
import { useI18n } from '../i18n';

export function useShareCooldown() {
  const { t } = useI18n();
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(Date.now);
  const [monthlyBlock, setMonthlyBlock] = useState<MonthlyShareBlock | null>(
    () => getMonthlyShareBlock(),
  );
  const remaining = Math.max(0, Math.ceil((until - now) / 1000));
  useEffect(() => {
    if (!until) return;
    const timer = window.setInterval(() => {
      const time = Date.now();
      setNow(time);
      if (time >= until) setUntil(0);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [until]);
  useEffect(() => {
    const update = () => setMonthlyBlock(getMonthlyShareBlock());
    window.addEventListener(SHARE_MONTHLY_BLOCK_EVENT, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(SHARE_MONTHLY_BLOCK_EVENT, update);
      window.removeEventListener('storage', update);
    };
  }, []);
  useEffect(() => {
    if (!monthlyBlock) return;
    let timer: number;
    const schedule = () => {
      timer = window.setTimeout(
        () => {
          // Re-enable actions only: creating and downloading still require user input.
          const current = getMonthlyShareBlock();
          setMonthlyBlock(current);
          if (current) schedule();
        },
        Math.min(Math.max(1, monthlyBlock.retryAt - Date.now()), 2147483647),
      );
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [monthlyBlock]);
  return {
    remaining,
    monthlyBlock,
    monthlyMessage: monthlyBlock
      ? monthlyShareMessage(monthlyBlock.resetAt, t)
      : '',
    handleRateLimit(error: unknown) {
      if (error instanceof ShareError && error.status === 429) {
        if (error.code === 'monthly_limit') {
          setUntil(0);
          setMonthlyBlock(getMonthlyShareBlock());
          return;
        }
        const time = Date.now();
        setNow(time);
        setUntil(time + Math.max(1, error.retryAfter || 60) * 1000);
      }
    },
  };
}
