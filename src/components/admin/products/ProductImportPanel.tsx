'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FileUp, Globe2 } from 'lucide-react';
import { importProducts, importProductsFile, importProductsFromWebsite } from '@/app/actions/products';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { Locale } from '@/i18n/locales';

type ImportRow = {
  title: string;
  description?: string;
  priceQar?: number | null;
  imageUrl?: string;
  sourceUrl?: string;
  category?: string;
  status?: 'active' | 'draft' | 'sold_out';
};

type Props = {
  slug: string;
  locale: Locale;
};

export function ProductImportPanel({ slug, locale }: Props) {
  const router = useRouter();
  const [csvName, setCsvName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const preview = useMemo(() => rows.slice(0, 3), [rows]);

  function resetStatus() {
    setMessage(null);
    setError(null);
  }

  async function onFile(file: File | null) {
    resetStatus();
    setCsvName(file?.name ?? '');
    setFile(file);
    setRows([]);
    if (!file) return;
    if (isExcelFile(file)) {
      setMessage('Excel workbook ready to import. Preview appears after import.');
      return;
    }
    const text = await file.text();
    const parsed = parseCsvProducts(text);
    setRows(parsed.rows);
    if (parsed.rows.length > 0) {
      setMessage(`${parsed.rows.length} product${parsed.rows.length === 1 ? '' : 's'} ready to import.`);
    } else {
      setMessage('File ready to import. The server will read the columns when you click Import file.');
    }
  }

  function submitCsv() {
    resetStatus();
    if (!file && rows.length === 0) {
      setError('Choose a CSV or XLSX file with at least one product.');
      return;
    }
    startTransition(async () => {
      let result;
      if (file) {
        const formData = new FormData();
        formData.set('slug', slug);
        formData.set('locale', locale);
        formData.set('file', file);
        result = await importProductsFile(formData);
      } else {
        result = await importProducts({ slug, locale, rows });
      }
      if (result.status === 'error') {
        setError(result.message);
        return;
      }
      setRows([]);
      setCsvName('');
      setFile(null);
      setMessage(`${result.count} product${result.count === 1 ? '' : 's'} imported.`);
      router.refresh();
    });
  }

  function submitWebsite() {
    resetStatus();
    if (!websiteUrl.trim()) {
      setError('Paste a public product or collection URL first.');
      return;
    }
    startTransition(async () => {
      const result = await importProductsFromWebsite({ slug, locale, url: websiteUrl.trim() });
      if (result.status === 'error') {
        setError(result.message);
        return;
      }
      setWebsiteUrl('');
      setMessage(`${result.count} product${result.count === 1 ? '' : 's'} imported from website.`);
      router.refresh();
    });
  }

  return (
    <Card className="grid gap-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="m-0 text-base font-medium">Import products</h3>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Upload CSV/XLSX columns like title, price, image_url, product_url, category,
            description, or the raExportData format. You can also scan a public product page.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <a
            href={sampleCsvDataUrl}
            download="souqna-products-template.csv"
            className="gap-1.5"
          >
            CSV template
          </a>
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-md border border-border/80 bg-background/35 p-3">
          <label className="flex cursor-pointer flex-col gap-2">
            <span className="flex items-center gap-2 text-sm font-medium">
              <FileUp className="h-4 w-4" />
              CSV / Excel import
            </span>
            <input
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={(e) => void onFile(e.currentTarget.files?.[0] ?? null)}
              className="text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-sm file:text-foreground"
            />
          </label>
          {csvName ? (
            <p className="mt-2 font-mono text-[11px] text-muted-foreground">{csvName}</p>
          ) : null}
          {preview.length > 0 ? (
            <ul className="mt-3 grid gap-1.5 text-xs">
              {preview.map((row, index) => (
                <li key={`${row.title}-${index}`} className="truncate text-muted-foreground">
                  <span className="text-foreground">{row.title}</span>
                  {typeof row.priceQar === 'number' ? ` · QAR ${row.priceQar}` : ''}
                </li>
              ))}
            </ul>
          ) : null}
          <Button
            type="button"
            size="sm"
            className="mt-3"
            disabled={pending || (!file && rows.length === 0)}
            onClick={submitCsv}
          >
            {pending ? 'Importing...' : rows.length > 0 ? `Import ${rows.length}` : 'Import file'}
          </Button>
        </div>

        <div className="rounded-md border border-border/80 bg-background/35 p-3">
          <label className="flex flex-col gap-2 text-sm font-medium">
            <span className="flex items-center gap-2">
              <Globe2 className="h-4 w-4" />
              Transfer from website
            </span>
            <input
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://example.com/products/item"
              className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none"
              type="url"
            />
          </label>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Works best with product pages that include JSON-LD, OpenGraph, title, price, and image
            metadata. Protected stores may require CSV.
          </p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="mt-3"
            disabled={pending || !websiteUrl.trim()}
            onClick={submitWebsite}
          >
            {pending ? 'Scanning...' : 'Import from URL'}
          </Button>
        </div>
      </div>

      {error ? <p className="m-0 text-sm text-destructive">{error}</p> : null}
      {message ? <p className="m-0 text-sm text-muted-foreground">{message}</p> : null}
    </Card>
  );
}

function parseCsvProducts(csv: string): { rows: ImportRow[]; errors: string[] } {
  const records = parseCsv(csv).filter((row) => row.some((cell) => cell.trim() !== ''));
  if (records.length < 2) return { rows: [], errors: ['CSV needs a header row and at least one product.'] };
  const headers = records[0]!.map(normalizeHeader);
  const rows: ImportRow[] = [];
  const errors: string[] = [];

  for (const [index, record] of records.slice(1).entries()) {
    const get = (...names: string[]) => {
      for (const name of names) {
        const idx = headers.indexOf(name);
        if (idx >= 0) return record[idx]?.trim() ?? '';
      }
      return '';
    };
    const title =
      get('title', 'name', 'product', 'product_name_en_update', 'product_name_en') ||
      get('product_name_ar_update', 'product_name_ar');
    if (!title) {
      errors.push(`Row ${index + 2}: title is required.`);
      continue;
    }
    const image = get('image_url', 'image', 'picture', 'photo');
    const sourceUrl = get('product_url', 'source_url', 'url', 'link');
    const priceRaw = get('price_qar', 'price', 'qar', 'amount', 'price_global_update');
    const statusRaw = get('status').toLowerCase();
    const status =
      statusRaw === 'draft' || statusRaw === 'sold_out' || statusRaw === 'active'
        ? statusRaw
        : 'active';

    rows.push({
      title,
      description:
        get('description', 'body', 'product_description_en_update', 'product_description_en') ||
        get('product_description_ar_update', 'product_description_ar'),
      priceQar: parsePrice(priceRaw),
      imageUrl: image,
      sourceUrl,
      category: get('category', 'collection', 'type'),
      status,
    });
  }
  return { rows: rows.slice(0, 200), errors };
}

function isExcelFile(file: File): boolean {
  return (
    /\.(xlsx|xls)$/i.test(file.name) ||
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.type === 'application/vnd.ms-excel'
  );
}

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\(([^)]*)\)/g, ' $1 ')
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function parsePrice(value: string): number | null {
  if (!value.trim()) return null;
  const match = value.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const next = input[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

const sampleCsvDataUrl = `data:text/csv;charset=utf-8,${encodeURIComponent(
  'title,description,price,image_url,product_url,category,status\nSignature oud,Premium oud oil,250,https://example.com/oud.jpg,https://example.com/products/oud,Perfume,active\nGift box,Ready-to-send gift set,180,https://example.com/gift.jpg,https://example.com/products/gift-box,Gifts,draft\n',
)}`;
