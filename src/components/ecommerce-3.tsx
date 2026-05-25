'use client';

import { SouqnaEcommerceBlock } from './ecommerce-souqna';
import type { Ecommerce3Props } from '@/lib/blocks/types';

type Props = Ecommerce3Props & {
  dir?: 'ltr' | 'rtl';
};

export default function Ecommerce3(props: Props) {
  return <SouqnaEcommerceBlock variant="colorDetail" {...props} />;
}
