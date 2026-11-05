"use client";

import { Component } from "react";

import type { ReactNode } from "react";

type LoadFailureBoundaryProps = { children: ReactNode; onError: () => void };

type LoadFailureBoundaryState = { hasFailed: boolean };

/**
 * Draws its children, or nothing once they throw. The 3D body is read through `import()`, which rejects when the
 * file cannot be fetched, as it cannot offline with the chunk not cached, and a rejection that reached no boundary
 * would take the page down. It calls `onError` so the caller keeps the 2D figure. The error itself is dropped,
 * because it is not shown or logged.
 */
export class LoadFailureBoundary extends Component<
  LoadFailureBoundaryProps,
  LoadFailureBoundaryState
> {
  override state: LoadFailureBoundaryState = { hasFailed: false };

  static getDerivedStateFromError(): LoadFailureBoundaryState {
    return { hasFailed: true };
  }

  override componentDidCatch() {
    this.props.onError();
  }

  override render() {
    return this.state.hasFailed ? null : this.props.children;
  }
}
