import ExcelJS from "exceljs";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { formatWita } from "@/lib/datetime";
import { STATUS_PEMINJAMAN, STATUS_PEMINJAMAN_LIST } from "@/lib/labels";
import { ambilRekap, formatDurasi, type BarisRekap } from "@/lib/rekap";
import { parseFilterRiwayat } from "@/lib/riwayat-filter";

const FORMAT_WAKTU = "dd/mm/yyyy hh:mm";
const WARNA_HEADER = "FF0B6E69"; // brand-700 (teal)

/** Excel menyimpan tanggal tanpa zona waktu: geser ke jam dinding WITA (UTC+8). */
const keWita = (d: Date | null) => (d ? new Date(d.getTime() + 8 * 3600_000) : null);
const tglTeks = (yyyyMmDd: string) => yyyyMmDd.split("-").reverse().join("/");

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response("Sesi berakhir. Silakan login kembali.", { status: 401 });
  if (!user.permissions.includes("laporan.export")) return new Response("Akses ditolak.", { status: 403 });

  const filter = parseFilterRiwayat(request.nextUrl.searchParams);
  const sekarang = new Date();
  const rows = await ambilRekap(filter, sekarang);

  const wb = new ExcelJS.Workbook();
  wb.creator = user.nama;
  wb.created = sekarang;

  tulisRingkasan(wb, rows, {
    periode:
      filter.dari || filter.sampai
        ? `${filter.dari ? tglTeks(filter.dari) : "awal"} s.d. ${filter.sampai ? tglTeks(filter.sampai) : "sekarang"}`
        : "Semua tanggal",
    status: filter.status ? STATUS_PEMINJAMAN[filter.status].label : "Semua status",
    cari: filter.q || "-",
    diunduh: `${formatWita(sekarang)} WITA oleh ${user.nama}`,
  });
  tulisRiwayat(wb, rows);
  tulisKeterlambatan(wb, rows);
  tulisUnit(wb, rows);

  const buffer = await wb.xlsx.writeBuffer();
  const nama = `rekap-peminjaman_${filter.dari ?? "awal"}_sd_${filter.sampai ?? "sekarang"}.xlsx`;
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nama}"`,
      "Cache-Control": "no-store",
    },
  });
}

// ---------------------------------------------------------------------
// Sheet
// ---------------------------------------------------------------------

function gayaHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: WARNA_HEADER } };
  row.alignment = { vertical: "middle", wrapText: true };
}

/** Sheet tabel: header berwarna, baris header dibekukan, filter otomatis. */
function tabel(wb: ExcelJS.Workbook, nama: string, kolom: Partial<ExcelJS.Column>[]) {
  const ws = wb.addWorksheet(nama, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = kolom;
  gayaHeader(ws.getRow(1));
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: kolom.length } };
  return ws;
}

function tulisRingkasan(
  wb: ExcelJS.Workbook,
  rows: BarisRekap[],
  info: { periode: string; status: string; cari: string; diunduh: string },
) {
  const ws = wb.addWorksheet("Ringkasan");
  ws.columns = [{ width: 34 }, { width: 16 }, { width: 16 }, { width: 18 }, { width: 22 }];

  ws.addRow(["Rekap Peminjaman Perangkat"]).font = { bold: true, size: 14 };
  ws.addRow(["Periode (tanggal keluar)", info.periode]);
  ws.addRow(["Filter status", info.status]);
  ws.addRow(["Pencarian", info.cari]);
  ws.addRow(["Diunduh", info.diunduh]);
  ws.addRow([]);

  const dipakai = rows.filter((r) => r.status !== "dibatalkan");
  const terlambat = dipakai.filter((r) => r.pernahTerlambat);
  const totalMenit = terlambat.reduce((n, r) => n + r.menitTerlambat, 0);

  gayaHeader(ws.addRow(["Ringkasan", "Jumlah"]));
  ws.addRow(["Total peminjaman", rows.length]);
  for (const s of STATUS_PEMINJAMAN_LIST) {
    ws.addRow([`  ${STATUS_PEMINJAMAN[s].label}`, rows.filter((r) => r.status === s).length]);
  }
  ws.addRow(["Unit dipinjam (tanpa yang dibatalkan)", dipakai.reduce((n, r) => n + r.units.length, 0)]);
  ws.addRow(["Peminjaman pernah terlambat", terlambat.length]);
  const persen = ws.addRow(["Persentase terlambat", dipakai.length ? terlambat.length / dipakai.length : 0]);
  persen.getCell(2).numFmt = "0.0%";
  ws.addRow(["Masih terlambat (belum kembali)", rows.filter((r) => r.status === "terlambat").length]);
  ws.addRow(["Total durasi terlambat", formatDurasi(totalMenit)]);
  ws.addRow(["Rata-rata durasi terlambat", formatDurasi(terlambat.length ? Math.round(totalMenit / terlambat.length) : 0)]);
  ws.addRow([]);

  // Per divisi
  gayaHeader(ws.addRow(["Divisi", "Peminjaman", "Unit", "Pernah terlambat", "Total durasi terlambat"]));
  const perDivisi = new Map<string, { n: number; unit: number; telat: number; menit: number }>();
  for (const r of dipakai) {
    const d = perDivisi.get(r.divisi) ?? { n: 0, unit: 0, telat: 0, menit: 0 };
    d.n++;
    d.unit += r.units.length;
    if (r.pernahTerlambat) d.telat++;
    d.menit += r.menitTerlambat;
    perDivisi.set(r.divisi, d);
  }
  for (const [divisi, d] of [...perDivisi].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]))) {
    ws.addRow([divisi, d.n, d.unit, d.telat, formatDurasi(d.menit)]);
  }
  ws.addRow([]);

  // Per kategori
  gayaHeader(ws.addRow(["Kategori", "Unit dipinjam", "Unit terlambat"]));
  const perKategori = new Map<string, { unit: number; telat: number }>();
  for (const r of dipakai) {
    for (const u of r.units) {
      const k = perKategori.get(u.kategori) ?? { unit: 0, telat: 0 };
      k.unit++;
      if (r.pernahTerlambat) k.telat++;
      perKategori.set(u.kategori, k);
    }
  }
  for (const [kategori, k] of [...perKategori].sort((a, b) => b[1].unit - a[1].unit)) {
    ws.addRow([kategori, k.unit, k.telat]);
  }
}

function tulisRiwayat(wb: ExcelJS.Workbook, rows: BarisRekap[]) {
  const ws = tabel(wb, "Riwayat", [
    { header: "Kode", key: "kode", width: 13 },
    { header: "Status", key: "status", width: 12 },
    { header: "Nama Peminjam", key: "nama", width: 24 },
    { header: "Divisi", key: "divisi", width: 20 },
    { header: "Kontak", key: "kontak", width: 15 },
    { header: "Ruangan", key: "ruangan", width: 18 },
    { header: "Keperluan", key: "keperluan", width: 36 },
    { header: "Unit", key: "unit", width: 28 },
    { header: "Tanggal Keluar", key: "keluar", width: 17, style: { numFmt: FORMAT_WAKTU } },
    { header: "Rencana Kembali", key: "rencana", width: 17, style: { numFmt: FORMAT_WAKTU } },
    { header: "Dipasang", key: "pasang", width: 17, style: { numFmt: FORMAT_WAKTU } },
    { header: "Selesai", key: "selesai", width: 17, style: { numFmt: FORMAT_WAKTU } },
    { header: "Cara Selesai", key: "cara", width: 15 },
    { header: "Terlambat", key: "telat", width: 10 },
    { header: "Durasi Terlambat", key: "durasi", width: 20 },
    { header: "Perpanjangan Dari", key: "asal", width: 16 },
  ]);
  for (const r of rows) {
    ws.addRow({
      kode: r.kode,
      status: STATUS_PEMINJAMAN[r.status].label,
      nama: r.namaPeminjam,
      divisi: r.divisi,
      kontak: r.kontak,
      ruangan: r.ruangan,
      keperluan: r.keperluan,
      unit: r.units.map((u) => u.kode).join(", "),
      keluar: keWita(r.tglKeluar),
      rencana: keWita(r.rencanaKembali),
      pasang: keWita(r.tglPasang),
      selesai: keWita(r.tglSelesai),
      cara: r.caraSelesai,
      telat: r.pernahTerlambat ? "Ya" : "Tidak",
      durasi: formatDurasi(r.menitTerlambat),
      asal: r.perpanjanganDari ?? "",
    });
  }
}

function tulisKeterlambatan(wb: ExcelJS.Workbook, rows: BarisRekap[]) {
  const ws = tabel(wb, "Keterlambatan", [
    { header: "Kode", key: "kode", width: 13 },
    { header: "Status Sekarang", key: "status", width: 15 },
    { header: "Nama Peminjam", key: "nama", width: 24 },
    { header: "Divisi", key: "divisi", width: 20 },
    { header: "Kontak", key: "kontak", width: 15 },
    { header: "Ruangan", key: "ruangan", width: 18 },
    { header: "Unit", key: "unit", width: 28 },
    { header: "Rencana Kembali", key: "rencana", width: 17, style: { numFmt: FORMAT_WAKTU } },
    { header: "Kembali / Selesai", key: "selesai", width: 17, style: { numFmt: FORMAT_WAKTU } },
    { header: "Cara Selesai", key: "cara", width: 15 },
    { header: "Durasi Terlambat", key: "durasi", width: 20 },
    { header: "Terlambat (jam)", key: "jam", width: 14, style: { numFmt: "0.0" } },
  ]);
  const telat = rows.filter((r) => r.pernahTerlambat && r.status !== "dibatalkan");
  for (const r of telat.sort((a, b) => b.menitTerlambat - a.menitTerlambat)) {
    ws.addRow({
      kode: r.kode,
      status: STATUS_PEMINJAMAN[r.status].label,
      nama: r.namaPeminjam,
      divisi: r.divisi,
      kontak: r.kontak,
      ruangan: r.ruangan,
      unit: r.units.map((u) => u.kode).join(", "),
      rencana: keWita(r.rencanaKembali),
      selesai: keWita(r.tglSelesai),
      cara: r.tglSelesai ? r.caraSelesai : "Belum kembali",
      durasi: formatDurasi(r.menitTerlambat),
      jam: r.menitTerlambat / 60,
    });
  }
  if (telat.length === 0) ws.addRow({ kode: "Tidak ada keterlambatan pada periode ini." });
}

function tulisUnit(wb: ExcelJS.Workbook, rows: BarisRekap[]) {
  const ws = tabel(wb, "Per Unit", [
    { header: "Kode Unit", key: "kode", width: 14 },
    { header: "Nama Barang", key: "nama", width: 28 },
    { header: "Kategori", key: "kategori", width: 16 },
    { header: "Dipinjam (kali)", key: "n", width: 15 },
    { header: "Terlambat (kali)", key: "telat", width: 16 },
    { header: "Kembali Rusak", key: "rusak", width: 14 },
    { header: "Hilang", key: "hilang", width: 10 },
  ]);
  const perUnit = new Map<string, { nama: string; kategori: string; n: number; telat: number; rusak: number; hilang: number }>();
  for (const r of rows.filter((x) => x.status !== "dibatalkan")) {
    for (const u of r.units) {
      const d = perUnit.get(u.kode) ?? { nama: u.nama, kategori: u.kategori, n: 0, telat: 0, rusak: 0, hilang: 0 };
      d.n++;
      if (r.pernahTerlambat) d.telat++;
      if (u.kondisiMasuk === "rusak") d.rusak++;
      if (u.kondisiMasuk === "hilang") d.hilang++;
      perUnit.set(u.kode, d);
    }
  }
  for (const [kode, d] of [...perUnit].sort((a, b) => a[0].length - b[0].length || a[0].localeCompare(b[0]))) {
    ws.addRow({ kode, ...d });
  }
}
