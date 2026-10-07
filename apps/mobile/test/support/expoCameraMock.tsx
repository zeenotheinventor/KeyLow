import { createElement, useCallback, useState } from "react";
import { View } from "react-native";

import type { BarcodeScanningResult, CameraViewProps } from "expo-camera";
import type { ReactNode } from "react";

type CameraPermission = {
  status: "undetermined" | "granted" | "denied";
  expires: "never";
  granted: boolean;
  canAskAgain: boolean;
};

export const permissions = {
  undetermined: { status: "undetermined", expires: "never", granted: false, canAskAgain: true },
  granted: { status: "granted", expires: "never", granted: true, canAskAgain: true },
  denied: { status: "denied", expires: "never", granted: false, canAskAgain: false },
  // Android lets the user be asked again after a first refusal.
  deniedOnce: { status: "denied", expires: "never", granted: false, canAskAgain: true },
} satisfies Record<string, CameraPermission>;

// The props of the latest CameraView render. They outlive the unmount on purpose, so a test can
// deliver a scan that the native camera had already queued when the screen removed it.
export const cameraMock = {
  props: undefined as (CameraViewProps & { children?: ReactNode }) | undefined,
  permission: null as CameraPermission | null,
  requestPermission: jest.fn<Promise<CameraPermission>, []>(),
  // What a re-read of the permission reports, as after the user changed it in the settings app.
  rereadPermission: jest.fn<Promise<CameraPermission>, []>(),
};

export function resetCameraMock(): void {
  cameraMock.props = undefined;
  cameraMock.permission = permissions.granted;
  cameraMock.requestPermission.mockReset();
  cameraMock.requestPermission.mockResolvedValue(permissions.granted);
  cameraMock.rereadPermission.mockReset();
  cameraMock.rereadPermission.mockResolvedValue(permissions.granted);
}

/** Raises the camera's `onBarcodeScanned` with the event shape expo-camera delivers. */
export function scanBarcode(type: string, data: string): void {
  const onBarcodeScanned = cameraMock.props?.onBarcodeScanned;
  if (onBarcodeScanned === undefined) {
    throw new Error("The camera has never been rendered, so there is nothing to scan with.");
  }
  const scan: BarcodeScanningResult = {
    type,
    data,
    cornerPoints: [],
    bounds: { origin: { x: 0, y: 0 }, size: { width: 0, height: 0 } },
  };
  onBarcodeScanned(scan);
}

export const mockExpoCamera = {
  CameraView: (props: CameraViewProps & { children?: ReactNode }) => {
    cameraMock.props = props;
    return createElement(View, null, props.children);
  },
  // Like the real hook, the permission is state, and the third item re-reads it into that state.
  useCameraPermissions: () => {
    const [permission, setPermission] = useState(cameraMock.permission);
    const getPermission = useCallback(async () => {
      const reread = await cameraMock.rereadPermission();
      setPermission(reread);
      return reread;
    }, []);
    return [permission, cameraMock.requestPermission, getPermission];
  },
};
