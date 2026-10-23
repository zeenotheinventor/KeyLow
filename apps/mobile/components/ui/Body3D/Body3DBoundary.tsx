import { Component } from "react";

import type { ReactNode } from "react";

type Body3DBoundaryProps = { children: ReactNode; onError?: (() => void) | undefined };

type Body3DBoundaryState = { hasFailed: boolean };

/**
 * Draws its children, or nothing once they throw. A GL context that cannot start, a model that cannot
 * load or a render error must leave the figure's place empty, and never take the screen down. It calls
 * `onError` once when that happens, so the caller can draw something else in the place.
 */
export class Body3DBoundary extends Component<Body3DBoundaryProps, Body3DBoundaryState> {
  override state: Body3DBoundaryState = { hasFailed: false };

  static getDerivedStateFromError(): Body3DBoundaryState {
    return { hasFailed: true };
  }

  override componentDidCatch() {
    this.props.onError?.();
  }

  override render() {
    return this.state.hasFailed ? null : this.props.children;
  }
}
