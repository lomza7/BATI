'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface PlatformConfig {
  stripe_price_starter: string;
  stripe_price_pro: string;
  stripe_price_business: string;
  price_starter: string;
  price_pro: string;
  price_business: string;
  [key: string]: string;
}

const defaultConfig: PlatformConfig = {
  stripe_price_starter: '',
  stripe_price_pro: '',
  stripe_price_business: '',
  price_starter: '0',
  price_pro: '49',
  price_business: '89',
};

export function usePlatformConfig() {
  const [config, setConfig] = useState<PlatformConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.rpc('get_platform_config');
      if (!error && data) {
        setConfig({ ...defaultConfig, ...(data as Record<string, string>) });
      }
      setLoading(false);
    }
    load();
  }, []);

  return { config, loading };
}
