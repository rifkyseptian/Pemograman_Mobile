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
 * app/register.tsx — Layar Pendaftaran Akun Baru (Register Screen)
 *
 * Task 01: Authentication Flow
 * - State formulir pendaftaran: name, identifier, password, confirmPassword, selectedRole
 * - Validasi input tidak boleh kosong & konfirmasi kata sandi cocok
 * - secureTextEntry={true} pada field kata sandi
 * - Aksesibilitas: accessibilityLabel & accessibilityRole pada tombol dan field input
 *
 * Alur Navigasi:
 * - Register berhasil -> diterbitkan token SecureStore -> Home (Authenticated)
 * - Tombol "Sudah punya akun? Masuk" -> Login Screen
 */
export default function RegisterScreen() {
  const { register, errorMessage, setErrorMessage } = useAuth();

  const [selectedRole, setSelectedRole] = useState<UserRole>('Pelajar');
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handler Pendaftaran (Register)
  const handleRegister = async () => {
    setErrorMessage(null);

    // Validasi Skenario Empty Input
    if (!name.trim() || !identifier.trim() || !password.trim() || !confirmPassword.trim()) {
      setErrorMessage('Semua field formulir pendaftaran wajib diisi.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Kata sandi minimal harus terdiri dari 6 karakter.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await register(name, identifier, password, selectedRole);
      if (res.success) {
        // Alur: Register -> Home (Authenticated)
        router.replace('/');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={rs.container}
    >
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={rs.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={rs.brandSection}>
          <View style={rs.iconBadge}>
            <Ionicons name="person-add" size={30} color={ACCENT} />
          </View>
          <Text style={rs.appTitle}>Buat Akun Baru</Text>
          <Text style={rs.appSub}>Daftarkan akun untuk memulai agenda Anda</Text>
        </View>

        {/* Tab Pemilihan Peran */}
        <View style={rs.roleTabContainer}>
          {(['Pelajar', 'Mahasiswa'] as UserRole[]).map((r) => (
            <TouchableOpacity
              key={r}
              style={[rs.roleTab, selectedRole === r && rs.roleTabActive]}
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
              <Text style={[rs.roleTabText, selectedRole === r && rs.roleTabTextActive]}>
                {r}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Pesan Error Validasi */}
        {errorMessage ? (
          <View style={rs.errorBanner}>
            <Ionicons name="alert-circle" size={18} color="#ef4444" style={{ marginRight: 8 }} />
            <Text style={rs.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* Form Pendaftaran */}
        <View style={rs.formContainer}>
          {/* Input Nama Lengkap */}
          <Text style={rs.fieldLabel}>Nama Lengkap</Text>
          <View style={rs.inputWrapper}>
            <Ionicons name="person-outline" size={18} color="#9ca3af" style={rs.fieldIcon} />
            <TextInput
              style={rs.input}
              placeholder="Contoh: Budi Santoso"
              placeholderTextColor="#9ca3af"
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (errorMessage) setErrorMessage(null);
              }}
              autoCapitalize="words"
              accessibilityLabel="Input Nama Lengkap"
            />
          </View>

          {/* Input Email / Username */}
          <Text style={[rs.fieldLabel, { marginTop: 14 }]}>
            {selectedRole === 'Pelajar' ? 'Email / NISN / Username' : 'Email / NIM / Username'}
          </Text>
          <View style={rs.inputWrapper}>
            <Ionicons name="mail-outline" size={18} color="#9ca3af" style={rs.fieldIcon} />
            <TextInput
              style={rs.input}
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

          {/* Input Kata Sandi */}
          <Text style={[rs.fieldLabel, { marginTop: 14 }]}>Kata Sandi (Min. 6 Karakter)</Text>
          <View style={rs.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={18} color="#9ca3af" style={rs.fieldIcon} />
            <TextInput
              style={[rs.input, { paddingRight: 44 }]}
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
              style={rs.eyeBtn}
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

          {/* Input Konfirmasi Kata Sandi */}
          <Text style={[rs.fieldLabel, { marginTop: 14 }]}>Konfirmasi Kata Sandi</Text>
          <View style={rs.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={18} color="#9ca3af" style={rs.fieldIcon} />
            <TextInput
              style={[rs.input, { paddingRight: 44 }]}
              placeholder="Ulangi kata sandi"
              placeholderTextColor="#9ca3af"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (errorMessage) setErrorMessage(null);
              }}
              secureTextEntry={!showPassword}
              accessibilityLabel="Input Konfirmasi Password"
            />
          </View>

          {/* Tombol Daftar */}
          <TouchableOpacity
            style={rs.submitBtn}
            onPress={handleRegister}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel="Tombol Daftar"
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={rs.submitBtnText}>Daftar</Text>
            )}
          </TouchableOpacity>

          {/* Link ke Login */}
          <View style={rs.switchModeRow}>
            <Text style={rs.switchModeText}>Sudah punya akun? </Text>
            <TouchableOpacity
              onPress={() => {
                setErrorMessage(null);
                router.replace('/login');
              }}
              accessibilityRole="button"
              accessibilityLabel="Pindah ke Halaman Masuk"
            >
              <Text style={rs.switchModeLink}>Masuk</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Keamanan Footer */}
        <View style={rs.footerBadge}>
          <Ionicons name="shield-checkmark" size={14} color="#10b981" style={{ marginRight: 6 }} />
          <Text style={rs.footerText}>Kredensial diamankan dengan enkripsi lokal</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const rs = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'web' ? 30 : 50,
    paddingBottom: 40,
    alignItems: 'center',
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: ACCENT_LIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
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
    marginTop: 28,
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
