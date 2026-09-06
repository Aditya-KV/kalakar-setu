import { Redirect } from 'expo-router';
import { useAuth } from '../features/auth/hooks';
import { useAppMode } from '../features/appMode/context';

export default function Index() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { mode, isReady } = useAppMode();

  // Wait for the saved session to actually be restored from storage before
  // deciding where to route — otherwise this renders on the very first
  // frame with isAuthenticated still false (tokens haven't loaded yet) and
  // sends a logged-in user straight to the auth flow, which looks exactly
  // like being logged out every time the app is reopened.
  if (isLoading) {
    return null;
  }

  if (isAuthenticated) {
    if (user && !user.onboarding_completed) {
      return <Redirect href="/(onboarding)/name" />;
    }
    if (!isReady) {
      return null;
    }
    if (mode === 'customer') {
      return <Redirect href="/(app)/(customer-tabs)" />;
    }
    return <Redirect href="/(app)/(tabs)" />;
  }

  return <Redirect href="/(auth)/landing" />;
}
