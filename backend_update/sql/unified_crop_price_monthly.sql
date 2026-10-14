-- ============================================================================
-- UnifiedCropPriceMonthly — monthly price rollup of UnifiedCropPrice
--
-- Powers the web price-over-time chart's long ranges (1Y / 2Y / All) and the
-- row counts the raw CSV export uses to size and page its download. A full
-- commodity history is ~14k rollup rows (Apples) instead of ~574k raw rows.
--
-- Maintained ONLY by refresh_price_monthly(), which the daily pipeline calls
-- after re-uploading its recent window. Never edit rows by hand, and re-run
-- the refresh for any months touched by a historical re-upload.
--
-- Price basis (matches the web hook's per-row rule, in priority order):
--   'lb'   price_per_lb is set
--   'unit' else price_per_unit is set   (shown as $/each)
--   'pkg'  else price_avg is set        (price per package)
--   'none' no price at all              (kept so row_count stays exact for exports)
-- Bases are never mixed: the chart plots one basis at a time (unit selector).
-- ============================================================================

create table if not exists public."UnifiedCropPriceMonthly" (
    month        date not null,                  -- first day of the month, UTC
    commodity    text not null,
    market_type  text not null,                  -- raw value, e.g. 'Retail - Specialty Crops'
    variety      text not null default '',       -- '' = NULL in the raw table
    package      text not null default '',
    district     text not null default '',
    organic      text not null default '',
    price_basis  text not null check (price_basis in ('lb', 'unit', 'pkg', 'none')),
    price_sum    double precision not null default 0,  -- sum of positive prices in this basis
    price_count  integer not null default 0,           -- rows behind price_sum (avg = sum / count)
    row_count    integer not null,                     -- ALL raw rows in the group, priced or not
    primary key (commodity, month, market_type, variety, package, district, organic, price_basis)
);

comment on table public."UnifiedCropPriceMonthly" is
    'Monthly rollup of UnifiedCropPrice. Maintained by refresh_price_monthly(); do not edit by hand.';

-- Read-only for everyone (same as UnifiedCropPrice); only the service role writes.
alter table public."UnifiedCropPriceMonthly" enable row level security;

drop policy if exists "Enable read access for all users" on public."UnifiedCropPriceMonthly";
create policy "Enable read access for all users"
    on public."UnifiedCropPriceMonthly" for select using (true);

-- RLS has no write policies, but TRUNCATE bypasses RLS, so drop the write
-- grants Supabase gives new tables by default.
revoke insert, update, delete, truncate on public."UnifiedCropPriceMonthly" from anon, authenticated;


-- ----------------------------------------------------------------------------
-- refresh_price_monthly(from_month, to_month)
--
-- Rebuilds the rollup for months in [from_month, to_month) from the raw table,
-- in one transaction (readers see the old or new months, never a gap).
-- to_month NULL = through the latest data. Returns the number of rows written.
--
--   Daily pipeline:  select refresh_price_monthly(<1st of oldest re-uploaded month>);
-- ----------------------------------------------------------------------------
create or replace function public.refresh_price_monthly(from_month date, to_month date default null)
returns integer
language plpgsql
set search_path = public
set statement_timeout = '300s'
as $$
declare
    lo date := date_trunc('month', from_month)::date;
    hi date := date_trunc('month', to_month)::date;  -- NULL stays NULL
    written integer;
begin
    delete from "UnifiedCropPriceMonthly"
    where month >= lo and (hi is null or month < hi);

    with src as (
        select
            date_trunc('month', report_date at time zone 'UTC')::date as month,
            commodity,
            market_type,
            coalesce(variety, '')  as variety,
            coalesce(package, '')  as package,
            coalesce(district, '') as district,
            coalesce(organic, '')  as organic,
            case
                when price_per_lb   is not null and price_per_lb   <> 'NaN' then 'lb'
                when price_per_unit is not null and price_per_unit <> 'NaN' then 'unit'
                when price_avg      is not null and price_avg      <> 'NaN' then 'pkg'
                else 'none'
            end as price_basis,
            (case
                when price_per_lb   is not null and price_per_lb   <> 'NaN' then price_per_lb
                when price_per_unit is not null and price_per_unit <> 'NaN' then price_per_unit
                when price_avg      is not null and price_avg      <> 'NaN' then price_avg
            end)::double precision as price
        from "UnifiedCropPrice"
        where report_date >= (lo::timestamp at time zone 'UTC')
          and (hi is null or report_date < (hi::timestamp at time zone 'UTC'))
          and commodity is not null
          and market_type is not null
    )
    insert into "UnifiedCropPriceMonthly"
        (month, commodity, market_type, variety, package, district, organic,
         price_basis, price_sum, price_count, row_count)
    select
        month, commodity, market_type, variety, package, district, organic, price_basis,
        coalesce(sum(price) filter (where price > 0), 0),
        count(*) filter (where price > 0),
        count(*)
    from src
    group by month, commodity, market_type, variety, package, district, organic, price_basis;

    get diagnostics written = row_count;
    return written;
end;
$$;

-- Only the pipeline (service role) may rebuild the rollup.
revoke all on function public.refresh_price_monthly(date, date) from public, anon, authenticated;
grant execute on function public.refresh_price_monthly(date, date) to service_role;


-- ----------------------------------------------------------------------------
-- One-time backfill — run each statement separately (each scans ~3 years of
-- raw rows; the full table is too large for one statement). Earliest data is
-- 1998. The last call is open-ended through today.
-- ----------------------------------------------------------------------------
-- select refresh_price_monthly('1990-01-01', '2008-01-01');
-- select refresh_price_monthly('2008-01-01', '2011-01-01');
-- select refresh_price_monthly('2011-01-01', '2014-01-01');
-- select refresh_price_monthly('2014-01-01', '2017-01-01');
-- select refresh_price_monthly('2017-01-01', '2020-01-01');
-- select refresh_price_monthly('2020-01-01', '2023-01-01');
-- select refresh_price_monthly('2023-01-01');

-- Check: rollup row_count must equal the raw row count per commodity.
-- select r.commodity, r.n as raw_rows, m.n as rollup_rows
-- from (select commodity, count(*) n from "UnifiedCropPrice"
--       where commodity is not null and market_type is not null group by 1) r
-- full join (select commodity, sum(row_count) n from "UnifiedCropPriceMonthly" group by 1) m
--   using (commodity)
-- where r.n is distinct from m.n;
