// src/lib/apps/souqnasource/clients/index.ts
import type { SourceNetwork } from '../types';
import type { SupplierClient } from './types';
import { qatarlivingClient } from './apify-qatarliving';
import { marhabaClient } from './apify-marhaba';
import { qmartClient } from './apify-qmart';

export const CLIENTS: Record<SourceNetwork, SupplierClient> = {
  qatarliving: qatarlivingClient,
  marhaba: marhabaClient,
  qmart: qmartClient,
};

export const ALL_NETWORKS: SourceNetwork[] = ['qatarliving', 'marhaba', 'qmart'];
