import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  error: Error | null;
}

class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App crashed', error, errorInfo);
  }

  handleReset = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Failed to sign out during reset', error);
    }

    Object.keys(localStorage)
      .filter(key => key.startsWith('flove-'))
      .forEach(key => localStorage.removeItem(key));

    sessionStorage.clear();

    if ('indexedDB' in window) {
      indexedDB.deleteDatabase('firebaseLocalStorageDb');
    }

    window.location.assign(`/?reset=${Date.now()}`);
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="max-w-md w-full rounded-2xl border border-border bg-card p-6 shadow-card space-y-4">
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">App gặp lỗi runtime</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Có thể cache đăng nhập hoặc dữ liệu profile cũ đang làm màn hình trắng.
            </p>
          </div>
          <pre className="max-h-40 overflow-auto rounded-xl bg-muted p-3 text-xs text-muted-foreground whitespace-pre-wrap">
            {this.state.error.name}: {this.state.error.message}
          </pre>
          <Button onClick={this.handleReset} className="w-full rounded-xl">
            Đăng xuất, xóa cache và tải lại
          </Button>
        </div>
      </div>
    );
  }
}

export default AppErrorBoundary;
