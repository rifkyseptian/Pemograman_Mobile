export const daysList = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'] as const;
export type DayType = typeof daysList[number];

export interface ScheduleItem {
  id: string;
  subject: string;
  day: DayType;
  timeStart: string;
  timeEnd: string;
  teacher: string;
  room: string;
  sks: number;
}

/** Public calendar item mapped from the Nager.Date REST API. */
export interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  name: string;
}

export interface TaskItem {
  id: string;
  title: string;
  deadline: string;
  priority: string;
  category: string;
  completed: boolean;
}

export type PiketMap = Record<DayType, string>;

// Types untuk Autentikasi dan Keamanan Sesi (Task 01 & Task 02)
export type UserRole = 'Pelajar' | 'Mahasiswa';

export interface UserSession {
  userId: string;
  name: string;
  identifier: string;
  role: UserRole;
  loginAt: string;
}

export interface RegisteredAccount {
  id: string;
  name: string;
  identifier: string;
  role: UserRole;
  passwordHash: string;
}

