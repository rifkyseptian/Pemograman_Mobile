import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  Modal, Switch, FlatList, ActivityIndicator, Platform
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';

// Import Types (Menerapkan Type & Interface)
import { 
  daysList, DayType, ScheduleItem, TaskItem, PiketMap, CalendarEvent
} from './types';

// Import Styles (Menerapkan External Styling)
import { s, ACCENT, calendarStyles } from './styles';
import { useAuth } from './context/AuthContext';
import { getPublicHolidays } from './services/calendarApi';
import { createSchedule, getSchedules, removeSchedule, ScheduleInput, updateSchedule } from './services/scheduleApi';
import { getApiErrorMessage } from './services/apiRequest';
import { recognizeScheduleText } from './services/scheduleOcr';
import { extractScheduleFields } from './services/scheduleParser';

const dateToKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const keyToDate = (key: string): Date => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const weekdayOf = (date: Date): DayType => daysList[(date.getDay() + 6) % 7] as DayType;

const dateLabel = (key: string, withYear = false): string => keyToDate(key).toLocaleDateString('id-ID', {
  weekday: 'long', day: 'numeric', month: 'long', ...(withYear ? { year: 'numeric' } : {}),
});

export default function App() {
  const { currentUser, logout } = useAuth();
  const [role, setRole] = useState<'Pelajar' | 'Mahasiswa'>('Pelajar');
  const [activeTab, setActiveTab] = useState<'today' | 'jadwal' | 'tugas' | 'pengingat'>('today');
  const [selectedDate, setSelectedDate] = useState(() => dateToKey(new Date()));
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [taskFilter, setTaskFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(true);
  const [schedulesError, setSchedulesError] = useState<string | null>(null);
  const [scheduleReloadKey, setScheduleReloadKey] = useState(0);
  const [scheduleSaveInProgress, setScheduleSaveInProgress] = useState(false);
  const [deletingScheduleId, setDeletingScheduleId] = useState<string | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [calendarReloadKey, setCalendarReloadKey] = useState(0);

  const [piket, setPiket] = useState<PiketMap>({
    Senin: '', Selasa: '', Rabu: '', Kamis: '', Jumat: '', Sabtu: '', Minggu: '',
  });

  const [tasksByRole, setTasksByRole] = useState<Record<'Pelajar' | 'Mahasiswa', TaskItem[]>>(() => ({
    Pelajar: [
      { id: 'pelajar-t1', title: 'PR Matematika Latihan 3', deadline: new Date(Date.now() + 86400000).toISOString(), priority: 'High', category: 'Individu', completed: false },
      { id: 'pelajar-t2', title: 'Makalah Sejarah Perjuangan Kemerdekaan', deadline: new Date(Date.now() + 172800000).toISOString(), priority: 'Medium', category: 'Kelompok', completed: false },
    ],
    Mahasiswa: [
      { id: 'mahasiswa-t1', title: 'Implementasi Sensor Accelerometer', deadline: new Date(Date.now() + 86400000).toISOString(), priority: 'High', category: 'Individu', completed: false },
      { id: 'mahasiswa-t2', title: 'Laporan Praktikum Pemrograman Mobile', deadline: new Date(Date.now() + 172800000).toISOString(), priority: 'Medium', category: 'Individu', completed: false },
      { id: 'mahasiswa-t3', title: 'Review Materi Integrasi Sensor', deadline: new Date(Date.now() + 259200000).toISOString(), priority: 'Medium', category: 'Kelompok', completed: false },
    ],
  }));
  const tasks = tasksByRole[role];
  const setTasks = (update: React.SetStateAction<TaskItem[]>) => {
    setTasksByRole((current) => ({
      ...current,
      [role]: typeof update === 'function' ? update(current[role]) : update,
    }));
  };

  const [settings, setSettings] = useState({ classReminder: true, nightReminder: true, nightReminderTime: '20:00' });

  // Modals
  const [isRoleModalVisible, setRoleModalVisible] = useState(false);
  const [isScheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [isTaskModalVisible, setTaskModalVisible] = useState(false);
  const [isPiketModalVisible, setPiketModalVisible] = useState(false);
  const [isScheduleScannerVisible, setScheduleScannerVisible] = useState(false);
  const [isCameraReady, setCameraReady] = useState(false);
  const [isScanProcessing, setScanProcessing] = useState(false);
  const [scannedText, setScannedText] = useState('');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const scheduleCameraRef = React.useRef<CameraView | null>(null);

  // Form state
  const [editId, setEditId] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [timeStart, setTimeStart] = useState('');
  const [timeEnd, setTimeEnd] = useState('');
  const [scheduleDay, setScheduleDay] = useState<DayType>(() => weekdayOf(new Date()));
  const [teacher, setTeacher] = useState('');
  const [room, setRoom] = useState('');
  const [sks, setSks] = useState('3');
  const [piketInput, setPiketInput] = useState('');

  const [taskTitle, setTaskTitle] = useState('');
  const [taskDate, setTaskDate] = useState(() => dateToKey(new Date()));
  const [taskPriority, setTaskPriority] = useState('Medium');
  const [taskCategory, setTaskCategory] = useState('Individu');

  const [toast, setToast] = useState({ visible: false, title: '', body: '' });

  const selectedDay = weekdayOf(keyToDate(selectedDate));
  const visibleYear = visibleMonth.getFullYear();
  const visibleMonthNumber = visibleMonth.getMonth() + 1;
  const visibleMonthKey = `${visibleYear}-${String(visibleMonthNumber).padStart(2, '0')}`;
  const todayKey = dateToKey(new Date());
  const todayDay = weekdayOf(new Date());
  const taskDateKey = (task: TaskItem) => dateToKey(new Date(task.deadline));
  const urgentTaskCutoff = new Date();
  urgentTaskCutoff.setDate(urgentTaskCutoff.getDate() + 3);
  const urgentTaskCutoffKey = dateToKey(urgentTaskCutoff);
  const isUrgentTask = (task: TaskItem) => !task.completed && (
    task.priority === 'High' || taskDateKey(task) <= urgentTaskCutoffKey
  );
  const selectedDateUrgentTasks = tasks
    .filter((task) => taskDateKey(task) === selectedDate && isUrgentTask(task))
    .sort((first, second) => first.deadline.localeCompare(second.deadline));
  const selectedDateSchedules = schedules
    .filter((item) => item.day === selectedDay)
    .sort((first, second) => first.timeStart.localeCompare(second.timeStart));
  const visibleMonthHolidays = calendarEvents.filter((event) => event.date.startsWith(`${visibleMonthKey}-`));
  const monthStart = new Date(visibleYear, visibleMonth.getMonth(), 1);
  const calendarStart = new Date(visibleYear, visibleMonth.getMonth(), 1 - ((monthStart.getDay() + 6) % 7));
  const calendarDates = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);
    return date;
  });
  const scheduleDays = new Set(schedules.map((item) => item.day));
  const holidayDates = new Set(calendarEvents.map((event) => event.date));
  const urgentTaskDates = new Set(tasks.filter(isUrgentTask).map(taskDateKey));

  useEffect(() => {
    let isCurrent = true;
    const loadSchedules = async () => {
      setSchedulesLoading(true);
      setSchedulesError(null);
      try {
        const items = await getSchedules();
        if (isCurrent) setSchedules(items);
      } catch (error) {
        if (isCurrent) setSchedulesError(getApiErrorMessage(error, 'jadwal'));
      } finally {
        if (isCurrent) setSchedulesLoading(false);
      }
    };
    void loadSchedules();
    return () => { isCurrent = false; };
  }, [scheduleReloadKey]);

  useEffect(() => {
    let isCurrent = true;

    const loadCalendar = async () => {
      setCalendarLoading(true);
      setCalendarError(null);
      try {
        const events = await getPublicHolidays(visibleYear);
        if (isCurrent) setCalendarEvents(events);
      } catch (error) {
        if (isCurrent) {
          setCalendarEvents([]);
          setCalendarError(getApiErrorMessage(error, 'kalender libur'));
        }
      } finally {
        if (isCurrent) setCalendarLoading(false);
      }
    };

    void loadCalendar();
    return () => { isCurrent = false; };
  }, [calendarReloadKey, visibleYear]);

  useEffect(() => {
    if (currentUser?.role) {
      setRole(currentUser.role);
    }
  }, [currentUser]);


  // Task 03: Alur Logout aman
  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  // Custom Function dengan Parameter (Sesuai Kriteria Modul)
  const showToast = (title: string, body: string) => {
    setToast({ visible: true, title, body });
    setTimeout(() => setToast({ visible: false, title: '', body: '' }), 3000);
  };

  const retrySchedules = () => {
    setSchedulesError(null);
    setSchedulesLoading(true);
    setScheduleReloadKey((key) => key + 1);
  };

  const retryCalendar = () => {
    setCalendarError(null);
    setCalendarLoading(true);
    setCalendarReloadKey((key) => key + 1);
  };

  // Custom Function Return String (Sesuai Kriteria Modul)
  const getHeaderTitle = (tab: string, userRole: string): string => {
    if (tab === 'today') return 'Hari Ini';
    if (tab === 'jadwal') return userRole === 'Mahasiswa' ? 'Jadwal Kuliah' : 'Jadwal Pelajaran';
    if (tab === 'tugas') return 'Tugas & Catatan';
    return 'Pengaturan Pengingat';
  };

  // Custom Function Return Color (Sesuai Kriteria Modul)
  const getPriorityColor = (priority: string): string => {
    if (priority === 'High') return '#ef4444'; // Merah
    if (priority === 'Medium') return '#f59e0b'; // Kuning
    return '#10b981'; // Hijau
  };

  /* ── CRUD helpers ────────────────────────────────── */
  const selectCalendarDate = (date: Date) => {
    setSelectedDate(dateToKey(date));
    if (date.getMonth() !== visibleMonth.getMonth() || date.getFullYear() !== visibleMonth.getFullYear()) {
      setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    }
  };

  const moveCalendarMonth = (offset: number) => {
    setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + offset, 1));
  };

  const openAddSchedule = () => {
    setEditId(null);
    setSubject('');
    setScheduleDay(selectedDay);
    setTimeStart('');
    setTimeEnd('');
    setTeacher('');
    setRoom('');
    setSks('3');
    setScannedText('');
    setScheduleModalVisible(true);
  };

  const openEditSchedule = (item: ScheduleItem) => {
    setEditId(item.id);
    setSubject(item.subject);
    setScheduleDay(item.day);
    setTimeStart(item.timeStart);
    setTimeEnd(item.timeEnd);
    setTeacher(item.teacher);
    setRoom(item.room);
    setSks(String(item.sks));
    setScannedText('');
    setScheduleModalVisible(true);
  };

  const openScheduleScanner = async () => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && !navigator.mediaDevices?.getUserMedia) {
      showToast('Kamera tidak tersedia', 'Gunakan browser modern melalui localhost/HTTPS atau aplikasi di perangkat.');
      return;
    }

    try {
      const permission = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
      if (!permission.granted) {
        showToast('Izin kamera diperlukan', 'Izinkan akses kamera untuk memotret jadwal.');
        return;
      }
      setCameraReady(false);
      setScheduleScannerVisible(true);
    } catch (error) {
      showToast('Kamera tidak dapat dibuka', error instanceof Error ? error.message : 'Periksa izin kamera perangkat.');
    }
  };

  const scanScheduleImage = async (imageUri: string) => {
    if (isScanProcessing) return;
    setScanProcessing(true);
    try {
      const recognizedText = await recognizeScheduleText(imageUri);
      if (!recognizedText.trim()) throw new Error('Teks tidak terbaca. Coba foto yang lebih terang dan fokus.');

      setScannedText(recognizedText.trim());
      const fields = extractScheduleFields(recognizedText, scheduleDay);
      if (fields.subject) setSubject(fields.subject);
      if (fields.day) setScheduleDay(fields.day);
      if (fields.timeStart) setTimeStart(fields.timeStart);
      if (fields.timeEnd) setTimeEnd(fields.timeEnd);
      showToast('Scan selesai', 'Periksa dan koreksi data jadwal sebelum menyimpannya.');
    } catch (error) {
      showToast('Scan jadwal gagal', error instanceof Error ? error.message : 'Coba foto ulang jadwal dengan lebih jelas.');
    } finally {
      setScanProcessing(false);
    }
  };

  const pickSchedulePhoto = async () => {
    if (isScanProcessing) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 1,
      });
      if (result.canceled) return;
      const imageUri = result.assets[0]?.uri;
      if (!imageUri) throw new Error('Foto jadwal tidak dapat dibuka.');
      await scanScheduleImage(imageUri);
    } catch (error) {
      showToast('Foto tidak dapat diproses', error instanceof Error ? error.message : 'Pilih gambar jadwal lain.');
    }
  };

  const captureAndScanSchedule = async () => {
    if (!scheduleCameraRef.current || !isCameraReady || isScanProcessing) return;
    try {
      const photo = await scheduleCameraRef.current.takePictureAsync({ quality: 0.85 });
      if (!photo?.uri) throw new Error('Foto jadwal tidak berhasil diambil.');
      setScheduleScannerVisible(false);
      await scanScheduleImage(photo.uri);
    } catch (error) {
      setScheduleScannerVisible(false);
      showToast('Scan jadwal gagal', error instanceof Error ? error.message : 'Coba foto ulang jadwal dengan lebih jelas.');
    }
  };

  const saveSchedule = async () => {
    if (scheduleSaveInProgress) return;
    if (!subject.trim() || !scheduleDay || !timeStart || !timeEnd) {
      showToast('Data belum lengkap', 'Isi mata kuliah, hari, dan waktu terlebih dahulu.');
      return;
    }
    const input: ScheduleInput = {
      subject: subject.trim(),
      day: scheduleDay,
      timeStart,
      timeEnd,
      teacher,
      room,
      sks: parseInt(sks, 10) || 0,
    };

    setScheduleSaveInProgress(true);
    try {
      const saved = editId ? await updateSchedule(editId, input) : await createSchedule(input);
      setSchedules((current) => [...current.filter((item) => item.id !== saved.id), saved]
        .sort((first, second) => daysList.indexOf(first.day) - daysList.indexOf(second.day) || first.timeStart.localeCompare(second.timeStart)));
      setScheduleModalVisible(false);
      const occurrence = calendarDates.find((date) => date.getMonth() === visibleMonth.getMonth() && weekdayOf(date) === saved.day);
      if (occurrence) selectCalendarDate(occurrence);
      showToast('Jadwal tersimpan', 'Data berhasil disimpan melalui API kalender.');
    } catch (error) {
      showToast('Gagal menyimpan jadwal', getApiErrorMessage(error, 'jadwal'));
    } finally {
      setScheduleSaveInProgress(false);
    }
  };

  const deleteSchedule = async (id: string) => {
    if (deletingScheduleId) return;
    setDeletingScheduleId(id);
    try {
      await removeSchedule(id);
      setSchedules((current) => current.filter((item) => item.id !== id));
      showToast('Jadwal dihapus', 'Perubahan berhasil disimpan melalui API.');
    } catch (error) {
      showToast('Gagal menghapus jadwal', getApiErrorMessage(error, 'jadwal'));
    } finally {
      setDeletingScheduleId(null);
    }
  };

  const openAddTask = () => {
    setEditId(null);
    setTaskTitle('');
    setTaskDate(selectedDate);
    setTaskPriority('Medium');
    setTaskCategory('Individu');
    setTaskModalVisible(true);
  };

  const saveTask = () => {
    const dueDate = keyToDate(taskDate);
    if (!taskTitle.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(taskDate) || dateToKey(dueDate) !== taskDate) {
      showToast('Data belum lengkap', 'Isi judul tugas dan tanggal tenggat dengan format YYYY-MM-DD.');
      return;
    }
    dueDate.setHours(23, 59, 0, 0);
    const item: TaskItem = { id: editId || Date.now().toString(), title: taskTitle.trim(), deadline: dueDate.toISOString(), priority: role === 'Mahasiswa' ? taskPriority : 'Medium', category: role === 'Mahasiswa' ? taskCategory : 'Individu', completed: false };
    let list = [...tasks];
    if (editId) { const idx = list.findIndex(t => t.id === editId); if (idx > -1) { item.completed = list[idx].completed; list[idx] = item; } }
    else list.push(item);
    setTasks(list);
    setTaskModalVisible(false);
    setSelectedDate(taskDate);
    const taskDateValue = keyToDate(taskDate);
    setVisibleMonth(new Date(taskDateValue.getFullYear(), taskDateValue.getMonth(), 1));
  };

  const toggleTask = (id: string) => setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  const deleteTask = (id: string) => setTasks(tasks.filter(t => t.id !== id));
  const savePiket = () => { setPiket({ ...piket, [selectedDay]: piketInput }); setPiketModalVisible(false); };

  /* ── VIEWS ───────────────────────────────────────── */
  const renderTodayView = () => {
    const todaySchedules = schedules
      .filter((item) => item.day === todayDay)
      .sort((first, second) => first.timeStart.localeCompare(second.timeStart));
    const urgentTasks = tasks.filter(isUrgentTask)
      .sort((first, second) => first.deadline.localeCompare(second.deadline))
      .slice(0, 3);
    return (
      <ScrollView style={s.content} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Date banner */}
        <View style={s.dateBanner}>
          <View>
            <Text style={s.dateBannerLabel}>HARI INI · {todayDay.toUpperCase()}</Text>
            <Text style={s.dateBannerDate}>{dateLabel(todayKey)}</Text>
          </View>
          <Ionicons name="calendar" size={24} color={ACCENT} />
        </View>

        {/* Primitive Map Loop (Sesuai Kriteria Modul) */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>JADWAL KELAS</Text>
            <View style={s.badge}><Text style={s.badgeText}>{todaySchedules.length} Kelas</Text></View>
          </View>
          
          {schedulesLoading ? (
            <View style={[s.emptyCard, { flexDirection: 'row', gap: 10 }]}><ActivityIndicator color={ACCENT} /><Text style={s.emptyText}>Memuat jadwal dari API…</Text></View>
          ) : schedulesError ? (
            <View style={s.apiStateCard}>
              <Ionicons name="alert-circle-outline" size={24} color="#dc2626" />
              <Text style={s.apiStateMessage}>{schedulesError}</Text>
              <TouchableOpacity accessibilityRole="button" disabled={schedulesLoading} onPress={retrySchedules} style={[s.retryBtn, schedulesLoading && s.buttonDisabled]}>
                <Text style={s.retryBtnText}>{schedulesLoading ? 'Mencoba…' : 'Coba lagi'}</Text>
              </TouchableOpacity>
            </View>
          ) : todaySchedules.length === 0 ? (
            <View style={s.emptyCard}>
              <Ionicons name="cafe-outline" size={32} color="#9ca3af" />
              <Text style={[s.emptyText, { marginTop: 8 }]}>Tidak ada jadwal hari ini.</Text>
            </View>
          ) : todaySchedules.map((item) => (
            // router.replace() — kartu jadwal di "Hari Ini" menggunakan replace
            // agar tidak menumpuk history saat berpindah antar detail jadwal
            <TouchableOpacity
              key={item.id}
              style={s.scheduleCard}
              onPress={() => router.replace({
                pathname: '/detail',
                params: {
                  type: 'schedule',
                  id: item.id,
                  title: item.subject,
                  timeStart: item.timeStart,
                  timeEnd: item.timeEnd,
                  teacher: item.teacher,
                  room: item.room,
                  sks: String(item.sks),
                  day: todayDay,
                },
              })}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>{item.subject}{role === 'Mahasiswa' ? ` (${item.sks} SKS)` : ''}</Text>
                <Text style={s.cardSub}>
                  <Ionicons name="time-outline" size={12} /> {item.timeStart} – {item.timeEnd} • <Ionicons name="location-outline" size={12} /> {item.room}
                </Text>
                <Text style={s.cardMeta}>{role === 'Mahasiswa' ? 'Dosen' : 'Guru'}: {item.teacher}</Text>
              </View>
              <View style={s.timeBadge}><Text style={s.timeBadgeText}>{item.timeStart}</Text></View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Urgent tasks */}
        <View style={[s.section, s.urgentTasksSection]}>
          <Text style={s.sectionTitle}>TUGAS MENDESAK</Text>
          {urgentTasks.length === 0 ? (
            <View style={s.emptyCard}>
              <Ionicons name="checkmark-circle-outline" size={32} color="#10b981" />
              <Text style={[s.emptyText, { marginTop: 8 }]}>Semua beres! 🎉</Text>
            </View>
          ) : urgentTasks.map(t => (
            <View key={t.id} style={s.taskCard}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>{t.title}</Text>
                <Text style={[s.cardSub, { color: '#ef4444' }]}>
                  <Ionicons name="alert-circle-outline" size={12} /> Tenggat: {new Date(t.deadline).toLocaleDateString('id-ID')}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  };

  const renderJadwalView = () => (
    <ScrollView style={calendarStyles.screen} contentContainerStyle={calendarStyles.content}>
      <View style={calendarStyles.calendarPageHeader}>
        <View style={{ flex: 1 }}>
          <Text style={calendarStyles.calendarPageTitle}>Kalender akademik</Text>
          <Text style={calendarStyles.calendarPageSubtitle}>Kelola jadwal dan tenggat dalam satu kalender.</Text>
        </View>
        <TouchableOpacity onPress={openAddSchedule} style={calendarStyles.primaryAddButton} accessibilityRole="button" accessibilityLabel="Tambah jadwal">
          <Ionicons name="add" size={17} color="#fff" />
          <Text style={calendarStyles.primaryAddButtonText}>Tambah jadwal</Text>
        </TouchableOpacity>
      </View>

      <View style={calendarStyles.calendarCard}>
        <View style={calendarStyles.monthHeader}>
          <View style={calendarStyles.monthTitleWrap}>
            <Ionicons name="calendar-outline" size={16} color={ACCENT} />
            <Text style={calendarStyles.monthTitle}>{visibleMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</Text>
          </View>
          <View style={calendarStyles.monthControls}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Bulan sebelumnya" onPress={() => moveCalendarMonth(-1)} style={calendarStyles.monthArrow}>
              <Ionicons name="chevron-back" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Bulan berikutnya" onPress={() => moveCalendarMonth(1)} style={calendarStyles.monthArrow}>
              <Ionicons name="chevron-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={calendarStyles.calendarGrid}>
          {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((day) => (
            <View key={day} style={calendarStyles.weekdayCell}><Text style={calendarStyles.weekdayText}>{day}</Text></View>
          ))}
          {calendarDates.map((date) => {
            const key = dateToKey(date);
            const inMonth = date.getMonth() === visibleMonth.getMonth();
            const isSelected = key === selectedDate;
            const isToday = key === todayKey;
            const hasSchedule = scheduleDays.has(weekdayOf(date));
            const hasHoliday = holidayDates.has(key);
            const hasUrgentTask = urgentTaskDates.has(key);
            return (
              <TouchableOpacity key={key} onPress={() => selectCalendarDate(date)} style={calendarStyles.dateCell} accessibilityRole="button" accessibilityLabel={`${dateLabel(key, true)}${hasSchedule ? ', ada jadwal' : ''}${hasHoliday ? ', libur nasional' : ''}${hasUrgentTask ? ', ada tugas mendesak' : ''}`}>
                <View style={[calendarStyles.dateCircle, isSelected && calendarStyles.selectedDateCircle, isToday && !isSelected && calendarStyles.todayDateCircle]}>
                  <Text style={[calendarStyles.dateText, !inMonth && calendarStyles.outsideMonthText, isSelected && calendarStyles.selectedDateText]}>{date.getDate()}</Text>
                </View>
                <View style={calendarStyles.dateDots}>
                  {hasSchedule && <View style={calendarStyles.scheduleDot} />}
                  {hasHoliday && <View style={calendarStyles.holidayDot} />}
                  {hasUrgentTask && <View style={calendarStyles.urgentTaskDot} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={calendarStyles.calendarFooter}>
          <View style={calendarStyles.legendRow}>
            <View style={calendarStyles.legendItem}><View style={calendarStyles.scheduleDot} /><Text style={calendarStyles.legendText}>Jadwal</Text></View>
            <View style={calendarStyles.legendItem}><View style={calendarStyles.holidayDot} /><Text style={calendarStyles.legendText}>Libur nasional</Text></View>
            <View style={calendarStyles.legendItem}><View style={calendarStyles.urgentTaskDot} /><Text style={calendarStyles.legendText}>Tugas mendesak</Text></View>
          </View>
          <TouchableOpacity onPress={() => { selectCalendarDate(new Date()); setVisibleMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); }} style={calendarStyles.todayButton}>
            <Text style={calendarStyles.todayButtonText}>Hari ini</Text>
          </TouchableOpacity>
        </View>
        {calendarLoading && <Text style={calendarStyles.calendarHint}>Memuat penanda libur dari API…</Text>}
        {!calendarLoading && !calendarError && calendarEvents.length === 0 && (
          <Text style={calendarStyles.calendarHint}>Tidak ada data libur nasional untuk tahun ini.</Text>
        )}
        {calendarError && (
          <View style={s.apiStateCard}>
            <Ionicons name="alert-circle-outline" size={20} color="#dc2626" />
            <Text style={s.apiStateMessage}>{calendarError}</Text>
            <TouchableOpacity accessibilityRole="button" disabled={calendarLoading} onPress={retryCalendar} style={[s.retryBtn, calendarLoading && s.buttonDisabled]}>
              <Text style={s.retryBtnText}>{calendarLoading ? 'Mencoba…' : 'Coba lagi'}</Text>
            </TouchableOpacity>
          </View>
        )}
        {schedulesError && (
          <View style={s.apiStateCard}>
            <Ionicons name="alert-circle-outline" size={20} color="#dc2626" />
            <Text style={s.apiStateMessage}>{schedulesError}</Text>
            <TouchableOpacity accessibilityRole="button" disabled={schedulesLoading} onPress={retrySchedules} style={[s.retryBtn, schedulesLoading && s.buttonDisabled]}>
              <Text style={s.retryBtnText}>{schedulesLoading ? 'Mencoba…' : 'Coba lagi'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={calendarStyles.agendaCard}>
        <View style={calendarStyles.agendaHeader}>
          <View style={{ flex: 1 }}>
            <View style={calendarStyles.agendaTitleRow}>
              <Ionicons name="time-outline" size={15} color={ACCENT} />
              <Text style={calendarStyles.agendaTitle}>Agenda {selectedDate === todayKey ? 'hari ini' : ''}</Text>
            </View>
            <Text style={calendarStyles.agendaDate}>{dateLabel(selectedDate, true)}</Text>
          </View>
          <Text style={calendarStyles.agendaCount}>{selectedDateSchedules.length} jadwal · {selectedDateUrgentTasks.length} tugas</Text>
        </View>

        {schedulesLoading ? (
          <View style={calendarStyles.agendaEmpty}><ActivityIndicator color={ACCENT} /><Text style={calendarStyles.agendaEmptyText}>Mengambil jadwal dari API…</Text></View>
        ) : schedulesError ? (
          <View style={calendarStyles.agendaEmpty}>
            <Ionicons name="alert-circle-outline" size={24} color="#dc2626" />
            <Text style={calendarStyles.agendaEmptyText}>{schedulesError}</Text>
            <TouchableOpacity accessibilityRole="button" onPress={retrySchedules} style={[s.retryBtn, schedulesLoading && s.buttonDisabled]}>
              <Text style={s.retryBtnText}>Coba lagi</Text>
            </TouchableOpacity>
          </View>
        ) : selectedDateSchedules.length === 0 && selectedDateUrgentTasks.length === 0 ? (
          <View style={calendarStyles.agendaEmpty}>
            <Ionicons name="calendar-clear-outline" size={24} color="#9ca3af" />
            <Text style={calendarStyles.agendaEmptyText}>Belum ada jadwal pada tanggal ini.</Text>
          </View>
        ) : selectedDateSchedules.map((item) => (
          <TouchableOpacity key={item.id} style={calendarStyles.agendaEvent} onPress={() => router.push({
            pathname: '/detail',
            params: { type: 'schedule', id: item.id, title: item.subject, timeStart: item.timeStart, timeEnd: item.timeEnd, teacher: item.teacher, room: item.room, sks: String(item.sks), day: item.day },
          })}>
            <View style={calendarStyles.eventTime}>
              <Text style={calendarStyles.eventTimeStart}>{item.timeStart}</Text>
              <Text style={calendarStyles.eventTimeEnd}>{item.timeEnd}</Text>
            </View>
            <View style={calendarStyles.eventDetails}>
              <Text style={calendarStyles.eventTitle}>{item.subject}</Text>
              <Text style={calendarStyles.eventMeta}>{item.room}{item.teacher ? ` · ${item.teacher}` : ''}</Text>
            </View>
            <View style={calendarStyles.eventActions}>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Ubah ${item.subject}`} onPress={(event) => { event.stopPropagation?.(); openEditSchedule(item); }}>
                <Ionicons name="pencil-outline" size={16} color={ACCENT} />
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Hapus ${item.subject}`} disabled={deletingScheduleId !== null} onPress={(event) => { event.stopPropagation?.(); void deleteSchedule(item.id); }}>
                <Ionicons name={deletingScheduleId === item.id ? 'hourglass-outline' : 'trash-outline'} size={16} color={deletingScheduleId ? '#9ca3af' : '#ef4444'} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}

        {selectedDateUrgentTasks.length > 0 && (
          <View style={calendarStyles.urgentTasksSection}>
            <View style={calendarStyles.urgentTasksHeading}>
              <Ionicons name="alert-circle" size={15} color="#dc2626" />
              <Text style={calendarStyles.urgentTasksTitle}>Tugas mendesak</Text>
            </View>
            {selectedDateUrgentTasks.map((task) => (
              <View key={task.id} style={calendarStyles.urgentTaskCard}>
                <TouchableOpacity style={calendarStyles.urgentTaskDetails} onPress={() => router.push({
                  pathname: '/detail',
                  params: { type: 'task', id: task.id, title: task.title, deadline: task.deadline, priority: task.priority, category: task.category },
                })}>
                  <Text style={calendarStyles.eventTitle}>{task.title}</Text>
                  <Text style={calendarStyles.eventMeta}>Tenggat {dateLabel(taskDateKey(task))} · {task.priority}</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Tandai ${task.title} selesai`} onPress={() => toggleTask(task.id)} style={calendarStyles.taskCompleteButton}>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#16a34a" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={calendarStyles.agendaBottomRow}>
          <Text style={calendarStyles.agendaSource}>Jadwal dari REST API · GET JSON</Text>
          {calendarLoading && <Text style={calendarStyles.agendaSource}>Memuat libur…</Text>}
        </View>
      </View>

      {role === 'Pelajar' && (
        <View style={calendarStyles.piketCard}>
          <View style={calendarStyles.agendaHeader}>
            <Text style={calendarStyles.agendaTitle}>Jadwal piket · {selectedDay}</Text>
            <TouchableOpacity onPress={() => { setPiketInput(piket[selectedDay]); setPiketModalVisible(true); }}><Text style={calendarStyles.piketAction}>Atur</Text></TouchableOpacity>
          </View>
          <Text style={calendarStyles.agendaEventMeta}>{piket[selectedDay] || 'Belum ada jadwal piket'}</Text>
        </View>
      )}
    </ScrollView>
  );

  const renderTugasView = () => {
    let filtered = tasks;
    if (taskFilter === 'pending') filtered = tasks.filter(t => !t.completed);
    if (taskFilter === 'completed') filtered = tasks.filter(t => t.completed);

    return (
      <View style={{ flex: 1 }}>
        <View style={[s.sectionHeader, { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }]}>
          <Text style={s.sectionTitle}>DAFTAR TUGAS</Text>
          <TouchableOpacity onPress={openAddTask} style={s.addBtn}>
            <Text style={s.addBtnText}><Ionicons name="add" size={14} /> Tambah</Text>
          </TouchableOpacity>
        </View>

        <View style={s.filterRow}>
          {(['all', 'pending', 'completed'] as const).map(f => (
            <TouchableOpacity key={f} onPress={() => setTaskFilter(f)} style={[s.filterTab, taskFilter === f && s.filterTabActive]}>
              <Text style={[s.filterTabText, taskFilter === f && s.filterTabTextActive]}>
                {f === 'all' ? 'Semua' : f === 'pending' ? 'Belum Selesai' : 'Selesai'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* FlatList (Sesuai Kriteria Modul) */}
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          renderItem={({ item }) => (
            // router.push() — navigasi ke detail tugas saat kartu ditekan
            <TouchableOpacity
              style={[s.taskCard, item.completed && { opacity: 0.5 }]}
              onPress={() => router.push({
                pathname: '/detail',
                params: {
                  type: 'task',
                  id: item.id,
                  title: item.title,
                  deadline: item.deadline,
                  priority: item.priority,
                  category: item.category,
                },
              })}
            >
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={[s.cardTitle, item.completed && { textDecorationLine: 'line-through', color: '#9ca3af' }]}>{item.title}</Text>
                <Text style={[s.cardSub, { marginTop: 4 }]}>Tenggat: {new Date(item.deadline).toLocaleDateString('id-ID')}</Text>
                
                {role === 'Mahasiswa' && (
                  <View style={s.tagRow}>
                    {/* Inline Styling Dinamis (Sesuai Kriteria Modul) */}
                    <Text style={[s.tag, { backgroundColor: getPriorityColor(item.priority) + '20', color: getPriorityColor(item.priority) }]}>
                      {item.priority}
                    </Text>
                    <Text style={[s.tag, { marginLeft: 6 }]}>{item.category}</Text>
                  </View>
                )}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 12 }}>
                <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); toggleTask(item.id); }}>
                  <Ionicons name={item.completed ? "close-circle" : "checkmark-circle"} size={22} color={item.completed ? '#6b7280' : '#16a34a'} />
                </TouchableOpacity>
                <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); deleteTask(item.id); }}>
                  <Ionicons name="trash-outline" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}

          ListEmptyComponent={
             <View style={s.emptyCard}>
                <Ionicons name="document-text-outline" size={32} color="#9ca3af" />
                <Text style={[s.emptyText, { marginTop: 8 }]}>Tidak ada tugas dalam kategori ini.</Text>
             </View>
          }
        />
      </View>
    );
  };

  const renderPengingatView = () => (
    <ScrollView style={s.content} contentContainerStyle={{ paddingBottom: 100 }}>
      <View style={s.infoBox}>
        <Ionicons name="information-circle" size={20} color={ACCENT} />
        <Text style={s.infoText}>Pengingat hanya berfungsi saat aplikasi terbuka.</Text>
      </View>

      <View style={s.reminderCard}>
        <View style={{ flex: 1 }}>
          <Text style={s.reminderTitle}>Pengingat Kelas</Text>
          <Text style={s.reminderSub}>Notif 15 menit sebelum kelas dimulai</Text>
        </View>
        <Switch value={settings.classReminder} onValueChange={v => setSettings({ ...settings, classReminder: v })} trackColor={{ false: '#d1d5db', true: ACCENT }} />
      </View>

      <View style={s.reminderCard}>
        <View style={{ flex: 1 }}>
          <Text style={s.reminderTitle}>Pengingat Malam</Text>
          <Text style={s.reminderSub}>Evaluasi tugas & jadwal esok</Text>
        </View>
        <Switch value={settings.nightReminder} onValueChange={v => setSettings({ ...settings, nightReminder: v })} trackColor={{ false: '#d1d5db', true: ACCENT }} />
      </View>

      <TouchableOpacity onPress={() => showToast('Notifikasi Aktif', 'Pengingat telah dinyalakan.')} style={s.testBtn}>
        <Ionicons name="notifications" size={16} color="#fff" />
        <Text style={s.testBtnText}>Coba Notifikasi</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  /* ── MAIN RENDER ─────────────────────────────────── */
  return (
    <View style={s.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>{getHeaderTitle(activeTab, role)}</Text>
          <Text style={s.headerRole}>{currentUser ? `${role} • ${currentUser.name}` : role}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            onPress={() => setRoleModalVisible(true)}
            style={s.roleBtn}
            accessibilityRole="button"
            accessibilityLabel="Ganti Peran"
          >
            <Ionicons name="person-outline" size={14} color={ACCENT} />
            <Text style={s.roleBtnText}>Ganti Peran</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleLogout}
            style={s.logoutBtn}
            accessibilityRole="button"
            accessibilityLabel="Tombol Keluar / Logout"
          >
            <Ionicons name="log-out-outline" size={16} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
        {activeTab === 'today' && renderTodayView()}
        {activeTab === 'jadwal' && renderJadwalView()}
        {activeTab === 'tugas' && renderTugasView()}
        {activeTab === 'pengingat' && renderPengingatView()}
      </View>

      {/* Bottom Nav */}
      <View style={s.bottomNav}>
        <TouchableOpacity onPress={() => setActiveTab('today')} style={s.navItem}>
          <Ionicons name={activeTab === 'today' ? 'home' : 'home-outline'} size={22} color={activeTab === 'today' ? ACCENT : '#9ca3af'} />
          <Text style={[s.navText, activeTab === 'today' && s.navTextActive]}>Hari Ini</Text>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={() => setActiveTab('jadwal')} style={s.navItem}>
          <Ionicons name={activeTab === 'jadwal' ? 'calendar' : 'calendar-outline'} size={22} color={activeTab === 'jadwal' ? ACCENT : '#9ca3af'} />
          <Text style={[s.navText, activeTab === 'jadwal' && s.navTextActive]}>Jadwal</Text>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={() => setActiveTab('tugas')} style={s.navItem}>
          <Ionicons name={activeTab === 'tugas' ? 'list' : 'list-outline'} size={22} color={activeTab === 'tugas' ? ACCENT : '#9ca3af'} />
          <Text style={[s.navText, activeTab === 'tugas' && s.navTextActive]}>Tugas</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setActiveTab('pengingat')} style={s.navItem}>
          <Ionicons name={activeTab === 'pengingat' ? 'alarm' : 'alarm-outline'} size={22} color={activeTab === 'pengingat' ? ACCENT : '#9ca3af'} />
          <Text style={[s.navText, activeTab === 'pengingat' && s.navTextActive]}>Notifikasi</Text>
        </TouchableOpacity>
      </View>

      {/* ── MODALS ─────────────────────────────────── */}
      <Modal visible={isRoleModalVisible} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Pilih Peran Anda</Text>
            <TouchableOpacity onPress={() => { setRole('Pelajar'); setRoleModalVisible(false); }} style={s.roleOption}>
              <Text style={s.roleOptionTitle}>Pelajar (SMP/SMA)</Text>
              <Text style={s.roleOptionSub}>Fitur: Mata pelajaran, Jadwal piket kelas</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setRole('Mahasiswa'); setRoleModalVisible(false); }} style={s.roleOption}>
              <Text style={s.roleOptionTitle}>Mahasiswa</Text>
              <Text style={s.roleOptionSub}>Fitur: Mata kuliah, SKS, Prioritas tugas</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setRoleModalVisible(false)} style={{ marginTop: 12 }}>
              <Text style={{ textAlign: 'center', color: '#ef4444', fontSize: 13, fontWeight: '600' }}>Batal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal form jadwal, tugas, dll disederhanakan tanpa merusak fungsionalitas */}
      {/* Schedule Modal */}
      <Modal visible={isScheduleModalVisible} transparent animationType="slide">
        <View style={s.modalOverlayBottom}>
          <ScrollView style={{ maxHeight: '90%' }} keyboardShouldPersistTaps="handled">
          <View style={s.modalSheet}>
            <Text style={s.modalTitle}>{editId ? 'Ubah Jadwal' : 'Tambah Jadwal'}</Text>
            <View style={s.scanActions}>
              <TouchableOpacity accessibilityRole="button" onPress={() => void openScheduleScanner()} style={s.scanScheduleBtn}>
                <Ionicons name="scan-outline" size={17} color={ACCENT} />
                <Text style={s.scanScheduleBtnText}>Foto & scan</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" onPress={() => void pickSchedulePhoto()} style={s.scanScheduleBtn}>
                <Ionicons name="images-outline" size={17} color={ACCENT} />
                <Text style={s.scanScheduleBtnText}>Pilih foto</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.scanHint}>Ambil foto atau pilih gambar jadwal. Periksa hasil OCR sebelum menyimpan.</Text>
            {isScanProcessing ? (
              <View style={s.scanProcessing}>
                <ActivityIndicator color={ACCENT} />
                <Text style={s.scanHint}>Membaca teks dari foto…</Text>
              </View>
            ) : scannedText ? (
              <View style={s.scanResultCard}>
                <Text style={s.scanResultTitle}>Teks hasil scan — periksa isian di bawah</Text>
                <Text numberOfLines={3} style={s.scanResultText}>{scannedText}</Text>
              </View>
            ) : null}
            <Text style={s.inputLabel}>{role === 'Mahasiswa' ? 'Mata Kuliah' : 'Mata Pelajaran'}</Text>
            <TextInput value={subject} onChangeText={setSubject} style={s.input} placeholder="Contoh: Matematika" />
            <Text style={s.inputLabel}>Hari</Text>
            <View style={calendarStyles.weekdayOptions}>
              {daysList.map((day) => (
                <TouchableOpacity key={day} onPress={() => setScheduleDay(day)} style={[calendarStyles.weekdayOption, scheduleDay === day && calendarStyles.weekdayOptionActive]} accessibilityRole="button" accessibilityState={{ selected: scheduleDay === day }}>
                  <Text style={[calendarStyles.weekdayOptionText, scheduleDay === day && calendarStyles.weekdayOptionTextActive]}>{day}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={calendarStyles.repeatHint}>Jadwal diulang setiap minggu pada hari yang dipilih.</Text>
            <View style={s.row}>
              <View style={{ flex: 1, marginRight: 6 }}>
                <Text style={s.inputLabel}>Jam Mulai</Text>
                <TextInput value={timeStart} onChangeText={setTimeStart} placeholder="08:00" style={s.input} />
              </View>
              <View style={{ flex: 1, marginLeft: 6 }}>
                <Text style={s.inputLabel}>Jam Selesai</Text>
                <TextInput value={timeEnd} onChangeText={setTimeEnd} placeholder="09:30" style={s.input} />
              </View>
            </View>
            <Text style={s.inputLabel}>{role === 'Mahasiswa' ? 'Dosen' : 'Guru'}</Text>
            <TextInput value={teacher} onChangeText={setTeacher} style={s.input} />
            <Text style={s.inputLabel}>Ruang</Text>
            <TextInput value={room} onChangeText={setRoom} style={s.input} />
            {role === 'Mahasiswa' && (<><Text style={s.inputLabel}>SKS</Text><TextInput value={sks} onChangeText={setSks} keyboardType="numeric" style={s.input} /></>)}
            <View style={[s.row, { marginTop: 16 }]}>
              <TouchableOpacity onPress={() => setScheduleModalVisible(false)} style={s.cancelBtn}><Text style={s.cancelBtnText}>Batal</Text></TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" disabled={scheduleSaveInProgress} onPress={saveSchedule} style={[s.saveBtn, scheduleSaveInProgress && s.buttonDisabled]}>
                {scheduleSaveInProgress ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Simpan</Text>}
              </TouchableOpacity>
            </View>
          </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Camera scanner. Image OCR runs locally on-device/browser. */}
      <Modal visible={isScheduleScannerVisible} animationType="slide" onRequestClose={() => setScheduleScannerVisible(false)}>
        <View style={s.scheduleScannerRoot}>
          <CameraView
            ref={scheduleCameraRef}
            style={s.scheduleScannerCamera}
            facing="back"
            mode="picture"
            onCameraReady={() => setCameraReady(true)}
            onMountError={({ message }) => {
              setScheduleScannerVisible(false);
              showToast('Kamera tidak dapat dibuka', message || 'Periksa izin kamera perangkat.');
            }}
          />
          <View style={s.scheduleScannerHeader}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Tutup pemindai" onPress={() => setScheduleScannerVisible(false)} style={s.scheduleScannerClose}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={s.scheduleScannerTitle}>Scan foto jadwal</Text>
              <Text style={s.scheduleScannerSub}>Pastikan teks terang, fokus, dan memenuhi bingkai.</Text>
            </View>
          </View>
          <View pointerEvents="none" style={s.scheduleScannerGuide} />
          <View style={s.scheduleScannerFooter}>
            <Text style={s.scheduleScannerSub}>Foto satu baris kelas agar hari dan jam terbaca dengan tepat.</Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Ambil foto dan scan jadwal"
              disabled={!isCameraReady || isScanProcessing}
              onPress={() => void captureAndScanSchedule()}
              style={[s.scheduleScannerCapture, (!isCameraReady || isScanProcessing) && s.buttonDisabled]}
            >
              {isScanProcessing ? <ActivityIndicator color="#111827" /> : <Ionicons name="scan" size={24} color="#111827" />}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Task Modal */}
      <Modal visible={isTaskModalVisible} transparent animationType="slide">
        <View style={s.modalOverlayBottom}>
          <View style={s.modalSheet}>
            <Text style={s.modalTitle}>{editId ? 'Ubah Tugas' : 'Tambah Tugas'}</Text>
            <Text style={s.inputLabel}>Judul Tugas</Text>
            <TextInput value={taskTitle} onChangeText={setTaskTitle} style={s.input} placeholder="PR Matematika Bab 2" />
            <Text style={s.inputLabel}>Tanggal Tenggat</Text>
            <TextInput value={taskDate} onChangeText={setTaskDate} style={s.input} placeholder="YYYY-MM-DD" />
            {role === 'Mahasiswa' && (
              <View style={s.row}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={s.inputLabel}>Prioritas</Text>
                  <View style={s.row}>
                    {['High', 'Medium', 'Low'].map(p => (
                      <TouchableOpacity key={p} onPress={() => setTaskPriority(p)} style={[s.chipBtn, taskPriority === p && s.chipBtnActive]}>
                        <Text style={[s.chipText, taskPriority === p && { color: '#fff' }]}>{p}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            )}
            <View style={[s.row, { marginTop: 16 }]}>
              <TouchableOpacity onPress={() => setTaskModalVisible(false)} style={s.cancelBtn}><Text style={s.cancelBtnText}>Batal</Text></TouchableOpacity>
              <TouchableOpacity onPress={saveTask} style={s.saveBtn}><Text style={s.saveBtnText}>Simpan</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Piket Modal */}
      <Modal visible={isPiketModalVisible} transparent animationType="slide">
        <View style={s.modalOverlayBottom}>
          <View style={s.modalSheet}>
            <Text style={s.modalTitle}>Atur Piket Hari {selectedDay}</Text>
            <TextInput value={piketInput} onChangeText={setPiketInput} multiline numberOfLines={3} style={[s.input, { height: 80, textAlignVertical: 'top' }]} placeholder="Andi, Budi — Menyapu" />
            <View style={[s.row, { marginTop: 16 }]}>
              <TouchableOpacity onPress={() => setPiketModalVisible(false)} style={s.cancelBtn}><Text style={s.cancelBtnText}>Batal</Text></TouchableOpacity>
              <TouchableOpacity onPress={savePiket} style={s.saveBtn}><Text style={s.saveBtnText}>Simpan</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Toast */}
      {toast.visible && (
        <View style={s.toast}>
          <Text style={s.toastTitle}>{toast.title}</Text>
          <Text style={s.toastBody}>{toast.body}</Text>
        </View>
      )}
    </View>
  );
}
