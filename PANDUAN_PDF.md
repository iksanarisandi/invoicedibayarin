# Panduan Render PDF — Dibayar.in Invoice Generator

Dokumen ini wajib dibaca sebelum mengubah **apa pun** yang berkaitan dengan
export PDF. Bertujuan agar masalah "PDF geser / blank / terpotong / error"
**tidak terulang lagi**.

---

## ⚡ Aturan utama (TL;DR)

1. **JANGAN** gunakan `html2pdf().from(element).save()` (auto-pipeline) untuk
   dokumen ini. Itu sumber semua masalah berulang.
2. **GUNAKAN** pipeline manual: `html2canvas` → canvas → `jsPDF` dengan
   penempatan gambar di `x:0` lebar `210mm` + paginasi eksplisit.
3. Library `html2canvas` & `jsPDF` **wajib dimuat terpisah** di `index.html`
   (bukan dari bundle `html2pdf`), supaya global-nya tersedia.
4. Invoice **di-clone** ke layer isolasi sebelum dirender — jangan capture
   elemen langsung dari layout halaman.
5. Sebelum mengubah logika PDF, **tes 2 skenario**: item sedikit (1 halaman)
   & item banyak (2 halaman). Lihat bagian "Cara Menguji".

---

## Kenapa ini penting — riwayat masalah

`html2pdf` adalah **kotak hitam** yang menggabungkan `html2canvas` + `jsPDF`
lalu menjalankan capture + bagi-halaman secara otomatis. Mekanisme otomatis
itu punya beberapa keanehan yang saling bertabrakan:

| Percobaan dulu | Gejala | Penyebab riil |
|---|---|---|
| Capture elemen langsung, `windowWidth` besar | geser + sisi putih | `html2canvas` menangkap area selebar `windowWidth`; invoice cuma 794px & ada offset di layout → canvas membawa ruang kosong + posisi meleset |
| Host dengan `z-index: -9999` | PDF blank putih | host berada di belakang background body → yang ter-capture background putih |
| Tanpa reset `min-height` & tanpa pagebreak | terpotong | invoice paksa tinggi 296mm + pemotongan halaman sembarang |
| Auto-paginate `html2pdf` di banyak item | geser lagi di 2 halaman | penempatan gambar internal `html2pdf` tidak presisi saat multi-halaman |
| Pakai bundle `html2pdf` untuk global | error "Terjadi kesalahan…" | bundle tidak mengekspos `html2canvas`/`jsPDF` sebagai global terpisah |

**Pelajaran:** menambal konfigurasi di dalam kotak hitam hanya memindahkan
gejala. Solusi stabil = **buang kotak hitamnya, ambil kendali penuh** atas
proses canvas → PDF.

---

## Solusi yang dipakai sekarang (stabil)

### 1. `index.html` — muat library terpisah

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"
    crossorigin="anonymous" referrerpolicy="no-referrer"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
    crossorigin="anonymous" referrerpolicy="no-referrer"></script>
```

> Jangan ganti kembali ke `html2pdf.bundle.min.js`.

### 2. `script.js` — pipeline manual

Inti logikanya (lihat `script.js` untuk kode lengkap):

```js
// 1) Clone invoice ke layer isolasi (tidak ada offset dari layout halaman)
const host = document.createElement('div');
host.style.cssText =
  'position:fixed;top:0;left:0;width:100vw;height:100vh;background:#fff;overflow:auto;z-index:2147483647';
const clone = document.getElementById('invoiceContent').cloneNode(true);
clone.style.transform = 'none';     // hilangkan scale responsif
clone.style.minHeight = 'auto';     // tinggi mengikuti konten
clone.style.margin = '0';
clone.style.boxShadow = 'none';
host.appendChild(clone);
document.body.appendChild(host);

// 2) Render clone → 1 canvas utuh
const canvas = await html2canvas(clone, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    scrollX: 0, scrollY: 0
});

// 3) Tempel gambar ke jsPDF: x:0, lebar 210mm (penuh), paginasi manual
const JsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
const pdf = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
const pageWidth = pdf.internal.pageSize.getWidth();    // 210
const pageHeight = pdf.internal.pageSize.getHeight();  // 297
const imgWidth = pageWidth;
const imgHeight = (canvas.height * imgWidth) / canvas.width;
const imgData = canvas.toDataURL('image/jpeg', 0.98);

let heightLeft = imgHeight;
let position = 0;
pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
heightLeft -= pageHeight;
while (heightLeft > 0) {
    position -= pageHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
}
pdf.save(filename);

// 4) Bersihkan host
host.remove();
```

**Kenapa tidak bisa geser:** gambar SELALU ditempel di `x:0` dengan lebar
tepat `210mm` = lebar halaman A4. Secara matematis tidak ada ruang untuk
meleset. Paginasi dihitung eksplisit per 297mm.

---

## ❌ Hal yang DILARANG (anti-pattern)

- **Capture elemen langsung dari layout** (`#invoiceContent` yang sedang
  tampil di sidebar/preview) — posisinya punya offset → canvas meleset.
- **`z-index` negatif** pada host render — akan tertimbun background body.
- **`min-height` fix mendekati A4** (mis. `296mm`) pada dokumen — mengacaukan
  paginasi. Pakai `min-height: auto` saat render.
- **Set `windowWidth` jauh lebih besar/kecil dari lebar dokumen** — memicu
  ruang kosong atau media-query responsif ikut aktif.
- **Bereksperimen di konfigurasi `html2pdf`** untuk "memperbaiki" geser/putih.
  Itu jebakan — kerjakan di pipeline manual saja.

---

## ✅ Kalau perlu modifikasi

Pipeline ini sengaja dibuat sederhana agar mudah diubah tanpa merusak
stabilitas:

- **Mau margin di PDF?** Tambah padding di clone, atau kurangi `imgWidth`
  dan geser `x` (mis. `imgWidth = pageWidth - 20`, `x = 10`).
- **Mau pemotongan halaman "pintar"** (tidak memotong baris tabel/QRIS)?
  Tambahkan logika sebelum `html2canvas`: bagi invoice per blok, render
  per blok, lalu `addImage` per blok. JANGAN kembali ke auto-paginate.
- **Mau kualitas lebih tinggi?** Naikkan `scale` (mis. `3`) — hati-hati
  ukuran file & memori membesar.
- **Tambah elemen dinamis?** Pastikan tetap di dalam `#invoiceContent` agar
  ikut ter-clone.

---

## 🧪 Cara menguji

Jalankan server lokal (gambar lokal tidak boleh dibuka via `file:///`):

```bash
python -m http.server 8000
```

Buka `http://localhost:8000`, lalu **`Ctrl + Shift + R`** (hard refresh wajib
setelah mengubah `script.js`/`index.html`).

Skenario wajib diuji setiap kali menyentuh kode PDF:

1. **Item sedikit (1–3)** → 1 halaman, penuh, simetris kiri-kanan.
2. **Item banyak (8–10)** → 2 halaman, **tidak geser**, semua konten ada
   (header, tabel, total, QRIS, info bank, footer).
3. **Nominal besar** (puluhan juta) → kotak total tidak terpotong.
4. **Cek di lebar desktop & sempit** → layout preview tetap wajar.

Jika muncul error, alert sekarang menampilkan **pesan error asli** —
copy pesan tersebut untuk debugging cepat.

---

## Referensi cepat

- Library: `html2canvas@1.4.1`, `jspdf@2.5.1` (UMD)
- Global: `window.html2canvas`, `window.jspdf.jsPDF`
- Lebar dokumen: `210mm` (= A4), tinggi halaman: `297mm`
- Elemen sumber: `#invoiceContent`
- Komit solusi stabil: `e2cbbd6`
