'use client';

import StaggeredText, {
  type StaggeredTextProps,
} from '@/components/react-bits/staggered-text';

type Props = Omit<StaggeredTextProps, 'delay' | 'duration' | 'direction' | 'blur'> & {
  delay?: number;
  duration?: number;
  direction?: StaggeredTextProps['direction'];
  blur?: boolean;
};

export function HomeStaggeredText({
  delay = 28,
  duration = 0.48,
  direction = 'bottom',
  blur = true,
  rootMargin = '0px 0px -8% 0px',
  ...props
}: Props) {
  return (
    <StaggeredText
      blur={blur}
      delay={delay}
      direction={direction}
      duration={duration}
      rootMargin={rootMargin}
      {...props}
    />
  );
}
