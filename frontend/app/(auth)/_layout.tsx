import { Stack } from 'expo-router';
import React from 'react';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="scenes" />
      <Stack.Screen name="welcome" />
      <Stack.Screen name="role" />
      <Stack.Screen name="phone" />
      <Stack.Screen name="consent" />
    </Stack>
  );
}
