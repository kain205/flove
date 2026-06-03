import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppErrorBoundary from "./components/AppErrorBoundary";

const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ChatRoomPage = lazy(() => import("./features/messages/pages/ChatRoomPage"));

const queryClient = new QueryClient();

const AppLoading = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
  </div>
);

const App = () => (
  <AppErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<AppLoading />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/ai-picks" element={<Index />} />
              <Route path="/blind-date" element={<Index />} />
              <Route path="/messages" element={<Index />} />
              <Route path="/profile" element={<Index />} />
              <Route path="/chat/:conversationId" element={<ChatRoomPage />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </AppErrorBoundary>
);

export default App;
