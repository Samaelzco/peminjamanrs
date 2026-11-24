-- kode_aset diisi trigger aset_generate_kode; default '' membuatnya opsional saat insert.
alter table public.aset alter column kode_aset set default '';
