import type { Locale } from '@/i18n/locales';
import type { Copy } from '@/content/copy';
import { getCopy } from '@/content/copy';
import HowItWorks6, { type HowItWorksStep } from '@/components/blocks/how-it-works-6';

type Props = {
  locale: Locale;
  copy: Copy;
};

const ORDER = ['begin', 'build', 'tune', 'publish'] as const;

export function Process({ locale, copy }: Props) {
  const echoCopy = getCopy(locale === 'en' ? 'ar' : 'en');
  const steps: HowItWorksStep[] = ORDER.map((key) => {
    const phase = copy.process.phases[key];
    const echoPhase = echoCopy.process.phases[key];

    return {
      key,
      roman: phase.roman,
      name: phase.name,
      echoName: echoPhase.name,
      time: phase.time,
      caption: phase.caption,
      body: phase.body,
    };
  });

  return (
    <HowItWorks6
      locale={locale}
      eyebrow={copy.process.eyebrow}
      title={copy.process.title}
      steps={steps}
    />
  );
}
