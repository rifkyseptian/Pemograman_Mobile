import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, router, useSegments, useRootNavigationState } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ACCENT } from '../styles';

/**
 * AuthGate — Mengelola proteksi rute dan alur autentikasi (Task 01 & Task 03)
 * - Memeriksa token/sesi pengguna dari Secure Storage saat aplikasi dimuat.
 * - Jika belum login, otomatis mengarahkan ke layar /login.
 * - Jika sudah login, mengizinkan akses ke / (Home) dan /detail.
 */
function AuthGate() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const rootNavigationState = useRootNavigationState();

  useEffect(() => {
    // 1. Tunggu sampai root navigation ter-mount sepenuhnya
    if (!rootNavigationState?.key) return;

    // 2. Tunggu sampai pembacaan sesi di Secure Storage selesai
    if (isLoading) return;

    const currentSegment = segments[0] as string | undefined;
    const isAuthRoute = currentSegment === 'login' || currentSegment === 'register';

    if (!isAuthenticated && !isAuthRoute) {
      // Belum login & mencoba akses rute utama -> Arahkan ke /login
      router.replace('/login');
    } else if (isAuthenticated && isAuthRoute) {
      // Sudah login tapi berada di halaman login/register -> Arahkan ke / (Home)
      router.replace('/');
    }
  }, [isAuthenticated, isLoading, segments, rootNavigationState?.key]);

  if (isLoading) {
    return (
      <View style={layoutStyles.loadingContainer}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Stack.Screen untuk layar utama (Home) */}
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
          title: 'Beranda',
        }}
      />

      {/* Stack.Screen untuk layar Login (Task 01) */}
      <Stack.Screen
        name="login"
        options={{
          headerShown: false,
          animation: 'fade',
        }}
      />

      {/* Stack.Screen untuk layar Register (Task 01) */}
      <Stack.Screen
        name="register"
        options={{
          headerShown: false,
          animation: 'fade',
        }}
      />

      {/* Stack.Screen untuk layar detail item */}
      <Stack.Screen
        name="detail"
        options={{
          headerShown: false,
          title: 'Detail',
          animation: 'slide_from_right',
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

const layoutStyles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
});
