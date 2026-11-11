# 🏢 FlyStudio - 3D Virtual AI Agency & Automated Website Builder

> **Platform Kantor Virtual 3D Interaktif berbasis AI untuk Membangun Website & Landing Page Profesional Berkelas Tinggi Secara Otomatis.**  
> *Ditenagai 9 Karyawan AI Khusus dengan Alur Kerja Terstruktur (Riset ➔ Konsep ➔ Copywriting ➔ Design System ➔ Code ➔ QA ➔ SEO ➔ ZIP Bundle).*

---

## 🌟 Tentang FlyStudio

**FlyStudio** adalah solusi digital lengkap (software web app mandiri) yang menggabungkan visualisasi kantor virtual 3D Three.js yang hidup dengan orkestrasi 9 agen AI otonom. 

Dengan FlyStudio, Anda memimpin sebuah agensi web modern langsung dari browser. Berikan satu instruksi singkat tentang bisnis atau produk Anda, dan seluruh tim staf AI akan berkolaborasi secara realtime membangun website lengkap (*self-contained `index.html`* yang responsif, modern, berdesain elegan, dan siap tayang).

Cocok untuk:
- Web Agency Owner & Freelancer Web Developer
- Content Creator & Solo Preneur yang ingin melayani pembuatan landing page klien
- Pemilik Bisnis & Startup yang butuh landing page konversi tinggi dalam hitungan menit

---

## 👥 Tim 9 Karyawan AI Khusus

Setiap karyawan memiliki peran, kepribadian, standar referensi global, dan tugas spesifik:

| Ruang Kerja | Nama | Peran | Tanggung Jawab Utama |
| :--- | :--- | :--- | :--- |
| **Ruang Riset & Ide** | **Raka** | *Project Manager & Orchestrator* | Menerima instruksi pimpinan, menyusun struktur halaman, mendelegasikan tugas ke tim, dan mengawal alur kerja 9 tahap. |
| | **Rina** | *Research Analyst* | Riset audiens target, pain points, benchmarking kompetitor, dan formulasi *unique value proposition*. |
| | **Bagas** | *Creative Director* | Merumuskan 3 opsi konsep kreatif website, headline utama, tagline, dan visual direction untuk dipilih pimpinan. |
| **Studio Skrip & Kode** | **Sari** | *Copywriter* | Menulis copy naskah lengkap per bagian (Hero, Benefits, Features, Testimonials, FAQ, CTA) dengan formula konversi tinggi & tanpa emoji norak. |
| | **Dimas** | *Technical Reviewer & Code QA* | Melakukan code review menyeluruh: HTML5 semantik, CSS modular, kontras warna aksesibilitas WCAG, dan integritas layout. |
| **Studio Desain UI/UX** | **Luna** | *UI/UX Designer* | Merancang *Design System* kelas dunia mengacu pada standar global (`ux-ui-agent-skills` & `ui-ux-pro-max-skill`), tipografi modern, dan icon set inline SVG murni. |
| | **Kevin** | *Browser QA & Tester* | Menguji responsivitas website di berbagai resolusi layar (Mobile 375px, Tablet 768px, Desktop) serta menguji fungsi interaktif. |
| **Ruang Frontend & Growth** | **Adam** | *Frontend Developer* | Membangun kode website berstandar tinggi (*taste-skill doctrine*), layout responsif, animasi halus, dan file mandiri `index.html`. |
| | **Nadia** | *SEO & Growth Specialist* | Mengoptimasi meta tags SEO, OpenGraph preview, heading structure, serta menyusun rekomendasi strategi peluncuran web. |

---

## ⚡ Fitur Unggulan

- **Kantor Virtual 3D Interaktif (Three.js)**: Visualisasi 3D dengan 4 ruang divisi kerja, meja kerja staf, papan tulis strategi, dan avatar karakter hewan imut yang bergerak aktif.
- **Sistem Checkpoint & Kendali Penuh Bos**:
  - **Checkpoint 1**: Pilih 1 dari 3 konsep kreatif dari Bagas.
  - **Checkpoint 2**: Tinjau draf copywriting dari Sari & Design System visual dari Luna.
  - **Checkpoint 3**: Buka Pratinjau Langsung (*Live Interactive Preview*) dan unduh bundle ZIP final.
- **Standar Desain Internasional**:
  - Mengadopsi prinsip `taste-skill` (desain bernilai estetika tinggi, subtle borders, tipografi harmonis).
  - Standar UI/UX dari `ui-ux-pro-max-skill` & `ux-ui-agent-skills`.
  - Bersih dari emoji amatir, menggunakan icon murni vector SVG.
- **Paket Hasil Lengkap Siap Pakai**:
  - `index.html` mandiri (HTML5 semantik + Tailwind CSS via CDN + Vanilla JS interaktif).
  - Laporan audit QA (Dimas) dan laporan uji responsif (Kevin).
  - Laporan optimasi SEO & Meta tags (Nadia).
  - Tombol 1-klik unduh ZIP (*Bundle Website*).
- **Mode Ruang Rapat (Boardroom)**: Fitur panggil semua staf ke meja rapat untuk sinkronisasi proyek atau reset standby instan.

---

## 🚀 Panduan Instalasi & Menjalankan

### Persyaratan Sistem
- **Node.js** (versi 18 ke atas)
- Browser modern (Google Chrome, Microsoft Edge, Brave, Mozilla Firefox)
- Web Server lokal (XAMPP / Apache / Nginx) atau langsung via Node.js server bawaan

### Langkah Menjalankan
1. **Buka folder proyek** di terminal / CMD:
   ```bash
   cd c:/xampp/htdocs/kantor-kreatif
   ```

2. **Konfigurasi API Key** (file `.env`):
   ```env
   OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxx
   PORT=3001
   ```
   *(Mendukung model Claude 3.5 Sonnet, Claude 3.7 Sonnet, atau model LLM pilihan lainnya via OpenRouter).*

3. **Jalankan Engine Server**:
   ```bash
   node server.js
   ```

4. **Buka Aplikasi di Browser**:
   Buka URL:
   ```
   http://localhost:3001
   ```
   *atau buka langsung:*
   ```
   http://localhost/kantor-kreatif/kantor-flystudio.html
   ```

---

## 📦 Struktur Folder

```text
kantor-kreatif/
├── kantor-flystudio.html    # Aplikasi Frontend Kantor Virtual 3D & Dashboard
├── server.js               # Backend Node.js Engine (Orkestrasi Agen & Alur 9 Tahap)
├── api.php                 # Endpoint integrasi API PHP
├── karyawan.php            # Manajemen data staf
├── models.php              # Konfigurasi model AI
├── .env                    # Konfigurasi API Key dan Port server
├── karyawan/               # Profile & prompt engineering 9 staf AI (.json)
│   ├── raka.json
│   ├── rina.json
│   ├── bagas.json
│   ├── sari.json
│   ├── dimas.json
│   ├── luna.json
│   ├── kevin.json
│   ├── adam.json
│   └── nadia.json
├── projects/               # Direktori penyimpanan hasil website tiap proyek
└── skills_ref/             # Referensi panduan desain (taste-skill & ui-ux-pro)
```

---

## 💼 Siap Jual di Lynk.id

Aplikasi ini sudah dipaketkan rapi, bebas dari kode usang, dan siap dijadikan produk digital berbayar di **Lynk.id** sebagai *Source Code Web App*, *Template AI Agency*, maupun *Tools Agensi Otomatis*.

---

*Hak Cipta © 2026 FlyStudio. Dikembangkan bersama Bos Rafly.*
