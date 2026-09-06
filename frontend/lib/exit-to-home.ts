import { useEffect } from 'react';
import { useNavigation, useRouter } from 'expo-router';

/**
 * Makes any back-navigation attempt on this screen — the header X button,
 * Android hardware back, or the iOS edge-swipe gesture — exit straight to
 * Home instead of stepping back one screen at a time. Used across the
 * multi-step catalog creation flow (photo -> voice -> price) so an artisan
 * can always abort the in-progress listing from wherever they are, in one
 * action, rather than backing out step by step.
 *
 * Forward navigation and this screen's own router.replace() calls (e.g.
 * after a successful publish) are untouched — those dispatch REPLACE/PUSH
 * actions, not GO_BACK, so only genuine "leave this screen" attempts are
 * redirected. The in-progress draft itself isn't cleared by this — it's
 * already persisted separately (see features/catalog/context.tsx) and can
 * be resumed later.
 */
export function useExitToHomeOnBack(enabled: boolean = true) {
  const navigation = useNavigation();
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      if (e.data?.action?.type !== 'GO_BACK') return;
      e.preventDefault();
      router.replace('/(app)/(tabs)');
    });
    return unsubscribe;
  }, [navigation, router, enabled]);
}
