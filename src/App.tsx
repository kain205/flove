import { Suspense, lazy, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import AppErrorBoundary from "./components/AppErrorBoundary";
import { APP_ROUTES, CHAT_ROUTE } from "./app/routes";
import { AuthProvider } from "./features/auth/AuthContext";
import { useAuth } from "./features/auth/useAuth";

const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ChatRoomPage = lazy(() => import("./features/messages/pages/ChatRoomPage"));

const queryClient = new QueryClient();

const AppLoading = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
  </div>
);

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, status } = useAuth();

  if (status === "checking") {
    return <AppLoading />;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const App = () => (
  <AppErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<AppLoading />}>
              <Routes>
                {APP_ROUTES.map(route => (
                  <Route key={route.path} path={route.path} element={<Index />} />
                ))}
                <Route
                  path={CHAT_ROUTE.path}
                  element={(
                    <ProtectedRoute>
                      <ChatRoomPage />
                    </ProtectedRoute>
                  )}
                />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </AppErrorBoundary>
);

export default App;
