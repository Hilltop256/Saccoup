import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/theme-provider";
import { useAppContext } from "@/contexts/AppContext";
import LoginModal from "@/components/LoginModal";
import Dashboard from "@/components/Dashboard";

const queryClient = new QueryClient();

const App = () => {
  const { user } = useAppContext();

  console.log("USER:", user); // debug

  return (
    <ThemeProvider defaultTheme="light">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />

          {!user ? (
            <LoginModal
              isOpen={true}
              onClose={() => {}}
              onLogin={() => {}}
              mode="login"
            />
          ) : (
            <Dashboard />
          )}

        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;
