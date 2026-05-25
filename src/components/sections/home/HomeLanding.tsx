'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Bell,
  Bot,
  BrainCircuit,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Command,
  Database,
  Gauge,
  Globe2,
  LayoutDashboard,
  LineChart,
  PackageCheck,
  PanelLeft,
  PlugZap,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Wand2,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import ChromaCard from '@/components/react-bits/chroma-card';
import DepthCard from '@/components/react-bits/depth-card';
import GlassFlow from '@/components/react-bits/glass-flow';
import type { Copy } from '@/content/copy';
import type { Locale } from '@/i18n/locales';
import { cn } from '@/lib/utils';

type Props = {
  locale: Locale;
  copy: Copy;
};

type DashboardCopy = {
  badge: string;
  title: string;
  subtitle: string;
  primary: string;
  secondary: string;
  workspace: string;
  search: string;
  nav: readonly string[];
  metrics: readonly {
    label: string;
    value: string;
    delta: string;
    icon: IconKey;
  }[];
  assistant: {
    title: string;
    state: string;
    prompt: string;
    reply: string;
  };
  queue: readonly {
    label: string;
    status: string;
    tone: 'green' | 'amber' | 'blue';
  }[];
  model: {
    title: string;
    uptime: string;
    latency: string;
    confidence: string;
  };
  activity: readonly {
    title: string;
    meta: string;
    icon: IconKey;
  }[];
  automations: readonly string[];
  rightRail: {
    title: string;
    live: string;
    usage: string;
    stores: string;
  };
};

type IconKey =
  | 'dashboard'
  | 'orders'
  | 'revenue'
  | 'ai'
  | 'catalog'
  | 'apps'
  | 'growth'
  | 'settings'
  | 'team'
  | 'security';

const dashboardCopy: Record<Locale, DashboardCopy> = {
  en: {
    badge: 'ReactBits Pro dashboard concept',
    title: 'AI SaaS dashboard for Gulf commerce.',
    subtitle:
      'A dense, product-first dashboard where Souqy monitors stores, drafts actions, and keeps commerce operations moving from one workspace.',
    primary: 'Start your build',
    secondary: 'Open dashboard',
    workspace: 'Souqna AI Workspace',
    search: 'Ask Souqy or search stores...',
    nav: ['Overview', 'AI tasks', 'Stores', 'Revenue', 'Apps', 'Settings'],
    metrics: [
      { label: 'Revenue watched', value: 'QR 42.8k', delta: '+18.2%', icon: 'revenue' },
      { label: 'AI tasks closed', value: '186', delta: '+34', icon: 'ai' },
      { label: 'Store health', value: '94%', delta: '+6 pts', icon: 'growth' },
      { label: 'Active apps', value: '12', delta: '+3', icon: 'apps' },
    ],
    assistant: {
      title: 'Souqy operator',
      state: 'Live analysis',
      prompt: 'Find product pages that need Arabic SEO and draft fixes.',
      reply:
        '18 pages found. I drafted titles, reordered mobile bundles, and queued the changes for review.',
    },
    queue: [
      { label: 'Summer collection copy', status: 'Ready for review', tone: 'green' },
      { label: 'WhatsApp recovery flow', status: 'Training', tone: 'blue' },
      { label: 'Payment drop-off audit', status: 'Needs approval', tone: 'amber' },
      { label: 'Arabic metadata pass', status: 'Applied', tone: 'green' },
    ],
    model: {
      title: 'Model routing',
      uptime: '99.98%',
      latency: '420 ms',
      confidence: '91%',
    },
    activity: [
      { title: 'SEO agent applied 42 metadata edits', meta: '2 min ago', icon: 'ai' },
      { title: 'Klaviyo segment synced', meta: '8 min ago', icon: 'apps' },
      { title: 'Low inventory bundle flagged', meta: '14 min ago', icon: 'catalog' },
      { title: 'Checkout trend moved up', meta: '29 min ago', icon: 'growth' },
    ],
    automations: ['SEO drafts', 'Bulk product edits', 'Growth insights', 'Campaign planner'],
    rightRail: {
      title: 'Today in Souqna',
      live: '24 live storefronts',
      usage: '78k AI tokens',
      stores: '6 stores need review',
    },
  },
  ar: {
    badge: 'تصور لوحة ReactBits Pro',
    title: 'لوحة SaaS ذكية لتجارة الخليج.',
    subtitle:
      'واجهة تشغيل كثيفة وواضحة يتابع فيها سوقي المتاجر، يقترح الإجراءات، ويبقي العمل التجاري في مساحة واحدة.',
    primary: 'ابدأ البناء',
    secondary: 'افتح اللوحة',
    workspace: 'مساحة سوقنا الذكية',
    search: 'اسأل سوقي أو ابحث في المتاجر...',
    nav: ['نظرة عامة', 'مهام AI', 'المتاجر', 'الإيراد', 'التطبيقات', 'الإعدادات'],
    metrics: [
      { label: 'الإيراد المتابع', value: '42.8k ر.ق', delta: '+18.2%', icon: 'revenue' },
      { label: 'مهام AI مكتملة', value: '186', delta: '+34', icon: 'ai' },
      { label: 'صحة المتجر', value: '94%', delta: '+6 نقاط', icon: 'growth' },
      { label: 'تطبيقات نشطة', value: '12', delta: '+3', icon: 'apps' },
    ],
    assistant: {
      title: 'مشغل سوقي',
      state: 'تحليل مباشر',
      prompt: 'ابحث عن صفحات المنتجات التي تحتاج SEO عربي وجهز التعديلات.',
      reply:
        'وجدت 18 صفحة. جهزت العناوين، رتبت الباقات على الجوال، وتركت التعديلات للمراجعة.',
    },
    queue: [
      { label: 'نصوص مجموعة الصيف', status: 'جاهزة للمراجعة', tone: 'green' },
      { label: 'استرجاع واتساب', status: 'تدريب', tone: 'blue' },
      { label: 'تدقيق هبوط الدفع', status: 'يحتاج موافقة', tone: 'amber' },
      { label: 'بيانات SEO العربية', status: 'تم التطبيق', tone: 'green' },
    ],
    model: {
      title: 'توجيه النماذج',
      uptime: '99.98%',
      latency: '420 ms',
      confidence: '91%',
    },
    activity: [
      { title: 'وكيل SEO طبق 42 تعديلا', meta: 'قبل دقيقتين', icon: 'ai' },
      { title: 'تمت مزامنة شريحة Klaviyo', meta: 'قبل 8 دقائق', icon: 'apps' },
      { title: 'تنبيه مخزون منخفض للباقات', meta: 'قبل 14 دقيقة', icon: 'catalog' },
      { title: 'تحسن اتجاه الدفع', meta: 'قبل 29 دقيقة', icon: 'growth' },
    ],
    automations: ['مسودات SEO', 'تعديل منتجات جماعي', 'رؤى النمو', 'مخطط الحملات'],
    rightRail: {
      title: 'اليوم في سوقنا',
      live: '24 متجرا مباشرا',
      usage: '78k رموز AI',
      stores: '6 متاجر تحتاج مراجعة',
    },
  },
};

const iconMap: Record<IconKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  orders: PackageCheck,
  revenue: CircleDollarSign,
  ai: BrainCircuit,
  catalog: Database,
  apps: PlugZap,
  growth: LineChart,
  settings: Settings2,
  team: UsersRound,
  security: ShieldCheck,
};

const reactBitsAsset = '/reactbits/ai-dashboard-surface.png';

export function HomeLanding(props: Props) {
  const isRtl = props.locale === 'ar';
  const t = dashboardCopy[props.locale];
  const beginHref = props.locale === 'en' ? '/begin' : `/${props.locale}/begin`;
  const dashboardHref = '/account';
  const [motionReady, setMotionReady] = useState(false);

  useEffect(() => {
    setMotionReady(true);
  }, []);

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[#0d0f0d] text-[#f7f0e6]"
    >
      <section className="relative isolate overflow-hidden px-[var(--gutter)] pb-8 pt-24 sm:pb-12 sm:pt-28">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_12%,rgba(88,141,114,0.24),transparent_34%),linear-gradient(135deg,#0d0f0d_0%,#161711_42%,#261f19_100%)]" />
        <div className="absolute inset-x-0 top-0 -z-10 h-px bg-[#f3d789]/40" />

        <div className="mx-auto max-w-[1480px]">
          <div className="grid gap-5 xl:grid-cols-[0.42fr_1fr] xl:items-center">
            <div className="min-w-0 pb-2 xl:self-start xl:pt-16">
              <div className="inline-flex max-w-full items-center gap-3 rounded-md border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-[#ded7c9] backdrop-blur-xl">
                <Image
                  src="/favicon.svg"
                  alt=""
                  width={92}
                  height={42}
                  priority
                  className="h-6 w-auto"
                />
                <span className="h-4 w-px bg-white/16" aria-hidden />
                <span className="truncate">{t.badge}</span>
              </div>

              <h1 className="mt-8 max-w-[340px] break-words text-[38px] font-semibold leading-[1] tracking-normal text-[#fff8eb] sm:max-w-[640px] sm:text-6xl lg:text-[60px]">
                {t.title}
              </h1>
              <p className="mt-6 max-w-[340px] text-base leading-7 text-[#c9c1b2] sm:max-w-[640px] sm:text-lg">
                {t.subtitle}
              </p>

              <div className="mt-8 flex max-w-[340px] flex-col gap-3 sm:max-w-none sm:flex-row">
                <DashboardLink href={beginHref} icon={ArrowRight} flipIcon={isRtl}>
                  {t.primary}
                </DashboardLink>
                <Link
                  href={dashboardHref}
                  className="inline-flex min-h-12 items-center justify-center rounded-md border border-white/16 px-5 py-3 text-sm font-semibold text-[#fff8eb] no-underline transition hover:bg-white/10"
                >
                  {t.secondary}
                </Link>
              </div>
            </div>

            <DashboardShell t={t} isRtl={isRtl} motionReady={motionReady} />
          </div>
        </div>
      </section>

      <section className="px-[var(--gutter)] pb-20">
        <div className="mx-auto grid max-w-[1480px] gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <AutomationBoard t={t} />
          <ReactBitsShowcase t={t} motionReady={motionReady} />
        </div>
      </section>
    </div>
  );
}

function DashboardShell({
  t,
  isRtl,
  motionReady,
}: {
  t: DashboardCopy;
  isRtl: boolean;
  motionReady: boolean;
}) {
  return (
    <div className="relative min-h-[680px] w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-white/10 bg-[#f4ecdc] text-[#171916] shadow-[0_50px_160px_rgba(0,0,0,0.36)]">
      {motionReady ? (
        <GlassFlow
          imageSrc={reactBitsAsset}
          stripeCount={8}
          angle={isRtl ? 12 : -12}
          refraction={0.045}
          frostAmount={0.14}
          speed={0.06}
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
        />
      ) : null}
      <SurfaceImageOverlay
        priority
        className="z-0 opacity-[0.24] mix-blend-multiply saturate-125 contrast-110"
      />
      <div className="relative z-10 grid min-h-[680px] min-w-0 lg:grid-cols-[72px_1fr_300px]">
        <DashboardSidebar t={t} />
        <main className="min-w-0 border-x border-[#1b1d19]/10 bg-[#f7efe2]/88 backdrop-blur-xl">
          <DashboardTopbar t={t} />
          <div className="grid gap-4 p-4 lg:p-5">
            <MetricGrid metrics={t.metrics} />
            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <AgentPanel t={t} />
              <ModelPanel t={t} motionReady={motionReady} />
            </div>
            <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <QueuePanel t={t} />
              <ChartPanel />
            </div>
          </div>
        </main>
        <RightRail t={t} motionReady={motionReady} />
      </div>
    </div>
  );
}

function DashboardSidebar({ t }: { t: DashboardCopy }) {
  const icons: IconKey[] = ['dashboard', 'ai', 'catalog', 'revenue', 'apps', 'settings'];

  return (
    <aside className="hidden bg-[#121510] px-3 py-4 text-[#d9d0c0] lg:block">
      <div className="flex h-full flex-col items-center justify-between">
        <div className="grid gap-3">
          <button
            type="button"
            aria-label="Navigation"
            className="grid h-11 w-11 place-items-center rounded-md border border-white/10 bg-white/[0.06] text-[#fff8eb]"
          >
            <PanelLeft className="h-5 w-5" aria-hidden />
          </button>
          <div className="mt-2 grid gap-2">
            {t.nav.map((item, index) => {
              const Icon = iconMap[icons[index] ?? 'dashboard'];
              return (
                <button
                  key={item}
                  type="button"
                  aria-label={item}
                  title={item}
                  className={cn(
                    'grid h-11 w-11 place-items-center rounded-md border text-[#d9d0c0] transition hover:bg-white/[0.08]',
                    index === 0
                      ? 'border-[#f1c86a]/45 bg-[#f1c86a]/16 text-[#f8d986]'
                      : 'border-white/8 bg-white/[0.035]',
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-full bg-[#f1c86a] text-[#17150d]">
          <Bot className="h-5 w-5" aria-hidden />
        </div>
      </div>
    </aside>
  );
}

function DashboardTopbar({ t }: { t: DashboardCopy }) {
  return (
    <header className="flex min-h-[72px] flex-col gap-3 border-b border-[#1b1d19]/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-5">
      <div>
        <p className="text-xs font-semibold uppercase text-[#6f6b5e]">{t.workspace}</p>
        <p className="mt-1 text-xl font-semibold text-[#151713]">Command center</p>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <div className="hidden min-h-11 min-w-[240px] items-center gap-2 rounded-md border border-[#1b1d19]/10 bg-white/70 px-3 text-sm text-[#757063] shadow-sm md:flex xl:min-w-[320px]">
          <Search className="h-4 w-4" aria-hidden />
          <span className="truncate">{t.search}</span>
          <Command className="ms-auto h-4 w-4 text-[#9a8e7c]" aria-hidden />
        </div>
        <button
          type="button"
          aria-label="Notifications"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-[#1b1d19]/10 bg-white/70 text-[#1b1d19]"
        >
          <Bell className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </header>
  );
}

function MetricGrid({ metrics }: { metrics: DashboardCopy['metrics'] }) {
  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
      {metrics.map((metric) => {
        const Icon = iconMap[metric.icon];
        return (
          <article
            key={metric.label}
            className="min-h-[134px] min-w-0 rounded-lg border border-[#1b1d19]/10 bg-white/72 p-4 shadow-[0_18px_50px_rgba(50,38,24,0.08)]"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-md bg-[#e6f0df] text-[#1f6b48]">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <span className="whitespace-nowrap rounded-md bg-[#152116] px-2 py-1 text-xs font-semibold text-[#d9f0c2]">
                {metric.delta}
              </span>
            </div>
            <p className="mt-5 text-sm text-[#6d695f]">{metric.label}</p>
            <p className="mt-1 text-3xl font-semibold text-[#11130f]">{metric.value}</p>
          </article>
        );
      })}
    </div>
  );
}

function AgentPanel({ t }: { t: DashboardCopy }) {
  return (
    <section className="rounded-lg border border-[#1b1d19]/10 bg-[#11140f] p-4 text-[#fff8eb]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-[#f1c86a] text-[#15130c]">
            <Wand2 className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{t.assistant.title}</h2>
            <p className="text-sm text-[#bfb7aa]">{t.assistant.state}</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 rounded-md border border-[#9fe29b]/20 bg-[#16381f] px-3 py-1 text-xs text-[#bdf5ad]">
          <span className="h-2 w-2 rounded-full bg-[#95ed80]" />
          online
        </span>
      </div>

      <div className="mt-5 grid gap-3">
        <div className="ms-auto max-w-[86%] rounded-lg bg-[#f1c86a] p-4 text-sm leading-6 text-[#15130c]">
          {t.assistant.prompt}
        </div>
        <div className="max-w-[88%] rounded-lg border border-white/10 bg-white/[0.07] p-4 text-sm leading-6 text-[#ded7ca]">
          {t.assistant.reply}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 2xl:grid-cols-4">
        {t.automations.map((item) => (
          <span
            key={item}
            className="rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-center text-xs text-[#cfc7b8]"
          >
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}

function ModelPanel({ t, motionReady }: { t: DashboardCopy; motionReady: boolean }) {
  return (
    <section className="relative overflow-hidden rounded-lg border border-[#1b1d19]/10 bg-[#223027] p-4 text-[#fff8eb]">
      {motionReady ? (
        <ChromaCard
          imageSrc={reactBitsAsset}
          imageAspectRatio={1.2}
          cardWidth={4.4}
          cardHeight={3.1}
          cameraZ={5.6}
          opacity={0.78}
          borderRadius={8}
          hoverDuration={1.4}
          height="184px"
          className="absolute inset-x-2 top-2 rounded-lg opacity-70"
        />
      ) : null}
      <div className="relative z-10 flex min-h-[260px] flex-col justify-end">
        <p className="text-sm text-[#c8dfc1]">{t.model.title}</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <ModelStat label="Up" value={t.model.uptime} />
          <ModelStat label="Lat" value={t.model.latency} />
          <ModelStat label="Conf" value={t.model.confidence} />
        </div>
      </div>
    </section>
  );
}

function ModelStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#0d0f0d]/72 p-3 backdrop-blur-xl">
      <p className="whitespace-nowrap text-[9px] uppercase text-[#aeb8a5]">{label}</p>
      <p className="mt-2 whitespace-nowrap text-base font-semibold text-[#fff8eb]">{value}</p>
    </div>
  );
}

function QueuePanel({ t }: { t: DashboardCopy }) {
  return (
    <section className="rounded-lg border border-[#1b1d19]/10 bg-white/76 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#151713]">AI queue</h2>
        <Clock3 className="h-5 w-5 text-[#726b5c]" aria-hidden />
      </div>
      <div className="mt-4 grid gap-2">
        {t.queue.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between gap-3 rounded-lg border border-[#1b1d19]/10 bg-[#fbf7ef] p-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#171916]">{item.label}</p>
              <p className="mt-1 text-xs text-[#777164]">{item.status}</p>
            </div>
            <StatusDot tone={item.tone} />
          </div>
        ))}
      </div>
    </section>
  );
}

function StatusDot({ tone }: { tone: DashboardCopy['queue'][number]['tone'] }) {
  return (
    <span
      className={cn(
        'h-3 w-3 shrink-0 rounded-full',
        tone === 'green' && 'bg-[#3bbf6a]',
        tone === 'amber' && 'bg-[#dba83e]',
        tone === 'blue' && 'bg-[#4f8fd8]',
      )}
    />
  );
}

function ChartPanel() {
  const bars = [34, 56, 48, 72, 63, 86, 78, 94, 82, 98, 88, 105];
  return (
    <section className="rounded-lg border border-[#1b1d19]/10 bg-[#171916] p-4 text-[#fff8eb]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Growth forecast</h2>
          <p className="mt-1 text-sm text-[#bab2a5]">Revenue, conversion, and AI-applied actions</p>
        </div>
        <BarChart3 className="h-5 w-5 text-[#f1c86a]" aria-hidden />
      </div>
      <div className="mt-8 flex h-40 items-end gap-2">
        {bars.map((height, index) => (
          <span
            key={`${height}-${index}`}
            className="flex-1 rounded-t-md bg-[#f1c86a]"
            style={{ height: `${height}%`, opacity: 0.35 + index / 22 }}
          />
        ))}
      </div>
    </section>
  );
}

function RightRail({ t, motionReady }: { t: DashboardCopy; motionReady: boolean }) {
  return (
    <aside className="hidden bg-[#f0e5d2] p-4 xl:block">
      <div className="flex h-full flex-col gap-4">
        <section className="rounded-lg border border-[#1b1d19]/10 bg-white/70 p-4">
          <p className="text-sm font-semibold text-[#151713]">{t.rightRail.title}</p>
          <div className="mt-4 grid gap-3">
            <RailItem icon={Globe2} label={t.rightRail.live} />
            <RailItem icon={Zap} label={t.rightRail.usage} />
            <RailItem icon={Gauge} label={t.rightRail.stores} />
          </div>
        </section>

        <section className="rounded-lg border border-[#1b1d19]/10 bg-[#11140f] p-4 text-[#fff8eb]">
          {motionReady ? (
            <DepthCard
              image={reactBitsAsset}
              title="Launch health"
              description="Store signals, app status, and AI approvals in one view."
              width={252}
              height={210}
              maxRotation={8}
              maxTranslation={8}
              borderRadius="8px"
              spotlightColor="rgba(241, 200, 106, 0.45)"
              className="mx-auto"
            />
          ) : (
            <div className="mx-auto grid h-[210px] w-full max-w-[252px] place-items-end rounded-lg bg-[#1d2b21] p-6 text-2xl font-semibold">
              Launch health
            </div>
          )}
        </section>

        <section className="rounded-lg border border-[#1b1d19]/10 bg-white/70 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[#151713]">Compliance</p>
            <ShieldCheck className="h-5 w-5 text-[#246b46]" aria-hidden />
          </div>
          <div className="mt-4 space-y-3 text-sm text-[#5f5a50]">
            <CheckRow text="Payment checks passing" />
            <CheckRow text="Arabic SEO parity" />
            <CheckRow text="Domain records healthy" />
          </div>
        </section>
      </div>
    </aside>
  );
}

function RailItem({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#1b1d19]/10 bg-[#fbf7ef] p-3">
      <Icon className="h-4 w-4 shrink-0 text-[#246b46]" aria-hidden />
      <span className="text-sm text-[#4f4b42]">{label}</span>
    </div>
  );
}

function CheckRow({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2">
      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#246b46]" aria-hidden />
      <span>{text}</span>
    </div>
  );
}

function AutomationBoard({ t }: { t: DashboardCopy }) {
  return (
    <section className="rounded-lg border border-white/10 bg-[#151711] p-5 text-[#fff8eb] shadow-[0_34px_100px_rgba(0,0,0,0.22)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-[#f1c86a]">Automation map</p>
          <h2 className="mt-2 text-3xl font-semibold">Every agent has a review lane.</h2>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-md bg-white/[0.06] px-3 py-2 text-sm text-[#cec5b6]">
          <Sparkles className="h-4 w-4 text-[#f1c86a]" aria-hidden />
          12 active workflows
        </div>
      </div>

      <div className="mt-8 grid gap-3 md:grid-cols-4">
        {t.automations.map((item, index) => (
          <article key={item} className="min-h-[150px] rounded-lg border border-white/10 bg-white/[0.055] p-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-[#f1c86a]">0{index + 1}</span>
              <Sparkles className="h-4 w-4 text-[#f1c86a]" aria-hidden />
            </div>
            <h3 className="mt-8 text-lg font-semibold">{item}</h3>
            <p className="mt-3 text-sm leading-6 text-[#c2b9aa]">
              Draft, simulate, approve, and ship from the same operating surface.
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ReactBitsShowcase({ t, motionReady }: { t: DashboardCopy; motionReady: boolean }) {
  return (
    <section className="relative overflow-hidden rounded-lg border border-white/10 bg-[#f1e6d4] p-5 text-[#151713] shadow-[0_34px_100px_rgba(0,0,0,0.18)]">
      {motionReady ? (
        <GlassFlow
          imageSrc={reactBitsAsset}
          stripeCount={9}
          angle={18}
          speed={0.05}
          frostAmount={0.2}
          refraction={0.035}
          className="absolute inset-0 opacity-[0.24]"
        />
      ) : null}
      <SurfaceImageOverlay className="z-0 opacity-[0.22] mix-blend-multiply saturate-125" />
      <div className="relative z-10">
        <p className="text-sm font-semibold text-[#6c5a25]">ReactBits Pro surfaces</p>
        <h2 className="mt-2 max-w-[520px] text-3xl font-semibold">
          Motion where it supports the workflow.
        </h2>
        <div className="mt-8 grid gap-3">
          {t.activity.map((item) => {
            const Icon = iconMap[item.icon];
            return (
              <div
                key={item.title}
                className="flex items-center gap-3 rounded-lg border border-[#1b1d19]/10 bg-white/74 p-4 backdrop-blur-xl"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[#172016] text-[#e8d16f]">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{item.title}</p>
                  <p className="mt-1 text-xs text-[#706a5e]">{item.meta}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SurfaceImageOverlay({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={reactBitsAsset}
      alt=""
      fill
      priority={priority}
      sizes="(min-width: 1280px) 900px, 100vw"
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 select-none object-cover', className)}
    />
  );
}

function DashboardLink({
  href,
  children,
  icon: Icon,
  flipIcon = false,
}: {
  href: string;
  children: React.ReactNode;
  icon: LucideIcon;
  flipIcon?: boolean;
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-12 items-center justify-center gap-3 rounded-md bg-[#f1c86a] px-5 py-3 text-sm font-semibold text-[#15130c] no-underline transition hover:bg-[#ffe08a]"
    >
      <span>{children}</span>
      <Icon className={cn('h-4 w-4', flipIcon && 'rotate-180')} aria-hidden />
    </Link>
  );
}
