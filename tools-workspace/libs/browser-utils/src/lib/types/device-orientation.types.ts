export interface OrientationSample {
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
  absolute: boolean;
  timestamp: number;
}

export type DeviceOrientationPermissionResult = 'granted' | 'denied' | string;

export type DeviceOrientationEventConstructor = {
  requestPermission?: () => Promise<DeviceOrientationPermissionResult>;
};
