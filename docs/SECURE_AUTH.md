# Autentikasi API dan protected endpoint

## Alur aplikasi

- `POST /api/auth/login` memeriksa email, kata sandi, dan peran pada server, lalu mengembalikan access token JWT (HS256) dengan masa berlaku 8 jam.
- `POST /api/auth/register` membuat akun baru dengan kata sandi yang di-hash menggunakan scrypt, lalu mengembalikan token.
- `GET /api/auth/session` memvalidasi tanda tangan, masa berlaku, dan status pencabutan JWT saat aplikasi memulihkan login.
- Aplikasi menyimpan token dan profil sesi melalui `expo-secure-store` di iOS/Android.
- Semua operasi `/api/schedules` memerlukan `Authorization: Bearer <token>`; `/api/health` tetap publik.
- `POST /api/auth/logout` mencabut JWT melalui klaim `jti`; daftar pencabutan disimpan agar logout tetap berlaku setelah server restart. Aplikasi tetap menghapus sesi lokal saat server tidak dapat dihubungi.

## Menjalankan untuk demo lokal

Jalankan server API dengan `npm run api` dari folder proyek. Akun demo dibuat otomatis ketika endpoint autentikasi pertama kali dipakai:

| Peran | Email | Kata sandi |
| --- | --- | --- |
| Pelajar | `siswa@sekolah.id` | `password123` |
| Mahasiswa | `mahasiswa@kampus.ac.id` | `password123` |

Untuk web di komputer yang sama, URL default aplikasi adalah `http://localhost:3001/api`. Untuk emulator Android gunakan `http://10.0.2.2:3001/api`; untuk ponsel fisik, set `EXPO_PUBLIC_API_URL` ke alamat LAN komputer yang menjalankan server, misalnya `http://192.168.1.10:3001/api`, lalu mulai ulang Expo. Pastikan firewall mengizinkan koneksi ke port 3001.

Di mode development, server memakai HTTP untuk localhost. Build produksi menolak URL API selain HTTPS, dan backend produksi wajib menerima `JWT_SECRET`, `API_TLS_KEY_PATH`, serta `API_TLS_CERT_PATH`. Atur `EXPO_PUBLIC_API_URL` ke URL HTTPS API. Untuk demo HTTPS lokal, sertifikat dan private key dapat diberikan lewat variabel TLS yang sama. Jangan gunakan secret development atau sertifikat self-signed untuk deployment publik.

Pada iOS/Android, token disimpan menggunakan Expo SecureStore. Fallback web masih memakai AsyncStorage yang hanya di-encode; itu bukan penyimpanan terenkripsi setara SecureStore native dan hanya untuk demo lokal.
