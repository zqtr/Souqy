'use client';

import { SouqnaEcommerceBlock } from './ecommerce-souqna';
import type { Ecommerce4Props } from '@/lib/blocks/types';

type Props = Ecommerce4Props & {
  dir?: 'ltr' | 'rtl';
};

export default function Ecommerce4(props: Props) {
  return <SouqnaEcommerceBlock variant="drop" {...props} />;
}
