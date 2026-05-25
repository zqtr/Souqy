'use client';

import { SouqnaEcommerceBlock } from './ecommerce-souqna';
import type { Ecommerce7Props } from '@/lib/blocks/types';

type Props = Ecommerce7Props & {
  dir?: 'ltr' | 'rtl';
};

export default function Ecommerce7(props: Props) {
  return <SouqnaEcommerceBlock variant="tiles" {...props} />;
}
