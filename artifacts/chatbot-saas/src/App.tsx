import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import BotEditor from "./pages/BotEditor";
import Analytics from "./pages/Analytics";
import Bookings from "./pages/Bookings";
import Conversations from "./pages/Conversations";
import Leads from "./pages/Leads";
import ClientReport from "./pages/ClientReport";
import Preview from "./pages/Preview";
import Settings from "./pages/Settings";
import SharePage from "./pages/SharePage";
import { Loader2 } from "lucide-react";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
      </div>
    );
  }
  if (!user) return null;
  return <Component />;
}

function AuthRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && user) navigate("/");
  }, [user, loading]);

  if (loading || user) return null;
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={() => <AuthRoute component={Login} />} />
      <Route path="/analytics" component={() => <ProtectedRoute component={Analytics} />} />
      <Route path="/bookings" component={() => <ProtectedRoute component={Bookings} />} />
      <Route path="/conversations" component={() => <ProtectedRoute component={Conversations} />} />
      <Route path="/leads" component={() => <ProtectedRoute component={Leads} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
      <Route path="/report/:botId/:token" component={ClientReport} />
      <Route path="/bots/:id" component={() => <ProtectedRoute component={BotEditor} />} />
      <Route path="/preview" component={Preview} />
      <Route path="/p/:publicId" component={SharePage} />
      <Route component={() => <ProtectedRoute component={Dashboard} />} />
    </Switch>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}
