param(
  [switch]$SkipReset,
  [switch]$SkipRace
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$proofSql = Join-Path $root "supabase\snippets\scheduling-proof.sql"
$dbContainer = "supabase_db_berber-randevu"

# Race fixture timestamps must always be in the future so create_appointment_atomic's
# past_slot_guard accepts them. Compute the next Monday relative to today (Europe/Istanbul
# semantics; Get-Date is local but day-of-week math is identical for Mondays).
$today = (Get-Date).Date
$daysUntilMonday = (8 - [int]$today.DayOfWeek) % 7
if ($daysUntilMonday -eq 0) { $daysUntilMonday = 7 }
$raceBaseDate = $today.AddDays($daysUntilMonday).ToString('yyyy-MM-dd')

function Invoke-SupabaseQueryFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  Get-Content -Path $Path -Raw | docker exec -i $dbContainer psql -v ON_ERROR_STOP=1 -U postgres -d postgres
  if ($LASTEXITCODE -ne 0) {
    throw "psql failed for $Path"
  }
}

function Invoke-ConcurrentSqlRace {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [Parameter(Mandatory = $true)]
    [string]$SetupSql,
    [Parameter(Mandatory = $true)]
    [string[]]$AttemptSqls,
    [Parameter(Mandatory = $true)]
    [int[]]$ExpectedExitCodes,
    [Parameter(Mandatory = $true)]
    [string]$VerifySql,
    [Parameter(Mandatory = $true)]
    [string]$CleanupSql
  )

  try {
    Invoke-SupabaseQueryFile -Path $SetupSql

    $jobs = for ($i = 0; $i -lt $AttemptSqls.Length; $i++) {
      $attemptPath = $AttemptSqls[$i]
      Start-Job -ScriptBlock {
        param($path, $workdir, $container)
        Set-Location $workdir
        Get-Content -Path $path -Raw | docker exec -i $container psql -v ON_ERROR_STOP=1 -U postgres -d postgres *>&1
        $LASTEXITCODE
      } -ArgumentList $attemptPath, $root, $dbContainer
    }

    $results = @()
    foreach ($job in $jobs) {
      Wait-Job $job | Out-Null
      $results += ,(Receive-Job $job)
      Remove-Job $job
    }

    $actualExitCodes = @(
      foreach ($result in $results) {
        $ints = @($result | Where-Object { $_ -is [int] })
        if ($ints.Count -eq 0) {
          -999
        } else {
          [int]$ints[-1]
        }
      }
    )

    $expectedSorted = @($ExpectedExitCodes | Sort-Object)
    $actualSorted = @($actualExitCodes | Sort-Object)
    if (($expectedSorted -join ",") -ne ($actualSorted -join ",")) {
      foreach ($result in $results) {
        $result | ForEach-Object { Write-Host $_ }
      }
      throw "$Name expected exit codes [$($expectedSorted -join ', ')] but got [$($actualSorted -join ', ')]"
    }

    Invoke-SupabaseQueryFile -Path $VerifySql
  }
  finally {
    try {
      Invoke-SupabaseQueryFile -Path $CleanupSql
    }
    catch {
      Write-Warning $_
    }
  }
}

if (-not $SkipReset) {
  supabase db reset --local
  if ($LASTEXITCODE -ne 0) {
    throw "supabase db reset failed"
  }
}

Invoke-SupabaseQueryFile -Path $proofSql

if ($SkipRace) {
  Write-Host "scheduling-race-skipped"
  exit 0
}

$raceId = [Guid]::NewGuid().ToString("N")
$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) "berber-scheduling-proof-$raceId"
New-Item -ItemType Directory -Path $tempDir | Out-Null

$setupSql = Join-Path $tempDir "race-setup.sql"
$attemptSql = Join-Path $tempDir "race-attempt.sql"
$verifySql = Join-Path $tempDir "race-verify.sql"
$cleanupSql = Join-Path $tempDir "race-cleanup.sql"
$bookVsBlockSetupSql = Join-Path $tempDir "race-book-vs-block-setup.sql"
$bookAttemptSql = Join-Path $tempDir "race-book-vs-block-attempt-book.sql"
$blockAttemptSql = Join-Path $tempDir "race-book-vs-block-attempt-block.sql"
$bookVsBlockVerifySql = Join-Path $tempDir "race-book-vs-block-verify.sql"
$bookVsBlockCleanupSql = Join-Path $tempDir "race-book-vs-block-cleanup.sql"
$blockVsBlockSetupSql = Join-Path $tempDir "race-block-vs-block-setup.sql"
$blockAttempt1Sql = Join-Path $tempDir "race-block-vs-block-attempt-1.sql"
$blockAttempt2Sql = Join-Path $tempDir "race-block-vs-block-attempt-2.sql"
$blockVsBlockVerifySql = Join-Path $tempDir "race-block-vs-block-verify.sql"
$blockVsBlockCleanupSql = Join-Path $tempDir "race-block-vs-block-cleanup.sql"
$anyStaffSetupSql = Join-Path $tempDir "race-any-staff-setup.sql"
$anyStaffAttempt1Sql = Join-Path $tempDir "race-any-staff-attempt-1.sql"
$anyStaffAttempt2Sql = Join-Path $tempDir "race-any-staff-attempt-2.sql"
$anyStaffVerifySql = Join-Path $tempDir "race-any-staff-verify.sql"
$anyStaffCleanupSql = Join-Path $tempDir "race-any-staff-cleanup.sql"

@"
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values (
  '00000000-0000-4000-8000-100000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'proof-race-owner@example.test',
  crypt('scheduling-proof', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{}'::jsonb,
  '{}'::jsonb
) on conflict (id) do nothing;

insert into public.shops (
  id, owner_user_id, owner_id, slug, display_name, name, timezone, working_hours
) values (
  '00000000-0000-4000-8000-100000000101',
  '00000000-0000-4000-8000-100000000001',
  '00000000-0000-4000-8000-100000000001',
  'proof-race',
  'Proof Race',
  'Proof Race',
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
) on conflict (id) do update set working_hours = excluded.working_hours;

insert into public.staff (id, shop_id, user_id, name, role, is_active)
values
(
  '00000000-0000-4000-8000-100000000201',
  '00000000-0000-4000-8000-100000000101',
  null,
  'Proof Race Staff',
  'staff'::public.staff_role,
  true
),
(
  '00000000-0000-4000-8000-000000000202',
  '00000000-0000-4000-8000-100000000101',
  null,
  'Proof Race Staff B',
  'staff'::public.staff_role,
  true
) on conflict (id) do update set is_active = true;

insert into public.services (id, shop_id, name, duration_min, price_cents, display_order, is_active)
values (
  '00000000-0000-4000-8000-100000000301',
  '00000000-0000-4000-8000-100000000101',
  'Proof Race 30',
  30,
  3000,
  1,
  true
) on conflict (id) do update set duration_min = 30, is_active = true;

insert into public.staff_schedules (
  staff_id, day_of_week, is_working, work_start, work_end, break_start, break_end
) values
(
  '00000000-0000-4000-8000-100000000201',
  1,
  true,
  '09:00',
  '19:00',
  null,
  null
),
(
  '00000000-0000-4000-8000-000000000202',
  1,
  true,
  '09:00',
  '19:00',
  null,
  null
) on conflict (staff_id, day_of_week) do update
set is_working = true,
    work_start = '09:00',
    work_end = '19:00',
    break_start = null,
    break_end = null;

delete from public.appointments
where staff_id = '00000000-0000-4000-8000-100000000201'
  and starts_at = '$raceBaseDate 14:00 Europe/Istanbul';
"@ | Set-Content -Path $setupSql -Encoding UTF8

@"
set role service_role;
select public.create_appointment_atomic(
  'proof-race',
  null,
  '00000000-0000-4000-8000-100000000301',
  '00000000-0000-4000-8000-100000000201',
  '$raceBaseDate 14:00 Europe/Istanbul',
  'Proof Race',
  null,
  null,
  null
);
"@ | Set-Content -Path $attemptSql -Encoding UTF8

@"
do `$`$
declare
  v_count int;
  v_mirror_count int;
begin
  select count(*) into v_count
  from public.appointments
  where staff_id = '00000000-0000-4000-8000-100000000201'
    and starts_at = '$raceBaseDate 14:00 Europe/Istanbul'
    and status = 'confirmed';

  if v_count <> 1 then
    raise exception 'race proof expected exactly one confirmed appointment, got %', v_count;
  end if;

  select count(*) into v_mirror_count
  from public.appointment_slots aps
  join public.appointments a on a.id = aps.appointment_id
  where a.staff_id = '00000000-0000-4000-8000-100000000201'
    and a.starts_at = '$raceBaseDate 14:00 Europe/Istanbul'
    and a.status = 'confirmed';

  if v_mirror_count <> 1 then
    raise exception 'race proof expected exactly one realtime mirror row, got %', v_mirror_count;
  end if;
end
`$`$;

select 'scheduling-race-ok' as result;
"@ | Set-Content -Path $verifySql -Encoding UTF8

@"
delete from public.appointments where staff_id = '00000000-0000-4000-8000-100000000201';
delete from public.blocks where staff_id = '00000000-0000-4000-8000-100000000201';
delete from public.staff_schedules where staff_id = '00000000-0000-4000-8000-100000000201';
delete from public.services where id = '00000000-0000-4000-8000-100000000301';
delete from public.staff where id = '00000000-0000-4000-8000-100000000201';
delete from public.shops where id = '00000000-0000-4000-8000-100000000101';
"@ | Set-Content -Path $cleanupSql -Encoding UTF8

$commonRaceSetup = Get-Content -Path $setupSql -Raw

@"
$commonRaceSetup

delete from public.appointments
where staff_id = '00000000-0000-4000-8000-100000000201'
  and starts_at = '$raceBaseDate 15:00 Europe/Istanbul';
delete from public.blocks
where staff_id = '00000000-0000-4000-8000-100000000201'
  and starts_at = '$raceBaseDate 15:00 Europe/Istanbul';
"@ | Set-Content -Path $bookVsBlockSetupSql -Encoding UTF8

@"
set role service_role;
select public.create_appointment_atomic(
  'proof-race',
  null,
  '00000000-0000-4000-8000-100000000301',
  '00000000-0000-4000-8000-100000000201',
  '$raceBaseDate 15:00 Europe/Istanbul',
  'Proof Race Book Vs Block',
  null,
  null,
  null
);
"@ | Set-Content -Path $bookAttemptSql -Encoding UTF8

@"
set role service_role;
select public.create_block_atomic(
  '00000000-0000-4000-8000-100000000201',
  '$raceBaseDate 15:00 Europe/Istanbul',
  '$raceBaseDate 15:30 Europe/Istanbul',
  'walkin',
  'widget'
);
"@ | Set-Content -Path $blockAttemptSql -Encoding UTF8

@"
do `$`$
declare
  v_appt_count int;
  v_block_count int;
begin
  select count(*) into v_appt_count
  from public.appointments
  where staff_id = '00000000-0000-4000-8000-100000000201'
    and starts_at = '$raceBaseDate 15:00 Europe/Istanbul'
    and status = 'confirmed';

  select count(*) into v_block_count
  from public.blocks
  where staff_id = '00000000-0000-4000-8000-100000000201'
    and starts_at = '$raceBaseDate 15:00 Europe/Istanbul';

  if (v_appt_count + v_block_count) <> 1 then
    raise exception 'book-vs-block proof expected exactly one persisted row, got appointments=% blocks=%', v_appt_count, v_block_count;
  end if;
end
`$`$;

select 'scheduling-book-vs-block-ok' as result;
"@ | Set-Content -Path $bookVsBlockVerifySql -Encoding UTF8

@"
delete from public.appointments
where staff_id = '00000000-0000-4000-8000-100000000201'
  and starts_at = '$raceBaseDate 15:00 Europe/Istanbul';
delete from public.blocks
where staff_id = '00000000-0000-4000-8000-100000000201'
  and starts_at = '$raceBaseDate 15:00 Europe/Istanbul';
"@ | Set-Content -Path $bookVsBlockCleanupSql -Encoding UTF8

@"
delete from public.blocks
where staff_id = '00000000-0000-4000-8000-100000000201'
  and starts_at = '$raceBaseDate 16:00 Europe/Istanbul';
"@ | Set-Content -Path $blockVsBlockSetupSql -Encoding UTF8

@"
set role service_role;
select public.create_block_atomic(
  '00000000-0000-4000-8000-100000000201',
  '$raceBaseDate 16:00 Europe/Istanbul',
  '$raceBaseDate 16:30 Europe/Istanbul',
  'walkin',
  'widget'
);
"@ | Set-Content -Path $blockAttempt1Sql -Encoding UTF8

@"
set role service_role;
select public.create_block_atomic(
  '00000000-0000-4000-8000-100000000201',
  '$raceBaseDate 16:00 Europe/Istanbul',
  '$raceBaseDate 16:30 Europe/Istanbul',
  'personal',
  'app'
);
"@ | Set-Content -Path $blockAttempt2Sql -Encoding UTF8

@"
do `$`$
declare
  v_count int;
begin
  select count(*) into v_count
  from public.blocks
  where staff_id = '00000000-0000-4000-8000-100000000201'
    and starts_at = '$raceBaseDate 16:00 Europe/Istanbul';

  if v_count <> 1 then
    raise exception 'block-vs-block proof expected exactly one block, got %', v_count;
  end if;
end
`$`$;

select 'scheduling-block-vs-block-ok' as result;
"@ | Set-Content -Path $blockVsBlockVerifySql -Encoding UTF8

@"
delete from public.blocks
where staff_id = '00000000-0000-4000-8000-100000000201'
  and starts_at = '$raceBaseDate 16:00 Europe/Istanbul';
"@ | Set-Content -Path $blockVsBlockCleanupSql -Encoding UTF8

@"
delete from public.appointments
where staff_id in (
  select id
  from public.staff
  where shop_id = '00000000-0000-4000-8000-100000000101'
)
and starts_at = '$raceBaseDate 09:30 Europe/Istanbul';
"@ | Set-Content -Path $anyStaffSetupSql -Encoding UTF8

@"
set role service_role;
select public.create_appointment_atomic(
  'proof-race',
  null,
  '00000000-0000-4000-8000-100000000301',
  null,
  '$raceBaseDate 09:30 Europe/Istanbul',
  'Proof Any Staff Race 1',
  null,
  null,
  null
);
"@ | Set-Content -Path $anyStaffAttempt1Sql -Encoding UTF8

@"
set role service_role;
select public.create_appointment_atomic(
  'proof-race',
  null,
  '00000000-0000-4000-8000-100000000301',
  null,
  '$raceBaseDate 09:30 Europe/Istanbul',
  'Proof Any Staff Race 2',
  null,
  null,
  null
);
"@ | Set-Content -Path $anyStaffAttempt2Sql -Encoding UTF8

@"
do `$`$
declare
  v_count int;
  v_distinct_staff int;
begin
  select count(*) into v_count
  from public.appointments
  where starts_at = '$raceBaseDate 09:30 Europe/Istanbul'
    and staff_id in (
      select id
      from public.staff
      where shop_id = '00000000-0000-4000-8000-100000000101'
    )
    and status = 'confirmed';

  select count(distinct staff_id) into v_distinct_staff
  from public.appointments
  where starts_at = '$raceBaseDate 09:30 Europe/Istanbul'
    and staff_id in (
      select id
      from public.staff
      where shop_id = '00000000-0000-4000-8000-100000000101'
    )
    and status = 'confirmed';

  if v_count <> 2 then
    raise exception 'any-staff race expected two confirmed appointments across staff pool, got %', v_count;
  end if;
  if v_distinct_staff <> 2 then
    raise exception 'any-staff race assigned both requests to the same staff member';
  end if;
end
`$`$;

select 'scheduling-any-staff-race-ok' as result;
"@ | Set-Content -Path $anyStaffVerifySql -Encoding UTF8

@"
delete from public.appointments
where staff_id in (
  select id
  from public.staff
  where shop_id = '00000000-0000-4000-8000-100000000101'
)
and starts_at = '$raceBaseDate 09:30 Europe/Istanbul';
"@ | Set-Content -Path $anyStaffCleanupSql -Encoding UTF8

try {
  Invoke-ConcurrentSqlRace -Name "booking-race" `
    -SetupSql $setupSql `
    -AttemptSqls @($attemptSql, $attemptSql) `
    -ExpectedExitCodes @(0, 3) `
    -VerifySql $verifySql `
    -CleanupSql $cleanupSql

  Invoke-ConcurrentSqlRace -Name "book-vs-block-race" `
    -SetupSql $bookVsBlockSetupSql `
    -AttemptSqls @($bookAttemptSql, $blockAttemptSql) `
    -ExpectedExitCodes @(0, 3) `
    -VerifySql $bookVsBlockVerifySql `
    -CleanupSql $bookVsBlockCleanupSql

  Invoke-ConcurrentSqlRace -Name "block-vs-block-race" `
    -SetupSql $blockVsBlockSetupSql `
    -AttemptSqls @($blockAttempt1Sql, $blockAttempt2Sql) `
    -ExpectedExitCodes @(0, 3) `
    -VerifySql $blockVsBlockVerifySql `
    -CleanupSql $blockVsBlockCleanupSql

  Invoke-ConcurrentSqlRace -Name "any-staff-race" `
    -SetupSql $anyStaffSetupSql `
    -AttemptSqls @($anyStaffAttempt1Sql, $anyStaffAttempt2Sql) `
    -ExpectedExitCodes @(0, 0) `
    -VerifySql $anyStaffVerifySql `
    -CleanupSql $anyStaffCleanupSql
}
finally {
  Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
