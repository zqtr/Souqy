'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Surface } from '@/components/admin/primitives';
import { Field, inputStyle, textareaStyle } from '@/components/admin/SettingsForm';
import {
  removeMetaobject,
  saveMarketSettings,
  saveMetaobject,
  saveShippingSettings,
  saveTaxSettings,
  type AdminSettingsActionState,
} from '@/app/actions/adminSettings';
import type {
  MarketSettings,
  Metaobject,
  ShippingRate,
  ShippingSettings,
  TaxProfile,
} from '@/lib/adminSettings';

type DraftRate = Omit<ShippingRate, 'id' | 'profileId' | 'position'> & {
  id?: string;
  profileId?: string;
  position?: number;
};

const EMPTY_STATE: AdminSettingsActionState = { status: 'idle' };

const DEFAULT_RATE: DraftRate = {
  label: 'Qatar delivery',
  countryCode: 'QA',
  city: null,
  amountQar: 25,
  minSubtotalQar: null,
  maxSubtotalQar: null,
  enabled: true,
};

export function ShippingSettingsForm({
  slug,
  initial,
}: {
  slug: string;
  initial: ShippingSettings;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<AdminSettingsActionState>(EMPTY_STATE);
  const [name, setName] = useState(initial.profile?.name ?? 'Default shipping');
  const [enabled, setEnabled] = useState(initial.profile?.enabled ?? true);
  const [freeShippingMinQar, setFreeShippingMinQar] = useState(
    initial.profile?.freeShippingMinQar == null ? '' : String(initial.profile.freeShippingMinQar),
  );
  const [rates, setRates] = useState<DraftRate[]>(
    initial.rates.length > 0 ? initial.rates : [DEFAULT_RATE],
  );
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const enabledRates = rates.filter((rate) => rate.enabled).length;

  const save = () => {
    setState(EMPTY_STATE);
    startTransition(async () => {
      const result = await saveShippingSettings({
        slug,
        name,
        enabled,
        freeShippingMinQar: parseMoney(freeShippingMinQar),
        rates: rates.map((rate) => ({
          label: rate.label,
          countryCode: rate.countryCode,
          city: normalizeNullable(rate.city),
          amountQar: Math.max(0, Math.round(rate.amountQar)),
          minSubtotalQar: rate.minSubtotalQar,
          maxSubtotalQar: rate.maxSubtotalQar,
          enabled: rate.enabled,
        })),
      });
      setState(result);
      if (result.status === 'success') router.refresh();
    });
  };

  const editRate = editingIndex === null ? null : rates[editingIndex] ?? null;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
      className="flex flex-col gap-5"
    >
      <Surface padding={20}>
        <div className="grid gap-4 md:grid-cols-[1.4fr_0.6fr]">
          <Field label="Profile name">
            <input value={name} onChange={(event) => setName(event.target.value)} style={inputStyle} />
          </Field>
          <Field label="Free shipping from (QAR)" hint="Optional. Leave blank to disable.">
            <input
              type="number"
              min={0}
              value={freeShippingMinQar}
              onChange={(event) => setFreeShippingMinQar(event.target.value)}
              style={inputStyle}
            />
          </Field>
        </div>
        <label className="mt-4 flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            className="size-4"
          />
          Enable shipping calculations at checkout
        </label>
      </Surface>

      <Surface padding={0} style={{ overflow: 'hidden' }}>
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="m-0 font-serif text-lg font-medium text-foreground">Shipping rates</h2>
            <p className="m-0 text-sm text-muted-foreground">
              {enabledRates} enabled rate{enabledRates === 1 ? '' : 's'}
            </p>
          </div>
          <Button type="button" onClick={() => setEditingIndex(rates.length)}>
            Add rate
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead>Market</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rates.map((rate, index) => (
              <TableRow key={`${rate.id ?? 'new'}-${index}`}>
                <TableCell className="font-medium">{rate.label}</TableCell>
                <TableCell className="text-muted-foreground">
                  {rate.countryCode}
                  {rate.city ? ` · ${rate.city}` : ''}
                </TableCell>
                <TableCell className="text-right">QAR {rate.amountQar}</TableCell>
                <TableCell>{rate.enabled ? 'Enabled' : 'Disabled'}</TableCell>
                <TableCell className="text-right">
                  <ButtonGroup className="ml-auto">
                    <Button type="button" variant="outline" size="sm" onClick={() => setEditingIndex(index)}>
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setRates((current) => current.filter((_, i) => i !== index))}
                    >
                      Remove
                    </Button>
                  </ButtonGroup>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Surface>

      <SaveFooter pending={pending} state={state} label="Save shipping" />

      <RateDialog
        open={editingIndex !== null}
        rate={editRate ?? DEFAULT_RATE}
        onOpenChange={(open) => {
          if (!open) setEditingIndex(null);
        }}
        onSave={(rate) => {
          setRates((current) => {
            if (editingIndex === null) return current;
            const next = [...current];
            next[editingIndex] = rate;
            return next;
          });
          setEditingIndex(null);
        }}
      />
    </form>
  );
}

function RateDialog({
  open,
  rate,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  rate: DraftRate;
  onOpenChange: (open: boolean) => void;
  onSave: (rate: DraftRate) => void;
}) {
  const [draft, setDraft] = useState<DraftRate>(rate);

  useEffect(() => {
    setDraft(rate);
  }, [rate]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Shipping rate</DialogTitle>
          <DialogDescription>
            Configure a rate that can be applied to checkout totals.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Label">
            <input
              value={draft.label}
              onChange={(event) => setDraft({ ...draft, label: event.target.value })}
              style={inputStyle}
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Country code">
              <input
                value={draft.countryCode}
                onChange={(event) =>
                  setDraft({ ...draft, countryCode: event.target.value.toUpperCase() })
                }
                style={inputStyle}
                maxLength={3}
              />
            </Field>
            <Field label="City" hint="Optional">
              <input
                value={draft.city ?? ''}
                onChange={(event) => setDraft({ ...draft, city: event.target.value })}
                style={inputStyle}
              />
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Amount (QAR)">
              <input
                type="number"
                min={0}
                value={draft.amountQar}
                onChange={(event) =>
                  setDraft({ ...draft, amountQar: parseMoney(event.target.value) ?? 0 })
                }
                style={inputStyle}
              />
            </Field>
            <Field label="Min subtotal">
              <input
                type="number"
                min={0}
                value={draft.minSubtotalQar ?? ''}
                onChange={(event) =>
                  setDraft({ ...draft, minSubtotalQar: parseMoney(event.target.value) })
                }
                style={inputStyle}
              />
            </Field>
            <Field label="Max subtotal">
              <input
                type="number"
                min={0}
                value={draft.maxSubtotalQar ?? ''}
                onChange={(event) =>
                  setDraft({ ...draft, maxSubtotalQar: parseMoney(event.target.value) })
                }
                style={inputStyle}
              />
            </Field>
          </div>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
              className="size-4"
            />
            Rate is enabled
          </label>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => onSave(draft)}>
            Save rate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TaxSettingsForm({
  slug,
  initial,
}: {
  slug: string;
  initial: TaxProfile | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<AdminSettingsActionState>(EMPTY_STATE);
  const [name, setName] = useState(initial?.name ?? 'Default tax');
  const [enabled, setEnabled] = useState(initial?.enabled ?? false);
  const [rate, setRate] = useState(String((initial?.rateBps ?? 0) / 100));
  const [includedInPrices, setIncludedInPrices] = useState(initial?.includedInPrices ?? false);
  const [appliesToShipping, setAppliesToShipping] = useState(initial?.appliesToShipping ?? false);
  const [registrationNumber, setRegistrationNumber] = useState(initial?.registrationNumber ?? '');
  const rateBps = Math.round((Number.parseFloat(rate || '0') || 0) * 100);

  const save = () => {
    setState(EMPTY_STATE);
    startTransition(async () => {
      const result = await saveTaxSettings({
        slug,
        name,
        enabled,
        rateBps,
        includedInPrices,
        appliesToShipping,
        registrationNumber: normalizeNullable(registrationNumber),
      });
      setState(result);
      if (result.status === 'success') router.refresh();
    });
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
      className="flex flex-col gap-5"
    >
      <Surface padding={20}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="m-0 font-serif text-lg font-medium text-foreground">Tax profile</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Applies to checkout and manual-order calculations when enabled.
            </p>
          </div>
          <span className="font-mono text-sm text-muted-foreground">
            {(rateBps / 100).toFixed(2)}%
          </span>
        </div>
        <Progress value={Math.min(rateBps / 100, 100)} className="mt-4" />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Profile name">
            <input value={name} onChange={(event) => setName(event.target.value)} style={inputStyle} />
          </Field>
          <Field label="Rate percentage">
            <input
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={rate}
              onChange={(event) => setRate(event.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="Tax registration number" hint="Optional">
            <input
              value={registrationNumber}
              onChange={(event) => setRegistrationNumber(event.target.value)}
              style={inputStyle}
            />
          </Field>
        </div>
        <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
          <Toggle checked={enabled} onChange={setEnabled} label="Enable tax" />
          <Toggle checked={includedInPrices} onChange={setIncludedInPrices} label="Prices include tax" />
          <Toggle checked={appliesToShipping} onChange={setAppliesToShipping} label="Tax shipping" />
        </div>
      </Surface>
      <SaveFooter pending={pending} state={state} label="Save tax profile" />
    </form>
  );
}

export function MarketSettingsForm({
  slug,
  initial,
}: {
  slug: string;
  initial: MarketSettings;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<AdminSettingsActionState>(EMPTY_STATE);
  const [primaryCurrency, setPrimaryCurrency] = useState(initial.primaryCurrency);
  const [enabledCurrencies, setEnabledCurrencies] = useState(initial.enabledCurrencies);
  const [primaryLanguage, setPrimaryLanguage] = useState<'en' | 'ar'>(initial.primaryLanguage);
  const [enabledLanguages, setEnabledLanguages] = useState<Array<'en' | 'ar'>>(initial.enabledLanguages);
  const [defaultCountry, setDefaultCountry] = useState(initial.defaultCountry);
  const [sellingRegions, setSellingRegions] = useState(initial.sellingRegions.join(', '));

  const save = () => {
    setState(EMPTY_STATE);
    startTransition(async () => {
      const result = await saveMarketSettings({
        slug,
        primaryCurrency,
        enabledCurrencies,
        primaryLanguage,
        enabledLanguages,
        defaultCountry,
        sellingRegions: sellingRegions
          .split(',')
          .map((region) => region.trim().toUpperCase())
          .filter(Boolean),
      });
      setState(result);
      if (result.status === 'success') router.refresh();
    });
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
      className="flex flex-col gap-5"
    >
      <Surface padding={20}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Primary currency">
            <select
              value={primaryCurrency}
              onChange={(event) => setPrimaryCurrency(event.target.value)}
              style={inputStyle}
            >
              {['QAR', 'SAR', 'AED', 'KWD', 'USD'].map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Default country">
            <input
              value={defaultCountry}
              onChange={(event) => setDefaultCountry(event.target.value.toUpperCase())}
              style={inputStyle}
              maxLength={3}
            />
          </Field>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <CheckGroup
            label="Enabled currencies"
            options={['QAR', 'SAR', 'AED', 'KWD', 'USD']}
            selected={enabledCurrencies}
            onChange={setEnabledCurrencies}
          />
          <CheckGroup
            label="Enabled languages"
            options={['en', 'ar']}
            selected={enabledLanguages}
            onChange={(values) => setEnabledLanguages(values as Array<'en' | 'ar'>)}
          />
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Primary language">
            <select
              value={primaryLanguage}
              onChange={(event) => setPrimaryLanguage(event.target.value as 'en' | 'ar')}
              style={inputStyle}
            >
              <option value="en">English</option>
              <option value="ar">Arabic</option>
            </select>
          </Field>
          <Field label="Selling regions" hint="Comma-separated ISO country codes.">
            <input
              value={sellingRegions}
              onChange={(event) => setSellingRegions(event.target.value)}
              style={inputStyle}
            />
          </Field>
        </div>
      </Surface>
      <SaveFooter pending={pending} state={state} label="Save markets" />
    </form>
  );
}

export function CustomDataManager({
  slug,
  records,
}: {
  slug: string;
  records: Metaobject[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<AdminSettingsActionState>(EMPTY_STATE);
  const [editing, setEditing] = useState<Metaobject | null>(null);
  const [createKind, setCreateKind] = useState<MetaKind | null>(null);
  const [deleting, setDeleting] = useState<Metaobject | null>(null);
  const byKind = useMemo(() => {
    const map = new Map<MetaKind, Metaobject[]>();
    for (const kind of META_KINDS) map.set(kind, []);
    for (const record of records) {
      if (isMetaKind(record.kind)) {
        map.get(record.kind)?.push(record);
      }
    }
    return map;
  }, [records]);

  const deleteRecord = () => {
    if (!deleting) return;
    setState(EMPTY_STATE);
    startTransition(async () => {
      const result = await removeMetaobject({ slug, id: deleting.id });
      setState(result);
      setDeleting(null);
      if (result.status === 'success') router.refresh();
    });
  };

  return (
    <>
      <Tabs defaultValue="faq">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            {META_KINDS.map((kind) => (
              <TabsTrigger key={kind} value={kind}>
                {kindLabel(kind)}
              </TabsTrigger>
            ))}
          </TabsList>
          {state.status === 'error' ? (
            <span role="alert" className="text-sm text-destructive">
              {state.message}
            </span>
          ) : state.status === 'success' ? (
            <span role="status" className="text-sm text-[color:var(--admin-accent)]">
              Saved {new Date(state.updatedAt).toLocaleTimeString('en-GB')}
            </span>
          ) : null}
        </div>

        {META_KINDS.map((kind) => (
          <TabsContent key={kind} value={kind} className="mt-4">
            <Surface padding={0} style={{ overflow: 'hidden' }}>
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div>
                  <h2 className="m-0 font-serif text-lg font-medium text-foreground">
                    {kindLabel(kind)}
                  </h2>
                  <p className="m-0 text-sm text-muted-foreground">
                    {(byKind.get(kind) ?? []).length} record{(byKind.get(kind) ?? []).length === 1 ? '' : 's'}
                  </p>
                </div>
                <Button type="button" onClick={() => setCreateKind(kind)}>
                  Add {kindLabel(kind)}
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Preview</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(byKind.get(kind) ?? []).map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-mono text-xs">{record.key}</TableCell>
                      <TableCell>{record.displayName ?? '-'}</TableCell>
                      <TableCell className="max-w-[360px] truncate text-muted-foreground">
                        {previewMeta(record)}
                      </TableCell>
                      <TableCell className="text-right">
                        <ButtonGroup className="ml-auto">
                          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(record)}>
                            Edit
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => setDeleting(record)}>
                            Delete
                          </Button>
                        </ButtonGroup>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(byKind.get(kind) ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-10 text-muted-foreground">
                        No {kindLabel(kind).toLowerCase()} records yet.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </Surface>
          </TabsContent>
        ))}
      </Tabs>

      <MetaobjectDialog
        slug={slug}
        record={editing}
        kind={createKind}
        open={Boolean(editing || createKind)}
        pending={pending}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
            setCreateKind(null);
          }
        }}
        onSaved={(result) => {
          setState(result);
          if (result.status === 'success') router.refresh();
          setEditing(null);
          setCreateKind(null);
        }}
      />

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete custom data?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the record from the storefront data layer. Blocks using this key may stop rendering that content.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteRecord}>
              {pending ? <Spinner className="mr-2 size-4" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

type MetaKind = 'faq' | 'testimonial' | 'spec' | 'press_logo';
const META_KINDS: MetaKind[] = ['faq', 'testimonial', 'spec', 'press_logo'];

function MetaobjectDialog({
  slug,
  record,
  kind,
  open,
  pending,
  onOpenChange,
  onSaved,
}: {
  slug: string;
  record: Metaobject | null;
  kind: MetaKind | null;
  open: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (state: AdminSettingsActionState) => void;
}) {
  const [isSaving, startTransition] = useTransition();
  const currentKind = (record?.kind as MetaKind | undefined) ?? kind ?? 'faq';
  const [key, setKey] = useState(record?.key ?? '');
  const [displayName, setDisplayName] = useState(record?.displayName ?? '');
  const [fieldA, setFieldA] = useState(String(primaryField(record, currentKind) ?? ''));
  const [fieldB, setFieldB] = useState(String(secondaryField(record, currentKind) ?? ''));

  useEffect(() => {
    const nextKind = (record?.kind as MetaKind | undefined) ?? kind ?? 'faq';
    setKey(record?.key ?? '');
    setDisplayName(record?.displayName ?? '');
    setFieldA(String(primaryField(record, nextKind) ?? ''));
    setFieldB(String(secondaryField(record, nextKind) ?? ''));
  }, [record, kind]);

  const labels = metaFieldLabels(currentKind);
  const save = () => {
    startTransition(async () => {
      const result = await saveMetaobject({
        slug,
        namespace: 'app',
        kind: currentKind,
        key,
        displayName: normalizeNullable(displayName),
        fields: buildMetaFields(currentKind, fieldA, fieldB),
      });
      onSaved(result);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{record ? 'Edit' : 'Add'} {kindLabel(currentKind)}</DialogTitle>
          <DialogDescription>
            Custom data can be reused by storefront blocks and future builder sections.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Key">
            <input value={key} onChange={(event) => setKey(event.target.value)} style={inputStyle} />
          </Field>
          <Field label="Display name">
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label={labels.a}>
            {labels.longA ? (
              <textarea value={fieldA} onChange={(event) => setFieldA(event.target.value)} style={textareaStyle} />
            ) : (
              <input value={fieldA} onChange={(event) => setFieldA(event.target.value)} style={inputStyle} />
            )}
          </Field>
          <Field label={labels.b}>
            {labels.longB ? (
              <textarea value={fieldB} onChange={(event) => setFieldB(event.target.value)} style={textareaStyle} />
            ) : (
              <input value={fieldB} onChange={(event) => setFieldB(event.target.value)} style={inputStyle} />
            )}
          </Field>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={isSaving || pending}>
            {isSaving || pending ? <Spinner className="mr-2 size-4" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SaveFooter({
  pending,
  state,
  label,
}: {
  pending: boolean;
  state: AdminSettingsActionState;
  label: string;
}) {
  return (
    <footer className="flex items-center justify-end gap-3">
      {state.status === 'error' ? (
        <span role="alert" className="text-sm text-destructive">
          {state.message}
        </span>
      ) : state.status === 'success' ? (
        <span role="status" className="text-sm text-[color:var(--admin-accent)]">
          Saved {new Date(state.updatedAt).toLocaleTimeString('en-GB')}
        </span>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? <Spinner className="mr-2 size-4" /> : null}
        {label}
      </Button>
    </footer>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4"
      />
      <span>{label}</span>
    </label>
  );
}

function CheckGroup({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const toggle = (option: string) => {
    onChange(
      selected.includes(option)
        ? selected.filter((value) => value !== option)
        : [...selected, option],
    );
  };

  return (
    <fieldset className="rounded-md border border-border p-3">
      <legend className="px-1 text-sm font-medium">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => (
          <label key={option} className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(option)}
              onChange={() => toggle(option)}
              className="size-4"
            />
            {option.toUpperCase()}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function parseMoney(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = typeof value === 'number' ? value : Number.parseInt(value, 10);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function normalizeNullable(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isMetaKind(kind: string): kind is MetaKind {
  return kind === 'faq' || kind === 'testimonial' || kind === 'spec' || kind === 'press_logo';
}

function kindLabel(kind: MetaKind): string {
  return {
    faq: 'FAQs',
    testimonial: 'Testimonials',
    spec: 'Specs',
    press_logo: 'Press logos',
  }[kind];
}

function metaFieldLabels(kind: MetaKind): { a: string; b: string; longA?: boolean; longB?: boolean } {
  if (kind === 'faq') return { a: 'Question', b: 'Answer', longB: true };
  if (kind === 'testimonial') return { a: 'Quote', b: 'Author', longA: true };
  if (kind === 'press_logo') return { a: 'Logo URL', b: 'Alt text' };
  return { a: 'Name', b: 'Value' };
}

function primaryField(record: Metaobject | null, kind: MetaKind): unknown {
  if (!record) return '';
  if (kind === 'faq') return record.fields.question;
  if (kind === 'testimonial') return record.fields.quote;
  if (kind === 'press_logo') return record.fields.url;
  return record.fields.name;
}

function secondaryField(record: Metaobject | null, kind: MetaKind): unknown {
  if (!record) return '';
  if (kind === 'faq') return record.fields.answer;
  if (kind === 'testimonial') return record.fields.author;
  if (kind === 'press_logo') return record.fields.alt;
  return record.fields.value;
}

function buildMetaFields(kind: MetaKind, a: string, b: string): Record<string, unknown> {
  if (kind === 'faq') return { question: a, answer: b };
  if (kind === 'testimonial') return { quote: a, author: b };
  if (kind === 'press_logo') return { url: a, alt: b };
  return { name: a, value: b };
}

function previewMeta(record: Metaobject): string {
  if (record.kind === 'faq') return String(record.fields.question ?? record.fields.answer ?? '');
  if (record.kind === 'testimonial') return String(record.fields.quote ?? record.fields.author ?? '');
  if (record.kind === 'press_logo') return String(record.fields.url ?? record.fields.alt ?? '');
  return String(record.fields.name ?? record.fields.value ?? '');
}
