import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Platform, StyleSheet
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

// Konstanta warna — konsisten dengan desain existing (styles.ts)
const ACCENT = '#2563eb';
const ACCENT_LIGHT = '#eff6ff';

/**
 * Layar Detail — app/detail.tsx
 *
 * Rute ini dapat dicapai melalui:
 *   - router.push('/detail')   → menambahkan ke history stack (dari kartu jadwal/tugas)
 *   - router.replace('/detail') → menggantikan route saat ini (dari kartu saat sudah di detail lain)
 *
 * Navigasi kembali dilakukan dengan:
 *   - router.back()            → kembali ke layar sebelumnya
 */
export default function DetailScreen() {
  // useLocalSearchParams — membaca parameter yang dikirim via router.push/replace
  const params = useLocalSearchParams<{
    type: string;
    id: string;
    title: string;
    timeStart?: string;
    timeEnd?: string;
    teacher?: string;
    room?: string;
    sks?: string;
    deadline?: string;
    priority?: string;
    category?: string;
    day?: string;
  }>();

  // Status mengikuti ID item, sehingga otomatis kembali ke belum selesai untuk item lain.
  const [completedItemId, setCompletedItemId] = useState<string | null>(null);
  const isCompleted = completedItemId === params.id;

  const isTask = params.type === 'task';
  const isSchedule = params.type === 'schedule';

  /**
   * router.back() — kembali ke layar sebelumnya dalam navigation stack.
   * Jika tidak ada history (langsung dibuka), fallback ke router.replace('/') agar
   * pengguna tidak terjebak tanpa tombol kembali.
   */
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const getPriorityColor = (priority: string): string => {
    if (priority === 'High') return '#ef4444';
    if (priority === 'Medium') return '#f59e0b';
    return '#10b981';
  };

  return (
    <View style={ds.container}>
      <StatusBar style="dark" />

      {/* Header custom — konsisten dengan desain header di App.tsx */}
      <View style={ds.header}>
        {/* Tombol kembali: memanggil router.back() */}
        <TouchableOpacity onPress={handleBack} style={ds.backBtn}>
          <Ionicons name="arrow-back" size={20} color={ACCENT} />
          <Text style={ds.backBtnText}>Kembali</Text>
        </TouchableOpacity>
        <Text style={ds.headerTitle}>
          {isTask ? 'Detail Tugas' : 'Detail Jadwal'}
        </Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView style={ds.content} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Banner info tipe item */}
        <View style={ds.typeBadgeRow}>
          <View style={[ds.typeBadge, { backgroundColor: isTask ? '#fef3c7' : ACCENT_LIGHT }]}>
            <Ionicons
              name={isTask ? 'document-text' : 'calendar'}
              size={14}
              color={isTask ? '#d97706' : ACCENT}
            />
            <Text style={[ds.typeBadgeText, { color: isTask ? '#d97706' : ACCENT }]}>
              {isTask ? 'Tugas' : `Jadwal ${params.day ?? ''}`}
            </Text>
          </View>
        </View>

        {/* Judul item */}
        <Text style={ds.itemTitle}>{params.title ?? '—'}</Text>

        {/* Detail untuk JADWAL */}
        {isSchedule && (
          <View style={ds.card}>
            <DetailRow icon="time-outline" label="Waktu" value={`${params.timeStart ?? ''} – ${params.timeEnd ?? ''}`} />
            <DetailRow icon="location-outline" label="Ruang" value={params.room ?? '—'} />
            <DetailRow icon="person-outline" label={params.sks ? 'Dosen' : 'Guru'} value={params.teacher ?? '—'} />
            {params.sks && (
              <DetailRow icon="school-outline" label="SKS" value={`${params.sks} SKS`} />
            )}
          </View>
        )}

        {/* Detail untuk TUGAS */}
        {isTask && (
          <View style={ds.card}>
            <DetailRow
              icon="calendar-outline"
              label="Tenggat"
              value={params.deadline
                ? new Date(params.deadline).toLocaleDateString('id-ID', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                  })
                : '—'}
            />
            {params.priority && (
              <View style={ds.row}>
                <Ionicons name="flag-outline" size={16} color="#6b7280" />
                <Text style={ds.rowLabel}>Prioritas</Text>
                <View style={[ds.priorityBadge, { backgroundColor: getPriorityColor(params.priority) + '20' }]}>
                  <Text style={[ds.priorityBadgeText, { color: getPriorityColor(params.priority) }]}>
                    {params.priority}
                  </Text>
                </View>
              </View>
            )}
            {params.category && (
              <DetailRow icon="people-outline" label="Kategori" value={params.category} />
            )}

            {/* Toggle selesai — demonstrasi useState interaktif */}
            <View style={[ds.row, { marginTop: 8 }]}>
              <Ionicons
                name={isCompleted ? 'checkmark-circle' : 'ellipse-outline'}
                size={16}
                color={isCompleted ? '#16a34a' : '#9ca3af'}
              />
              <Text style={ds.rowLabel}>Status</Text>
              <TouchableOpacity
                onPress={() => setCompletedItemId(isCompleted ? null : params.id)}
                style={[ds.statusBtn, { backgroundColor: isCompleted ? '#dcfce7' : '#f3f4f6' }]}
              >
                <Text style={[ds.statusBtnText, { color: isCompleted ? '#16a34a' : '#6b7280' }]}>
                  {isCompleted ? 'Selesai ✓' : 'Tandai Selesai'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Tombol kembali di bawah konten */}
        <TouchableOpacity onPress={handleBack} style={ds.backBtnLarge}>
          <Ionicons name="arrow-back-circle-outline" size={20} color="#fff" />
          <Text style={ds.backBtnLargeText}>Kembali ke Daftar</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

/** Komponen helper baris info — reusable di dalam screen ini */
function DetailRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={ds.row}>
      <Ionicons name={icon as any} size={16} color="#6b7280" />
      <Text style={ds.rowLabel}>{label}</Text>
      <Text style={ds.rowValue}>{value}</Text>
    </View>
  );
}

const ds = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    paddingTop: Platform.OS === 'web' ? 20 : 52,
    paddingBottom: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111827', textAlign: 'center', flex: 1 },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 80,
  },
  backBtnText: { fontSize: 13, fontWeight: '600', color: ACCENT },
  content: { flex: 1, padding: 20 },
  typeBadgeRow: { marginBottom: 12 },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  typeBadgeText: { fontSize: 12, fontWeight: '700' },
  itemTitle: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 20, lineHeight: 30 },
  card: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 16,
    gap: 14,
    marginBottom: 24,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowLabel: { fontSize: 13, color: '#6b7280', fontWeight: '600', width: 80 },
  rowValue: { fontSize: 13, color: '#111827', fontWeight: '500', flex: 1 },
  priorityBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  priorityBadgeText: { fontSize: 12, fontWeight: '700' },
  statusBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  statusBtnText: { fontSize: 12, fontWeight: '700' },
  backBtnLarge: {
    backgroundColor: '#111827',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  backBtnLargeText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
