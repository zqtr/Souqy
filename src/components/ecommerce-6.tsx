'use client';

import { SouqnaEcommerceBlock } from './ecommerce-souqna';
import type { Ecommerce6Props } from '@/lib/blocks/types';

type Props = Ecommerce6Props & {
  dir?: 'ltr' | 'rtl';
};

export default function Ecommerce6(props: Props) {
  return <SouqnaEcommerceBlock variant="categoryShop" {...props} />;
}
