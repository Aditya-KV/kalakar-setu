import { Redirect } from 'expo-router';
import { useAuth } from '../features/auth/hooks';
import { useAppMode } from '../features/appMode/context';

export default function Index() {
  const { isAuthenticated, user } = useAuth();
  const { mode, isReady } = useAppMode();

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
