import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <p className="text-lg font-semibold text-[#00285A]">Something went wrong.</p>
          <p className="text-sm text-[#5A7A9A]">Reload the page or contact support if the problem persists.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-4 py-2 rounded-lg bg-[#0052A5] text-white text-sm font-medium hover:bg-[#003F8A]"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
