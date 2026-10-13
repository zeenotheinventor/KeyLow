/**
 * Bottom sheet with handle that slams up and settles with a spring
 * @startingPoint section="Surfaces" subtitle="Bottom sheet with handle that slams up and settles with a spring" viewport="360x400"
 */
export interface BottomSheetProps {
  open: boolean;
  onClose?: () => void;
  title?: string;
  children?: React.ReactNode;
  /** position: fixed for a real page; default absolute inside a positioned frame. */
  fixed?: boolean;
  platform?: 'ios' | 'android';
  style?: React.CSSProperties;
}

export declare function BottomSheet(props: BottomSheetProps): JSX.Element;
