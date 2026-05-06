import type { SupportedParam } from '@/web/lib/corteca/usp';

export interface SetParamTarget {
  deviceId: string;
  objPath: string;
  param: SupportedParam;
  currentValue?: string;
}
