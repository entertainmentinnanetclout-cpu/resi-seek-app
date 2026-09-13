import React, { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
  name: string;
};

type State = { hasError: boolean };

export default class SafeRenderBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[SafeRenderBoundary:${this.props.name}]`, error, info);
    try {
      sessionStorage.setItem("rk:last-ui-error", JSON.stringify({
        surface: this.props.name,
        message: String(error?.message || "Unknown render error").slice(0, 500),
        at: new Date().toISOString(),
      }));
    } catch {
      // Storage may be unavailable in hardened/private browser contexts.
    }
  }

  render() {
    if (this.state.hasError) return this.props.fallback ?? null;
    return this.props.children;
  }
}
