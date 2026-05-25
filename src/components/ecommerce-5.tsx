'use client';

import { SouqnaEcommerceBlock } from './ecommerce-souqna';
import type { Ecommerce5Props } from '@/lib/blocks/types';

type Props = Ecommerce5Props & {
  dir?: 'ltr' | 'rtl';
};

export default function Ecommerce5(props: Props) {
  return <SouqnaEcommerceBlock variant="shelf" {...props} />;
}
