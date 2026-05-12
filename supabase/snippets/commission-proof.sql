begin;

create temp table commission_proof_ids (
  owner_id uuid not null,
  customer_id uuid not null,
  staff_user_id uuid not null,
  shop_id uuid not null,
  owner_staff_id uuid not null,
  staff_a_id uuid not null,
  staff_b_id uuid not null,
  service_id uuid not null
) on commit drop;

insert into commission_proof_ids values (
  '00000000-0000-4000-8000-000000001001',
  '00000000-0000-4000-8000-000000001002',
  '00000000-0000-4000-8000-000000001003',
  '00000000-0000-4000-8000-000000001101',
  '00000000-0000-4000-8000-000000001201',
  '00000000-0000-4000-8000-000000001202',
  '00000000-0000-4000-8000-000000001203',
  '00000000-0000-4000-8000-000000001301'
);

do $$
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
  )
  select id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         email, crypt('commission-proof', gen_salt('bf')), now(), now(), now(), '{}'::jsonb, '{}'::jsonb
  from (values
    ('00000000-0000-4000-8000-000000001001'::uuid, 'commission-owner@example.test'),
    ('00000000-0000-4000-8000-000000001002'::uuid, 'commission-customer@example.test'),
    ('00000000-0000-4000-8000-000000001003'::uuid, 'commission-staff@example.test')
  ) as u(id, email)
  on conflict (id) do nothing;
end $$;

insert into public.shops (
  id, owner_user_id, owner_id, slug, display_name, name, timezone, working_hours, commission_enabled
)
select shop_id, owner_id, owner_id, 'proof-commission', 'Proof Commission', 'Proof Commission',
       'Europe/Istanbul', '{}'::jsonb, false
from commission_proof_ids;

insert into public.staff (id, shop_id, user_id, name, role, is_active, commission_type, commission_rate_bps)
select owner_staff_id, shop_id, owner_id, 'Owner Barber', 'admin'::public.staff_role, true, 'percentage', 2500 from commission_proof_ids
union all
select staff_a_id, shop_id, staff_user_id, 'Staff A', 'staff'::public.staff_role, true, 'percentage', 5000 from commission_proof_ids
union all
select staff_b_id, shop_id, null, 'Staff B', 'staff'::public.staff_role, true, 'none', null from commission_proof_ids;

insert into public.services (id, shop_id, name, duration_min, price_cents, display_order, is_active)
select service_id, shop_id, 'Proof Service', 30, 10000, 1, true from commission_proof_ids;

do $$
declare
  ids commission_proof_ids%rowtype;
  appt_a uuid;
  appt_b uuid;
  owner_appt uuid;
  cancelled_appt uuid;
  future_appt uuid;
  v_report jsonb;
  v_result jsonb;
begin
  select * into ids from commission_proof_ids;

  insert into public.appointments (staff_id, service_id, customer_name, customer_user_id, starts_at, ends_at, status)
  values
    (ids.staff_a_id, ids.service_id, 'Completed A', ids.customer_id, now() - interval '2 hours', now() - interval '90 minutes', 'confirmed'),
    (ids.staff_b_id, ids.service_id, 'Completed B', ids.customer_id, now() - interval '3 hours', now() - interval '150 minutes', 'confirmed'),
    (ids.owner_staff_id, ids.service_id, 'Owner Completed', ids.customer_id, now() - interval '4 hours', now() - interval '210 minutes', 'confirmed'),
    (ids.staff_a_id, ids.service_id, 'Cancelled', ids.customer_id, now() - interval '5 hours', now() - interval '270 minutes', 'cancelled'),
    (ids.staff_a_id, ids.service_id, 'Future', ids.customer_id, now() + interval '2 hours', now() + interval '150 minutes', 'confirmed');

  select id into appt_a from public.appointments where customer_name = 'Completed A';
  select id into appt_b from public.appointments where customer_name = 'Completed B';
  select id into owner_appt from public.appointments where customer_name = 'Owner Completed';
  select id into cancelled_appt from public.appointments where customer_name = 'Cancelled';
  select id into future_appt from public.appointments where customer_name = 'Future';

  perform set_config('request.jwt.claim.sub', ids.owner_id::text, true);
  execute 'set local role authenticated';

  begin
    perform public.get_commission_report(ids.shop_id, current_date - 1, current_date + 1, null);
    raise exception 'commission report unexpectedly available while flag disabled';
  exception when sqlstate '42501' then null;
  end;

  update public.shops set commission_enabled = true where id = ids.shop_id;

  perform public.update_staff_commission_config(ids.staff_a_id, 'percentage', 4000);
  perform public.update_staff_commission_config(ids.staff_b_id, 'none', null);
  begin
    perform public.update_staff_commission_config(ids.staff_a_id, 'percentage', 10001);
    raise exception 'invalid commission rate unexpectedly accepted';
  exception when sqlstate '22023' then null;
  end;

  select public.complete_appointment_with_revenue(appt_a, 12000) into v_result;
  if (v_result ->> 'completed_commission_cents')::integer <> 4800 then
    raise exception 'final price or percentage commission calculation is wrong: %', v_result;
  end if;

  perform public.complete_appointment_with_revenue(appt_b, null);
  perform public.complete_appointment_with_revenue(owner_appt, 8000);

  begin
    perform public.complete_appointment_with_revenue(cancelled_appt, null);
    raise exception 'cancelled appointment was completed';
  exception when sqlstate '22023' then null;
  end;

  begin
    perform public.complete_appointment_with_revenue(future_appt, null);
    raise exception 'future appointment was completed';
  exception when sqlstate '22023' then null;
  end;

  perform public.update_staff_commission_config(ids.staff_a_id, 'percentage', 1000);
  update public.services set price_cents = 99999 where id = ids.service_id;
  select public.complete_appointment_with_revenue(appt_a, null) into v_result;
  if (v_result ->> 'completed_commission_rate_bps')::integer <> 4000
     or (v_result ->> 'completed_price_cents')::integer <> 12000 then
    raise exception 'completed snapshot was recalculated after history changes: %', v_result;
  end if;

  select public.get_commission_report(ids.shop_id, current_date - 1, current_date + 1, null) into v_report;
  if (v_report ->> 'total_revenue_cents')::integer <> 30000
     or (v_report ->> 'total_commission_cents')::integer <> 6800
     or (v_report ->> 'total_shop_share_cents')::integer <> 23200 then
    raise exception 'report totals are wrong: %', v_report;
  end if;

  execute 'reset role';

  perform set_config('request.jwt.claim.sub', ids.customer_id::text, true);
  execute 'set local role authenticated';
  begin
    perform commission_type from public.staff where id = ids.staff_a_id;
    raise exception 'customer read staff commission columns directly';
  exception when insufficient_privilege then null;
  end;
  begin
    perform completed_commission_cents from public.appointments where id = appt_a;
    raise exception 'customer read appointment commission snapshot directly';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.get_commission_report(ids.shop_id, current_date - 1, current_date + 1, null);
    raise exception 'customer accessed commission report';
  exception when sqlstate '42501' then null;
  end;
  begin
    perform public.get_staff_commission_configs(ids.shop_id);
    raise exception 'customer accessed staff commission config';
  exception when sqlstate '42501' then null;
  end;
  execute 'reset role';

  execute 'set local role anon';
  begin
    perform commission_rate_bps from public.staff where id = ids.staff_a_id;
    raise exception 'anon read staff commission columns directly';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.get_commission_report(ids.shop_id, current_date - 1, current_date + 1, null);
    raise exception 'anon accessed commission report';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
end $$;

rollback;

select 'commission-proof-ok' as result;
