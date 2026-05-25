'use client';

import { FormEvent, useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import type { PhoneNumberResource } from '@clerk/types';
import { CheckCircle2, Loader2, MessageCircle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { syncNotificationPhoneFromClerk } from '@/app/actions/notifications';

function normalizePhone(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith('+')) return `+${trimmed.slice(1).replace(/\D/g, '')}`;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.startsWith('974')) return `+${digits}`;
  return `+974${digits}`;
}

function isValidE164(value: string) {
  return /^\+[1-9]\d{7,14}$/.test(value);
}

export function PhoneRequiredForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, user } = useUser();
  const [phone, setPhone] = useState('+974');
  const [code, setCode] = useState('');
  const [pendingPhone, setPendingPhone] = useState<PhoneNumberResource | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const redirectUrl = useMemo(() => {
    const target = searchParams.get('redirect_url') || '/account';
    return target.startsWith('/account') ? target : '/account';
  }, [searchParams]);

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const normalized = normalizePhone(phone);
    if (!isValidE164(normalized)) {
      setMessage('Enter a valid phone number with country code, for example +974XXXXXXXX.');
      return;
    }
    setMessage(null);
    try {
      const existing = user.phoneNumbers.find((item) => item.phoneNumber === normalized);
      const phoneResource = existing ?? (await user.createPhoneNumber({ phoneNumber: normalized }));
      const prepared = await phoneResource.prepareVerification();
      setPhone(normalized);
      setPendingPhone(prepared);
      setMessage('We sent a verification code to your phone.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not send the verification code.');
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !pendingPhone) return;
    setMessage(null);
    try {
      const verified = await pendingPhone.attemptVerification({ code: code.trim() });
      if (verified.verification.status !== 'verified') {
        setMessage('That code was not verified. Please check it and try again.');
        return;
      }
      await user.update({ primaryPhoneNumberId: verified.id });
      await syncNotificationPhoneFromClerk();
      startTransition(() => {
        router.replace(redirectUrl);
        router.refresh();
      });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not verify that code.');
    }
  }

  if (!isLoaded) {
    return (
      <div className="flex min-h-44 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading account...
      </div>
    );
  }

  const verifiedPhone = user?.phoneNumbers.find(
    (item) => item.verification.status === 'verified',
  );

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 rounded-lg border border-border bg-card p-5 text-card-foreground">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <MessageCircle className="h-5 w-5" />
          </span>
          <div>
            <h2 className="m-0 text-lg font-semibold">Phone number required</h2>
            <p className="m-0 text-sm text-muted-foreground">
              Souqna uses this verified number for WhatsApp order and account messages.
            </p>
          </div>
        </div>

        {verifiedPhone ? (
          <div className="flex items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {verifiedPhone.phoneNumber} is verified.
            </span>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                startTransition(() => {
                  router.replace(redirectUrl);
                  router.refresh();
                });
              }}
              disabled={isPending}
            >
              Continue
            </Button>
          </div>
        ) : null}
      </div>

      {!verifiedPhone && !pendingPhone ? (
        <form onSubmit={requestCode} className="grid gap-3 rounded-lg border border-border bg-card p-5">
          <label className="grid gap-2 text-sm font-medium">
            WhatsApp phone number
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              inputMode="tel"
              autoComplete="tel"
              placeholder="+974XXXXXXXX"
              className="h-11 rounded-md border border-input bg-background px-3 text-base outline-none focus:border-foreground"
              required
            />
          </label>
          <p className="m-0 text-xs leading-5 text-muted-foreground">
            Use an active mobile number in international format. We will send a code before enabling the dashboard.
          </p>
          <Button type="submit" disabled={!user || isPending}>
            Send verification code
          </Button>
        </form>
      ) : null}

      {!verifiedPhone && pendingPhone ? (
        <form onSubmit={verifyCode} className="grid gap-3 rounded-lg border border-border bg-card p-5">
          <label className="grid gap-2 text-sm font-medium">
            Verification code
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              className="h-11 rounded-md border border-input bg-background px-3 text-base outline-none focus:border-foreground"
              required
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={!code.trim() || isPending}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              Verify and continue
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setPendingPhone(null);
                setCode('');
                setMessage(null);
              }}
            >
              Change number
            </Button>
          </div>
        </form>
      ) : null}

      {message ? (
        <p className="m-0 rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}
    </div>
  );
}
