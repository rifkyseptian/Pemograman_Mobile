# API Jadwal dan Kalender

Project memakai API lokal Express untuk menyimpan agenda kelas di `api/data/schedules.json`.
UI kalender mengambil jadwal melalui service di `services/scheduleApi.ts`, lalu menandai
tanggal yang memiliki agenda. Hari libur nasional diambil terpisah dari Nager.Date.

## Menjalankan project web

Jalankan dari folder project, masing-masing di terminal sendiri:

```powershell
npm run api
```

```powershell
npm run web
```

API berjalan di `http://localhost:3001`; Expo web berjalan di alamat yang ditampilkan Expo.
Untuk mengubah alamat API aplikasi, set `EXPO_PUBLIC_API_URL` sebelum menjalankan Expo.

## Endpoint

| Method | Endpoint | Kegunaan |
| --- | --- | --- |
| GET | `/api/health` | Cek API aktif |
| GET | `/api/schedules` | Ambil semua jadwal |
| GET | `/api/schedules?day=Rabu` | Ambil jadwal rutin untuk hari tertentu |
| POST | `/api/schedules` | Tambah jadwal |
| PUT | `/api/schedules/:id` | Ubah jadwal |
| DELETE | `/api/schedules/:id` | Hapus jadwal |

Contoh body `POST` dan `PUT`:

```json
{
  "subject": "Pra Skripsi",
  "day": "Rabu",
  "timeStart": "07:00",
  "timeEnd": "09:00",
  "teacher": "Dr. Sari Wulandari",
  "room": "601 Gd B",
  "sks": 2
}
```

API mengembalikan JSON dengan field yang sama serta `id`. Jadwal bersifat mingguan, bukan
terikat ke tanggal tertentu. Kalender memetakan `day` ke semua tanggal yang cocok dalam
bulan yang ditampilkan, lalu menampilkan mata kuliah, waktu, ruang, dan pengajar saat tanggal
tersebut dipilih. Data awal berisi sembilan jadwal rutin untuk berbagai hari.

Tugas memiliki tanggal tenggat yang dipilih saat dibuat. Kalender menampilkan penanda merah
dan daftar tugas pada tanggal tenggatnya jika tugas belum selesai dan prioritasnya tinggi
atau tenggatnya tinggal tiga hari atau kurang. Data tugas masih dikelola oleh state aplikasi;
endpoint REST pada project ini saat ini menyimpan jadwal kelas.
