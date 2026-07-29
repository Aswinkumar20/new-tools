/** Snapshot of Battery Status API values captured at a point in time. */
export interface BatteryStatusSnapshot {
  charging: boolean;
  chargingTime: number | null;
  dischargingTime: number | null;
  level: number;
  timestamp: number;
}

/** Minimal BatteryManager shape used by this tool. */
export interface BatteryManager {
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  level: number;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

export type BatteryNavigator = Navigator & {
  getBattery?: () => Promise<BatteryManager>;
  battery?: BatteryManager;
};
