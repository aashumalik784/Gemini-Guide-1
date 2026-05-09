import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import NotFound from "@/pages/not-found";
import ChatPage from "@/pages/chat";
import ImageStudio from "@/pages/image-studio";
import VideoStudio from "@/pages/video-studio";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={ChatPage} />
      <Route path="/chat/:id" component={ChatPage} />
      <Route path="/image-studio" component={ImageStudio} />
      <Route path="/video-studio" component={VideoStudio} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="gemini-theme">
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
