-- Private bucket for scan and check-in photos. Object paths are
-- {user_id}/{scan_id}/{photo_name}; the first path segment is the owner's
-- auth uid, which is what every policy checks. Nothing here is ever public.

insert into storage.buckets (id, name, public)
values ('scan-photos', 'scan-photos', false)
on conflict (id) do nothing;

create policy "scan_photos_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'scan-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "scan_photos_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'scan-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "scan_photos_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'scan-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "scan_photos_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'scan-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
