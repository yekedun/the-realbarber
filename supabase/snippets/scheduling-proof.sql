begin;

create temp table scheduling_proof_ids (
  owner_id uuid not null,
  customer_id uuid not null,
  other_customer_id uuid not null,
  staff_user_id uuid not null,
  dst_owner_id uuid not null,
  shop_id uuid not null,
  dst_shop_id uuid not null,
  staff_a uuid not null,
  staff_b uuid not null,
  staff_closed uuid not null,
  dst_staff uuid not null,
  service_30 uuid not null,
  service_dst uuid not null,
  base_date date not null,
  dst_date date not null
) on commit drop;

-- dst_owner_id is a distinct auth user because shops.owner_user_id is now
-- unique per user (shops_owner_user_id_unique_idx); the DST shop needs its
-- own owner so the fixture mirrors the one-shop-per-owner production rule.
--
-- base_date is the Monday of the week AFTER today (Europe/Istanbul), so the
-- proof never lands on a past slot regardless of when it runs. dst_date is
-- the first Sunday of November of the year following base_date — guaranteed
-- to be in the future and to fall on a US DST end transition.
insert into scheduling_proof_ids
select
  '00000000-0000-4000-8000-000000000001'::uuid,
  '00000000-0000-4000-8000-000000000002'::uuid,
  '00000000-0000-4000-8000-000000000003'::uuid,
  '00000000-0000-4000-8000-000000000004'::uuid,
  '00000000-0000-4000-8000-000000000005'::uuid,
  '00000000-0000-4000-8000-000000000101'::uuid,
  '00000000-0000-4000-8000-000000000102'::uuid,
  '00000000-0000-4000-8000-000000000201'::uuid,
  '00000000-0000-4000-8000-000000000202'::uuid,
  '00000000-0000-4000-8000-000000000203'::uuid,
  '00000000-0000-4000-8000-000000000204'::uuid,
  '00000000-0000-4000-8000-000000000301'::uuid,
  '00000000-0000-4000-8000-000000000302'::uuid,
  (current_date + (8 - extract(isodow from current_date)::int))::date,
  -- First Sunday of November in year after base_date (US DST end transition).
  (
    select d::date
    from generate_series(
      make_date(extract(year from current_date)::int + 1, 11, 1),
      make_date(extract(year from current_date)::int + 1, 11, 7),
      interval '1 day'
    ) d
    where extract(dow from d) = 0
    limit 1
  );

do $$
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
  )
  select id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         email, crypt('scheduling-proof', gen_salt('bf')), now(), now(), now(), '{}'::jsonb, '{}'::jsonb
  from (values
    ('00000000-0000-4000-8000-000000000001'::uuid, 'proof-owner@example.test'),
    ('00000000-0000-4000-8000-000000000002'::uuid, 'proof-customer@example.test'),
    ('00000000-0000-4000-8000-000000000003'::uuid, 'proof-other-customer@example.test'),
    ('00000000-0000-4000-8000-000000000004'::uuid, 'proof-staff@example.test'),
    ('00000000-0000-4000-8000-000000000005'::uuid, 'proof-dst-owner@example.test')
  ) as u(id, email)
  on conflict (id) do nothing;
end $$;

insert into public.shops (
  id, owner_user_id, owner_id, slug, display_name, name, timezone, working_hours
)
select shop_id, owner_id, owner_id, 'proof-scheduling', 'Proof Scheduling', 'Proof Scheduling',
       'Europe/Istanbul',
       '{
         "mon": {"open": "09:00", "close": "19:00", "enabled": true},
         "tue": {"open": "09:00", "close": "19:00", "enabled": true},
         "wed": {"open": "09:00", "close": "19:00", "enabled": true},
         "thu": {"open": "09:00", "close": "19:00", "enabled": true},
         "fri": {"open": "09:00", "close": "19:00", "enabled": true},
         "sat": {"open": "09:00", "close": "17:00", "enabled": true},
         "sun": {"open": null, "close": null, "enabled": false}
       }'::jsonb
from scheduling_proof_ids
on conflict (id) do update set working_hours = excluded.working_hours;

insert into public.shops (
  id, owner_user_id, owner_id, slug, display_name, name, timezone, working_hours
)
select dst_shop_id, dst_owner_id, dst_owner_id, 'proof-dst', 'Proof DST', 'Proof DST',
       'America/New_York',
       '{
         "mon": {"open": "00:00", "close": "23:59", "enabled": true},
         "tue": {"open": "00:00", "close": "23:59", "enabled": true},
         "wed": {"open": "00:00", "close": "23:59", "enabled": true},
         "thu": {"open": "00:00", "close": "23:59", "enabled": true},
         "fri": {"open": "00:00", "close": "23:59", "enabled": true},
         "sat": {"open": "00:00", "close": "23:59", "enabled": true},
         "sun": {"open": "00:00", "close": "23:59", "enabled": true}
       }'::jsonb
from scheduling_proof_ids
on conflict (id) do update set working_hours = excluded.working_hours;

insert into public.staff (id, shop_id, user_id, name, role, is_active)
select staff_a, shop_id, staff_user_id, 'Proof Staff A', 'staff'::public.staff_role, true from scheduling_proof_ids
union all
select staff_b, shop_id, null, 'Proof Staff B', 'staff'::public.staff_role, true from scheduling_proof_ids
union all
select staff_closed, shop_id, null, 'Proof Closed Staff', 'staff'::public.staff_role, true from scheduling_proof_ids
union all
select dst_staff, dst_shop_id, null, 'Proof DST Staff', 'staff'::public.staff_role, true from scheduling_proof_ids
on conflict (id) do update set is_active = excluded.is_active;

insert into public.services (id, shop_id, name, duration_min, price_cents, display_order, is_active)
select service_30, shop_id, 'Proof 30', 30, 3000, 1, true from scheduling_proof_ids
union all
select service_dst, dst_shop_id, 'Proof DST 30', 30, 3000, 1, true from scheduling_proof_ids
on conflict (id) do update set duration_min = excluded.duration_min, is_active = true;

insert into public.staff_schedules (
  staff_id, day_of_week, is_working, work_start, work_end, break_start, break_end
)
select staff_a, 1, true, '10:00'::time, '18:00'::time, '12:00'::time, '12:30'::time from scheduling_proof_ids
union all
select staff_b, 1, true, '09:00'::time, '17:00'::time, null::time, null::time from scheduling_proof_ids
union all
select staff_closed, 1, false, '09:00'::time, '17:00'::time, null::time, null::time from scheduling_proof_ids
union all
select dst_staff, 0, true, '00:30'::time, '04:00'::time, '01:30'::time, '02:00'::time from scheduling_proof_ids
on conflict (staff_id, day_of_week) do update
set is_working = excluded.is_working,
    work_start = excluded.work_start,
    work_end = excluded.work_end,
    break_start = excluded.break_start,
    break_end = excluded.break_end;

delete from public.blocks where staff_id in (
  select staff_a from scheduling_proof_ids
  union all select staff_b from scheduling_proof_ids
  union all select staff_closed from scheduling_proof_ids
  union all select dst_staff from scheduling_proof_ids
);

delete from public.appointments where staff_id in (
  select staff_a from scheduling_proof_ids
  union all select staff_b from scheduling_proof_ids
  union all select staff_closed from scheduling_proof_ids
  union all select dst_staff from scheduling_proof_ids
);

do $$
declare
  ids scheduling_proof_ids%rowtype;
  v json;
  v_conflict boolean;
  v_count int;
  v_affected int;
  v_slot_count int;
  v_customer_visible int;
  v_other_visible int;
  v_anon_staff_count int;
  v_bounds record;
  v_report jsonb;
begin
  select * into ids from scheduling_proof_ids;

  -- create_appointment_atomic's authorization check expects either a
  -- service_role context (edge functions / admin scripts) or an authenticated
  -- JWT. Direct psql connects as `postgres` but with role='none', so we set
  -- service_role explicitly. Per-test customer/anon switches use `reset role
  -- to service_role` to return to this baseline.
  execute 'set local role service_role';

  perform public.create_appointment_atomic(
    'proof-scheduling',
    null,
    ids.service_30,
    ids.staff_a,
    ((ids.base_date::text || ' 10:00')::timestamp at time zone 'Europe/Istanbul'),
    'Proof Customer',
    '05550000000',
    null,
    ids.customer_id
  );

  select public.schedule_has_conflict(
    ids.staff_a,
    ((ids.base_date::text || ' 10:00')::timestamp at time zone 'Europe/Istanbul'),
    ((ids.base_date::text || ' 10:30')::timestamp at time zone 'Europe/Istanbul')
  ) into v_conflict;
  if not v_conflict then
    raise exception 'schedule_has_conflict did not see confirmed appointment';
  end if;

  select public.schedule_has_conflict(
    ids.staff_a,
    ((ids.base_date::text || ' 10:00')::timestamp at time zone 'Europe/Istanbul'),
    ((ids.base_date::text || ' 10:30')::timestamp at time zone 'Europe/Istanbul')
  ) into v_conflict;
  if not v_conflict then
    raise exception 'exact overlap conflict was not detected';
  end if;

  select public.schedule_has_conflict(
    ids.staff_a,
    ((ids.base_date::text || ' 10:15')::timestamp at time zone 'Europe/Istanbul'),
    ((ids.base_date::text || ' 10:45')::timestamp at time zone 'Europe/Istanbul')
  ) into v_conflict;
  if not v_conflict then
    raise exception 'partial overlap conflict was not detected';
  end if;

  select public.schedule_has_conflict(
    ids.staff_a,
    ((ids.base_date::text || ' 10:30')::timestamp at time zone 'Europe/Istanbul'),
    ((ids.base_date::text || ' 11:00')::timestamp at time zone 'Europe/Istanbul')
  ) into v_conflict;
  if v_conflict then
    raise exception 'back-to-back appointment was incorrectly treated as a conflict';
  end if;

  perform public.create_appointment_atomic(
    'proof-scheduling',
    null,
    ids.service_30,
    ids.staff_a,
    ((ids.base_date::text || ' 10:30')::timestamp at time zone 'Europe/Istanbul'),
    'Proof Back To Back',
    null,
    null,
    ids.customer_id
  );

  begin
    perform public.create_appointment_atomic(
      'proof-scheduling',
      null,
      ids.service_30,
      ids.staff_a,
      ((ids.base_date::text || ' 10:00')::timestamp at time zone 'Europe/Istanbul'),
      'Proof Double',
      null,
      null,
      ids.customer_id
    );
    raise exception 'double booking unexpectedly succeeded';
  exception
    when sqlstate 'P0001' then null;
  end;

  perform public.create_appointment_atomic(
    'proof-scheduling',
    null,
    ids.service_30,
    ids.staff_a,
    ((ids.base_date::text || ' 11:00')::timestamp at time zone 'Europe/Istanbul'),
    'Proof Cancelled',
    null,
    null,
    ids.customer_id
  );
  update public.appointments
     set status = 'cancelled'
   where staff_id = ids.staff_a
     and starts_at = ((ids.base_date::text || ' 11:00')::timestamp at time zone 'Europe/Istanbul');
  perform public.create_appointment_atomic(
    'proof-scheduling',
    null,
    ids.service_30,
    ids.staff_a,
    ((ids.base_date::text || ' 11:00')::timestamp at time zone 'Europe/Istanbul'),
    'Proof Rebook',
    null,
    null,
    ids.customer_id
  );

  begin
    perform public.create_appointment_atomic(
      'proof-scheduling',
      null,
      ids.service_30,
      ids.staff_a,
      ((ids.base_date::text || ' 12:00')::timestamp at time zone 'Europe/Istanbul'),
      'Proof Break',
      null,
      null,
      ids.customer_id
    );
    raise exception 'break-window booking unexpectedly succeeded';
  exception
    when sqlstate 'P0001' then null;
  end;

  begin
    perform public.create_appointment_atomic(
      'proof-scheduling',
      null,
      ids.service_30,
      ids.staff_closed,
      ((ids.base_date::text || ' 10:00')::timestamp at time zone 'Europe/Istanbul'),
      'Proof Closed',
      null,
      null,
      ids.customer_id
    );
    raise exception 'closed-day booking unexpectedly succeeded';
  exception
    when sqlstate 'P0001' then null;
  end;

  begin
    perform public.create_appointment_atomic(
      'proof-scheduling',
      null,
      ids.service_30,
      ids.staff_a,
      ((ids.base_date::text || ' 18:00')::timestamp at time zone 'Europe/Istanbul'),
      'Proof Outside Shift',
      null,
      null,
      ids.customer_id
    );
    raise exception 'outside-shift booking unexpectedly succeeded';
  exception
    when sqlstate 'P0001' then null;
  end;

  select public.create_appointment_atomic(
    'proof-scheduling',
    null,
    ids.service_30,
    null,
    ((ids.base_date::text || ' 09:00')::timestamp at time zone 'Europe/Istanbul'),
    'Proof Any',
    null,
    null,
    ids.customer_id
  ) into v;
  if (v ->> 'staff_id') is null then
    raise exception 'assign_any_staff did not assign a staff member';
  end if;

  perform public.create_block_atomic(
    ids.staff_a,
    ((ids.base_date::text || ' 13:00')::timestamp at time zone 'Europe/Istanbul'),
    ((ids.base_date::text || ' 13:30')::timestamp at time zone 'Europe/Istanbul'),
    'personal',
    'app'
  );
  begin
    perform public.create_appointment_atomic(
      'proof-scheduling',
      null,
      ids.service_30,
      ids.staff_a,
      ((ids.base_date::text || ' 13:00')::timestamp at time zone 'Europe/Istanbul'),
      'Proof Block Conflict',
      null,
      null,
      ids.customer_id
    );
    raise exception 'booking over block unexpectedly succeeded';
  exception
    when sqlstate 'P0001' then null;
  end;

  begin
    perform public.create_block_atomic(
      ids.staff_a,
      ((ids.base_date::text || ' 10:10')::timestamp at time zone 'Europe/Istanbul'),
      ((ids.base_date::text || ' 10:20')::timestamp at time zone 'Europe/Istanbul'),
      'personal',
      'app'
    );
    raise exception 'block over appointment unexpectedly succeeded';
  exception
    when sqlstate 'P0001' then null;
  end;

  select count(*) into v_count
  from public.get_occupied_ranges(ids.staff_a, ids.base_date)
  where starts_at = ((ids.base_date::text || ' 12:00')::timestamp at time zone 'Europe/Istanbul')
    and ends_at = ((ids.base_date::text || ' 12:30')::timestamp at time zone 'Europe/Istanbul');
  if v_count <> 1 then
    raise exception 'break range was not exposed by get_occupied_ranges';
  end if;

  select count(*) into v_count
  from public.get_occupied_ranges(ids.staff_closed, ids.base_date)
  where starts_at = ((ids.base_date::text || ' 00:00')::timestamp at time zone 'Europe/Istanbul')
    and ends_at = (((ids.base_date + 1)::text || ' 00:00')::timestamp at time zone 'Europe/Istanbul');
  if v_count <> 1 then
    raise exception 'closed day was not exposed as a full-day occupied range';
  end if;

  select * into v_bounds
  from public.schedule_day_bounds(ids.base_date, 'Europe/Istanbul');
  if v_bounds.starts_at <> (((ids.base_date - 1)::text || ' 21:00:00')::timestamp at time zone 'UTC')::timestamptz
     or v_bounds.ends_at <> ((ids.base_date::text || ' 21:00:00')::timestamp at time zone 'UTC')::timestamptz then
    raise exception 'Europe/Istanbul day bounds converted unexpectedly';
  end if;

  if public.staff_is_inside_work_window(
    ids.staff_a,
    ((ids.base_date::text || ' 20:45:00')::timestamp at time zone 'UTC'),
    ((ids.base_date::text || ' 21:15:00')::timestamp at time zone 'UTC')
  ) then
    raise exception 'slot crossing local midnight was incorrectly accepted';
  end if;

  if not public.staff_is_inside_work_window(
    ids.staff_a,
    ((ids.base_date::text || ' 07:00:00')::timestamp at time zone 'UTC'),
    ((ids.base_date::text || ' 07:30:00')::timestamp at time zone 'UTC')
  ) then
    raise exception 'UTC/local conversion rejected a valid Istanbul local slot';
  end if;

  if not public.staff_is_inside_work_window(
    ids.dst_staff,
    ((ids.dst_date::text || ' 00:30')::timestamp at time zone 'America/New_York'),
    ((ids.dst_date::text || ' 01:00')::timestamp at time zone 'America/New_York')
  ) then
    raise exception 'DST staff window rejected a valid local slot';
  end if;

  select count(*) into v_count
  from public.get_occupied_ranges(ids.dst_staff, ids.dst_date)
  where starts_at = ((ids.dst_date::text || ' 01:30')::timestamp at time zone 'America/New_York')
    and ends_at = ((ids.dst_date::text || ' 02:00')::timestamp at time zone 'America/New_York');
  if v_count <> 1 then
    raise exception 'DST break range was not converted through shop timezone';
  end if;

  select count(*) into v_slot_count
  from public.appointment_slots aps
  join public.appointments a on a.id = aps.appointment_id
  where a.staff_id = ids.staff_a
    and a.status = 'confirmed';
  select count(*) into v_count
  from public.appointments a
  where a.staff_id = ids.staff_a
    and a.status = 'confirmed';
  if v_slot_count <> v_count then
    raise exception 'appointment_slots mirror count mismatch';
  end if;

  update public.appointments
     set status = 'cancelled'
   where staff_id = ids.staff_a
     and starts_at = ((ids.base_date::text || ' 10:00')::timestamp at time zone 'Europe/Istanbul');
  if exists (
    select 1
    from public.appointment_slots aps
    join public.appointments a on a.id = aps.appointment_id
    where a.staff_id = ids.staff_a
      and a.starts_at = ((ids.base_date::text || ' 10:00')::timestamp at time zone 'Europe/Istanbul')
  ) then
    raise exception 'appointment_slots retained cancelled appointment';
  end if;

  perform public.update_appointment_atomic(
    (
      select id
      from public.appointments
      where staff_id = ids.staff_a
        and customer_name = 'Proof Rebook'
      limit 1
    ),
    ids.staff_a,
    ids.service_30,
    ((ids.base_date::text || ' 11:15')::timestamp at time zone 'Europe/Istanbul'),
    'Proof Rebook Updated',
    null,
    null
  );

  execute 'set local role anon';
  begin
    perform public.create_appointment_atomic(
      'proof-scheduling',
      null,
      ids.service_30,
      ids.staff_a,
      ((ids.base_date::text || ' 15:00')::timestamp at time zone 'Europe/Istanbul'),
      'Anon Mutator',
      null,
      null,
      null
    );
    raise exception 'anon create_appointment_atomic unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;
  begin
    perform public.create_block_atomic(
      ids.staff_a,
      ((ids.base_date::text || ' 16:00')::timestamp at time zone 'Europe/Istanbul'),
      ((ids.base_date::text || ' 16:30')::timestamp at time zone 'Europe/Istanbul'),
      'personal',
      'app'
    );
    raise exception 'anon create_block_atomic unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;
  select count(*) into v_anon_staff_count from public.staff where id in (ids.staff_a, ids.staff_b, ids.staff_closed);
  if v_anon_staff_count <> 3 then
    raise exception 'anon public staff read broke availability prerequisites';
  end if;
  -- get_staff_day_hours / get_occupied_ranges were revoked from anon+authenticated
  -- in 20260518130000; availability now flows through edge functions running as
  -- service_role. The proof asserts the lockdown actually holds.
  begin
    perform public.get_staff_day_hours(ids.staff_a, ids.base_date);
    raise exception 'anon get_staff_day_hours unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;
  begin
    perform public.get_occupied_ranges(ids.staff_a, ids.base_date);
    raise exception 'anon get_occupied_ranges unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;
  execute 'set local role service_role';

  perform set_config('request.jwt.claim.sub', ids.customer_id::text, true);
  execute 'set local role authenticated';
  select count(*) into v_customer_visible from public.appointments where customer_user_id = ids.customer_id;
  execute 'set local role service_role';

  perform set_config('request.jwt.claim.sub', ids.other_customer_id::text, true);
  execute 'set local role authenticated';
  select count(*) into v_other_visible from public.appointments where customer_user_id = ids.customer_id;
  execute 'set local role service_role';

  if v_customer_visible = 0 then
    raise exception 'customer could not read own appointments';
  end if;
  if v_other_visible <> 0 then
    raise exception 'other customer could read someone else appointments';
  end if;

  perform set_config('request.jwt.claim.sub', ids.owner_id::text, true);
  execute 'set local role authenticated';
  begin
    insert into public.appointments (
      staff_id,
      service_id,
      customer_name,
      starts_at,
      ends_at,
      status
    ) values (
      ids.staff_a,
      ids.service_30,
      'Direct Insert',
      ((ids.base_date::text || ' 16:00')::timestamp at time zone 'Europe/Istanbul'),
      ((ids.base_date::text || ' 16:30')::timestamp at time zone 'Europe/Istanbul'),
      'confirmed'
    );
    raise exception 'direct authenticated appointment insert unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;
  begin
    update public.appointments
       set starts_at = ((ids.base_date::text || ' 16:00')::timestamp at time zone 'Europe/Istanbul'),
           ends_at = ((ids.base_date::text || ' 16:30')::timestamp at time zone 'Europe/Istanbul')
     where staff_id = ids.staff_a
       and customer_name = 'Proof Rebook Updated';
    get diagnostics v_affected = row_count;
    if v_affected <> 0 then
      raise exception 'direct authenticated appointment reschedule unexpectedly mutated rows';
    end if;
  exception
    when insufficient_privilege then null;
  end;
  begin
    delete from public.appointments
     where staff_id = ids.staff_a
       and customer_name = 'Proof Rebook Updated';
    get diagnostics v_affected = row_count;
    if v_affected <> 0 then
      raise exception 'direct authenticated appointment delete unexpectedly mutated rows';
    end if;
  exception
    when insufficient_privilege then null;
  end;
  -- Owner cancels via the controlled RPC (direct UPDATE is blocked by
  -- prevent_direct_appointment_scheduling_writes for non-service roles since
  -- the commission_snapshot_integrity migration).
  declare
    v_owner_cancel_id uuid;
  begin
    select id into v_owner_cancel_id
      from public.appointments
     where staff_id = ids.staff_a
       and customer_name = 'Proof Back To Back'
     limit 1;
    if v_owner_cancel_id is null then
      raise exception 'owner cancel target appointment not found';
    end if;
    perform public.cancel_appointment_atomic(v_owner_cancel_id);
  end;
  execute 'set local role service_role';

  begin
    perform public.get_commission_report(ids.shop_id, (ids.base_date - 30), (ids.base_date + 30), null);
    raise exception 'customer unexpectedly accessed commission report';
  exception
    when sqlstate '42501' then null;
  end;

  perform set_config('request.jwt.claim.sub', ids.owner_id::text, true);
  execute 'set local role authenticated';
  update public.shops
     set commission_enabled = true
   where id = ids.shop_id;
  select public.get_commission_report(ids.shop_id, (ids.base_date - 30), (ids.base_date + 30), null) into v_report;
  execute 'set local role service_role';
  if (v_report ? 'staff') is not true then
    raise exception 'commission report did not return expected payload to owner';
  end if;
end $$;

rollback;

select 'scheduling-proof-ok' as result;
