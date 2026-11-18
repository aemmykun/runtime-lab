import { DEFAULT_PRICE_TABLE, type PriceTable } from '@runtime-lab/core';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { getSetting, setSetting } from '~/db/repo';

interface SettingsState {
  priceTable: PriceTable;
  loaded: boolean;
  load: () => Promise<void>;
  setPriceTable: (t: PriceTable) => Promise<void>;
  resetPriceTable: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()(
  immer((set) => ({
    priceTable: DEFAULT_PRICE_TABLE,
    loaded: false,
    load: async () => {
      const t = await getSetting<PriceTable>('priceTable');
      set((s) => {
        if (t) s.priceTable = t;
        s.loaded = true;
      });
    },
    setPriceTable: async (t) => {
      await setSetting('priceTable', t);
      set((s) => {
        s.priceTable = t;
      });
    },
    resetPriceTable: async () => {
      await setSetting('priceTable', DEFAULT_PRICE_TABLE);
      set((s) => {
        s.priceTable = DEFAULT_PRICE_TABLE;
      });
    },
  })),
);
