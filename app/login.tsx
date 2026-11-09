import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { ACCENT, ACCENT_LIGHT } from '../styles';

/**
 * app/login.tsx — Layar Masuk (Login Screen)
 *
 * Task 01: Authentication Flow
 * - State management untuk input pengguna (identifier, password, role)
 * - Validasi input tidak boleh kosong
 * - secureTextEntry={true} pada field kata sandi
 * - Aksesibilitas: accessibilityLabel & accessibilityRole dipertahankan
 *
 * Task 02 & Task 03:
 * - Login sukses -> token tersimpan di SecureStore -> navigasi ke Home
 * - Login gagal -> pesan error aman ditampilkan via state errorMessage
 */
export default function LoginScreen() {
  const { login, errorMessage, setErrorMessage } = useAuth();

  const [selectedRole, setSelectedRole] = useState<UserRole>('Pelajar');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handler Masuk (Login)
  const handleLogin = async () => {
    setErrorMessage(null);

    // Validasi Input Kosong (Task 01 & Task 03)
    if (!identifier.trim() || !password.trim()) {
      setErrorMessage('Email/Username dan Password wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await login(identifier, password, selectedRole);
      if (res.success) {
        // Navigasi alur: Login -> Home (Authenticated)
        router.replace('/');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper untuk mengisi akun contoh (Quick Demo)
  const fillDemo = (role: UserRole) => {
    setSelectedRole(role);
    setErrorMessage(null);
    if (role === 'Pelajar') {
      setIdentifier('siswa@sekolah.id');
      setPassword('password123');
    } else {
      setIdentifier('mahasiswa@kampus.ac.id');
      setPassword('password123');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={ls.container}
    >
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={ls.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand / Header */}
        <View style={ls.brandSection}>
          <View style={ls.iconBadge}>
            <Ionicons name="school" size={32} color={ACCENT} />
          </View>
          <Text style={ls.appTitle}>Agenda Belajar</Text>
          <Text style={ls.appSub}>Silakan masuk ke akun Anda</Text>
        </View>

        {/* Tab Pemilihan Peran (Pelajar vs Mahasiswa) */}
        <View style={ls.roleTabContainer}>
          {(['Pelajar', 'Mahasiswa'] as UserRole[]).map((r) => (
            <TouchableOpacity
              key={r}
              style={[ls.roleTab, selectedRole === r && ls.roleTabActive]}
              onPress={() => {
                setSelectedRole(r);
                setErrorMessage(null);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Pilih peran ${r}`}
            >
              <Ionicons
                name={r === 'Pelajar' ? 'school-outline' : 'book-outline'}
                size={16}
                color={selectedRole === r ? '#ffffff' : '#6b7280'}
                style={{ marginRight: 6 }}
              />
              <Text style={[ls.roleTabText, selectedRole === r && ls.roleTabTextActive]}>
                {r}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Pesan Error Validasi / Login Gagal (Task 03) */}
        {errorMessage ? (
          <View style={ls.errorBanner}>
            <Ionicons name="alert-circle" size={18} color="#ef4444" style={{ marginRight: 8 }} />
            <Text style={ls.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* Formulir Input */}
        <View style={ls.formContainer}>
          {/* Input Email / Username */}
          <Text style={ls.fieldLabel}>
            {selectedRole === 'Pelajar' ? 'Email / NISN / Username' : 'Email / NIM / Username'}
          </Text>
          <View style={ls.inputWrapper}>
            <Ionicons name="person-outline" size={18} color="#9ca3af" style={ls.fieldIcon} />
            <TextInput
              style={ls.input}
              placeholder={selectedRole === 'Pelajar' ? 'siswa@sekolah.id' : 'mahasiswa@kampus.ac.id'}
              placeholderTextColor="#9ca3af"
              value={identifier}
              onChangeText={(text) => {
                setIdentifier(text);
                if (errorMessage) setErrorMessage(null);
              }}
              autoCapitalize="none"
              accessibilityLabel="Input Email atau Username"
            />
          </View>

          {/* Input Kata Sandi / PIN */}
          <Text style={[ls.fieldLabel, { marginTop: 14 }]}>Kata Sandi / PIN</Text>
          <View style={ls.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={18} color="#9ca3af" style={ls.fieldIcon} />
            <TextInput
              style={[ls.input, { paddingRight: 44 }]}
              placeholder="Masukkan kata sandi"
              placeholderTextColor="#9ca3af"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errorMessage) setErrorMessage(null);
              }}
              secureTextEntry={!showPassword}
              accessibilityLabel="Input Password"
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={ls.eyeBtn}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color="#6b7280"
              />
            </TouchableOpacity>
          </View>

          {/* Tombol Masuk */}
          <TouchableOpacity
            style={ls.submitBtn}
            onPress={handleLogin}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel="Tombol Masuk"
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={ls.submitBtnText}>Masuk</Text>
            )}
          </TouchableOpacity>

          {/* Tombol Demo Cepat */}
          <TouchableOpacity
            style={ls.demoBtn}
            onPress={() => fillDemo(selectedRole)}
            accessibilityRole="button"
            accessibilityLabel={`Isi otomatis kredensial ${selectedRole}`}
          >
            <Ionicons name="flash-outline" size={14} color={ACCENT} style={{ marginRight: 6 }} />
            <Text style={ls.demoBtnText}>Isi Akun Contoh ({selectedRole})</Text>
          </TouchableOpacity>

          {/* Link ke Register */}
          <View style={ls.switchModeRow}>
            <Text style={ls.switchModeText}>Belum punya akun? </Text>
            <TouchableOpacity
              onPress={() => {
                setErrorMessage(null);
                router.push('/register');
              }}
              accessibilityRole="button"
              accessibilityLabel="Pindah ke Halaman Daftar"
            >
              <Text style={ls.switchModeLink}>Daftar sekarang</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Keamanan Footer */}
        <View style={ls.footerBadge}>
          <Ionicons name="shield-checkmark" size={14} color="#10b981" style={{ marginRight: 6 }} />
          <Text style={ls.footerText}>Dilindungi Enkripsi Expo SecureStore</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const ls = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'web' ? 40 : 60,
    paddingBottom: 40,
    alignItems: 'center',
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: ACCENT_LIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  appTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  appSub: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  roleTabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 4,
    width: '100%',
    maxWidth: 380,
    marginBottom: 16,
  },
  roleTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleTabActive: {
    backgroundColor: '#111827',
  },
  roleTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  roleTabTextActive: {
    color: '#ffffff',
  },
  errorBanner: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  formContainer: {
    width: '100%',
    maxWidth: 380,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  fieldIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    paddingVertical: 8,
  },
  eyeBtn: {
    padding: 6,
  },
  submitBtn: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  demoBtn: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: ACCENT_LIGHT,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  demoBtnText: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: '600',
  },
  switchModeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
  },
  switchModeText: {
    fontSize: 13,
    color: '#6b7280',
  },
  switchModeLink: {
    fontSize: 13,
    fontWeight: '700',
    color: ACCENT,
  },
  footerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 32,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
  },
  footerText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4b5563',
  },
});
