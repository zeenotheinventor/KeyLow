"use client";

import { Component } from "react";

import type { ReactNode } from "react";

type Body3DBoundaryProps = { children: ReactNode; onError: () => void };

type Body3DBoundaryState = { hasFailed: boolean };

/**
 * Draws its children, or nothing once they throw. A GL context that cannot start, a model that cannot load or a
 * render error leaves the figure's place empty and never takes the page down. It calls `onError` when that happens,
 * so the caller can draw the 2D figure in the place. The error itself is dropped, because it is not shown or logged.
 */
export class Body3DBoundary extends Component<Body3DBoundaryProps, Body3DBoundaryState> {
  override state: Body3DBoundaryState = { hasFailed: false };

  static getDerivedStateFromError(): Body3DBoundaryState {
    return { hasFailed: true };
  }

  override componentDidCatch() {
    this.props.onError();
  }

  override render() {
    return this.state.hasFailed ? null : this.props.children;
  }
}
