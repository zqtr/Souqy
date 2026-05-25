'use client';

import { SouqnaEcommerceBlock } from './ecommerce-souqna';
import type { Ecommerce2Props } from '@/lib/blocks/types';

type Props = Ecommerce2Props & {
  dir?: 'ltr' | 'rtl';
};

export default function Ecommerce2(props: Props) {
  return <SouqnaEcommerceBlock variant="filters" {...props} />;
}
