import { Component } from "react";

import type { ReactNode } from "react";

type Body3DBoundaryState = { hasFailed: boolean };

/**
 * Draws its children, or nothing once they throw. A GL context that cannot start, a model that cannot
 * load or a render error must leave the figure's place empty, and never take the screen down.
 */
export class Body3DBoundary extends Component<{ children: ReactNode }, Body3DBoundaryState> {
  override state: Body3DBoundaryState = { hasFailed: false };

  static getDerivedStateFromError(): Body3DBoundaryState {
    return { hasFailed: true };
  }

  override render() {
    return this.state.hasFailed ? null : this.props.children;
  }
}
