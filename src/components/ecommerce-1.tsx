'use client';

import { SouqnaEcommerceBlock } from './ecommerce-souqna';
import type { Ecommerce1Props } from '@/lib/blocks/types';

type Props = Ecommerce1Props & {
  dir?: 'ltr' | 'rtl';
};

export default function Ecommerce1(props: Props) {
  return <SouqnaEcommerceBlock variant="gallery" {...props} />;
}
