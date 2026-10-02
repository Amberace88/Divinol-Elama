-- Stripe as an online payment provider (Stripe Checkout: card, Apple Pay, Google Pay, Link, …).
-- Payment method 'stripe', provider 'stripe'. The idempotent payment state machine of 0011 is shared by both
-- providers (statuses PAID / ABANDONED / VOIDED / REFUNDED / PARTIALLY_REFUNDED); texts name the provider.

alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
  check (payment_method in ('bank_transfer', 'card', 'invoice', 'cash_on_pickup', 'montonio_bank', 'montonio_card', 'stripe'));

alter table public.orders drop constraint if exists orders_payment_provider_chk;
alter table public.orders add constraint orders_payment_provider_chk
  check (payment_provider is null or payment_provider in ('montonio', 'stripe'));

-- ───────── place_order(): 'stripe' is an online method (status pending, provider stripe, no proforma) ─────────
do $p$
declare
  d text := pg_get_functiondef('public.place_order(jsonb)'::regprocedure);
begin
  if position($a$'montonio_card', 'stripe')$a$ in d) > 0 then
    return; -- already patched
  end if;
  d := replace(d,
    $a$v_online boolean := v_payment in ('montonio_bank', 'montonio_card');$a$,
    $b$v_online boolean := v_payment in ('montonio_bank', 'montonio_card', 'stripe');$b$);
  d := replace(d,
    $a$v_payment not in ('bank_transfer', 'card', 'invoice', 'cash_on_pickup', 'montonio_bank', 'montonio_card')$a$,
    $b$v_payment not in ('bank_transfer', 'card', 'invoice', 'cash_on_pickup', 'montonio_bank', 'montonio_card', 'stripe')$b$);
  d := replace(d,
    $a$case when v_online then 'montonio' end$a$,
    $b$case when v_payment = 'stripe' then 'stripe' when v_online then 'montonio' end$b$);
  if position($a$'montonio_card', 'stripe')$a$ in d) = 0 or position($a$when v_payment = 'stripe' then 'stripe'$a$ in d) = 0 then
    raise exception 'place_order stripe patch did not apply';
  end if;
  execute d;
end $p$;

-- ───────── labels ─────────
create or replace function public.payment_method_label(p_method text, p_meta jsonb default '{}'::jsonb)
returns text
language sql
immutable
set search_path = public
as $$
  select case p_method
    when 'montonio_bank' then 'bankas saite' || coalesce(' — ' || nullif(p_meta->>'provider_name', ''), '')
    when 'montonio_card' then 'maksājumu karte'
    when 'stripe' then coalesce(nullif(p_meta->>'method_label', ''), 'karte / Apple Pay / Google Pay')
    when 'bank_transfer' then 'bankas pārskaitījums'
    else p_method end;
$$;

create or replace function public.payment_provider_label(p_provider text)
returns text
language sql
immutable
set search_path = public
as $$
  select case p_provider when 'stripe' then 'Stripe' when 'montonio' then 'Montonio' else coalesce(p_provider, '—') end;
$$;

-- ───────── payment_attach ─────────
create or replace function public.payment_attach(p_order uuid, p_ref text, p_method text, p_meta jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders%rowtype;
  v_attempt int;
  v_provider text := case when p_method = 'stripe' then 'stripe' else 'montonio' end;
  v_label text := public.payment_provider_label(case when p_method = 'stripe' then 'stripe' else 'montonio' end);
begin
  if p_method not in ('montonio_bank', 'montonio_card', 'stripe') then raise exception 'invalid_payment'; end if;
  if coalesce(trim(p_ref), '') = '' then raise exception 'invalid_ref'; end if;
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'order_not_found'; end if;
  if o.status = 'cancelled' then raise exception 'order_cancelled'; end if;
  if o.payment_status not in ('pending', 'failed') or o.payment_method not in ('montonio_bank', 'montonio_card', 'stripe') then
    raise exception 'payment_not_allowed';
  end if;
  v_attempt := coalesce((o.payment_meta->>'attempts')::int, 0) + 1;
  update public.orders
     set payment_provider = v_provider, payment_ref = p_ref, payment_method = p_method, payment_status = 'pending',
         payment_meta = (coalesce(payment_meta, '{}'::jsonb) - 'provider_name' - 'sender_name' - 'montonio_status' - 'stripe_status'
                         - 'method_label' - 'payment_intent' - 'reason')
                        || coalesce(p_meta, '{}'::jsonb) || jsonb_build_object('attempts', v_attempt)
   where id = p_order;
  insert into public.order_events (order_id, type, message)
  values (p_order, 'payment',
    case when v_attempt > 1 then 'Atkārtots ' || v_label || ' maksājums (' || v_attempt || '. mēģinājums) — ' else v_label || ' maksājums izveidots — ' end
      || public.payment_method_label(p_method, p_meta) || coalesce(', ' || nullif(p_meta->>'preferred_provider', ''), '') || ' · ' || p_ref);
  return jsonb_build_object('attempt', v_attempt);
end $$;

-- ───────── payment_apply_status ─────────
create or replace function public.payment_apply_status(p_order uuid, p_ref text, p_status text, p_amount numeric default null, p_meta jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders%rowtype;
  v_status text := upper(coalesce(p_status, ''));
  v_online boolean;
  v_current boolean;
  v_new_pay text;
  v_msg text;
  v_reopen boolean := false;
  v_cancel boolean := false;
  v_final text;
  v_label text;
  v_meta jsonb;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then return jsonb_build_object('found', false, 'changed', false); end if;
  if o.payment_provider is null or o.payment_provider not in ('montonio', 'stripe') then
    return jsonb_build_object('found', true, 'changed', false, 'ignored', 'no_online_provider', 'payment_status', o.payment_status);
  end if;
  v_label := public.payment_provider_label(o.payment_provider);
  v_meta := coalesce(p_meta, '{}'::jsonb) || jsonb_build_object(o.payment_provider || '_status', v_status);
  v_online := o.payment_method in ('montonio_bank', 'montonio_card', 'stripe');
  v_current := p_ref is not distinct from o.payment_ref;

  if v_status = 'PAID' then
    if o.payment_status in ('paid', 'refunded', 'partially_refunded') then
      return jsonb_build_object('found', true, 'changed', false, 'payment_status', o.payment_status, 'status', o.status);
    end if;
    if p_amount is not null and abs(p_amount - o.total_gross) > 0.01 then
      v_msg := 'UZMANĪBU: ' || v_label || ' maksājuma summa ' || to_char(p_amount, 'FM999999990.00') || ' EUR nesakrīt ar pasūtījuma summu '
               || to_char(o.total_gross, 'FM999999990.00') || ' EUR — pārbaudiet un atzīmējiet apmaksu manuāli.';
      if not exists (select 1 from public.order_events where order_id = p_order and type = 'payment' and message = v_msg) then
        insert into public.order_events (order_id, type, message) values (p_order, 'payment', v_msg);
      end if;
      return jsonb_build_object('found', true, 'changed', false, 'amount_mismatch', true, 'payment_status', o.payment_status);
    end if;
    v_reopen := o.status = 'cancelled';
    insert into public.order_events (order_id, type, message)
    values (p_order, 'payment', 'Apmaksāts tiešsaistē (' || v_label || ', ' || public.payment_method_label(o.payment_method, coalesce(o.payment_meta, '{}'::jsonb) || v_meta) || ')'
      || coalesce(' · ' || nullif(v_meta->>'sender_name', ''), '')
      || case when not v_online then ' — klients bija pārgājis uz ' || public.payment_method_label(o.payment_method) || '; pārbaudiet, vai nav samaksāts divreiz' else '' end);
    update public.orders
       set payment_status = 'paid', paid_at = coalesce(paid_at, now()),
           payment_ref = coalesce(nullif(p_ref, ''), payment_ref),
           payment_meta = coalesce(payment_meta, '{}'::jsonb) || v_meta,
           status = case when v_reopen then 'new' else status end
     where id = p_order;
    if v_reopen then
      insert into public.order_events (order_id, type, message)
      values (p_order, 'status', 'Atcelts → Jauns (maksājums saņemts pēc atcelšanas — pārbaudiet atlikumus)');
    end if;
    select number into v_final from public.invoices
     where order_id = p_order and type = 'invoice' and status <> 'void' order by created_at desc limit 1;
    return jsonb_build_object('found', true, 'changed', true, 'payment_status', 'paid', 'status', case when v_reopen then 'new' else o.status end,
      'reopened', v_reopen, 'final_invoice', v_final);
  end if;

  if v_status = 'ABANDONED' then
    if not v_current or not v_online or o.payment_status not in ('pending', 'failed') then
      return jsonb_build_object('found', true, 'changed', false, 'payment_status', o.payment_status, 'status', o.status);
    end if;
    if o.payment_status = 'failed' and o.status = 'cancelled' then
      return jsonb_build_object('found', true, 'changed', false, 'payment_status', o.payment_status, 'status', o.status);
    end if;
    v_cancel := o.status = 'new';
    update public.orders
       set payment_status = 'failed',
           payment_meta = coalesce(payment_meta, '{}'::jsonb) || v_meta,
           status = case when v_cancel then 'cancelled' else status end
     where id = p_order;
    insert into public.order_events (order_id, type, message)
    values (p_order, 'payment', coalesce(nullif(v_meta->>'reason', ''), 'Tiešsaistes maksājums netika pabeigts (' || v_label || ': ABANDONED)'));
    if v_cancel then
      insert into public.order_events (order_id, type, message)
      values (p_order, 'status', 'Jauns → Atcelts (neapmaksāts tiešsaistes maksājums, atlikumi atjaunoti)');
    end if;
    return jsonb_build_object('found', true, 'changed', true, 'payment_status', 'failed', 'status', case when v_cancel then 'cancelled' else o.status end,
      'cancelled', v_cancel);
  end if;

  if v_status = 'VOIDED' then
    if o.payment_status = 'failed' or (not v_current and o.payment_status <> 'paid') then
      return jsonb_build_object('found', true, 'changed', false, 'payment_status', o.payment_status, 'status', o.status);
    end if;
    update public.orders
       set payment_status = 'failed', paid_at = null, payment_meta = coalesce(payment_meta, '{}'::jsonb) || v_meta
     where id = p_order;
    insert into public.order_events (order_id, type, message)
    values (p_order, 'payment', 'UZMANĪBU: maksājums anulēts / apstrīdēts (' || v_label || ': VOIDED). Nesūtiet preces, kamēr apmaksa nav pārbaudīta'
      || case when o.payment_status = 'paid' then ' — izrakstītais rēķins jāanulē vai jākoriģē manuāli.' else '.' end);
    return jsonb_build_object('found', true, 'changed', true, 'payment_status', 'failed', 'status', o.status, 'voided', true);
  end if;

  if v_status in ('REFUNDED', 'PARTIALLY_REFUNDED') then
    v_new_pay := case v_status when 'REFUNDED' then 'refunded' else 'partially_refunded' end;
    if o.payment_status = v_new_pay or o.payment_status not in ('paid', 'partially_refunded') then
      return jsonb_build_object('found', true, 'changed', false, 'payment_status', o.payment_status, 'status', o.status);
    end if;
    update public.orders set payment_status = v_new_pay, payment_meta = coalesce(payment_meta, '{}'::jsonb) || v_meta where id = p_order;
    insert into public.order_events (order_id, type, message)
    values (p_order, 'payment', case when v_new_pay = 'refunded' then 'Maksājums pilnībā atmaksāts (' || v_label || ')' else 'Maksājums daļēji atmaksāts (' || v_label || ')' end);
    return jsonb_build_object('found', true, 'changed', true, 'payment_status', v_new_pay, 'status', o.status);
  end if;

  return jsonb_build_object('found', true, 'changed', false, 'payment_status', o.payment_status, 'status', o.status);
end $$;

-- ───────── payment_switch_to_transfer ─────────
create or replace function public.payment_switch_to_transfer(p_order uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders%rowtype;
  v_invoice text;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'order_not_found'; end if;
  if o.status = 'cancelled' then raise exception 'order_cancelled'; end if;
  if o.payment_method not in ('montonio_bank', 'montonio_card', 'stripe') or o.payment_status not in ('pending', 'failed') then
    raise exception 'payment_not_allowed';
  end if;
  update public.orders set payment_method = 'bank_transfer', payment_status = 'unpaid' where id = p_order;
  insert into public.order_events (order_id, type, message)
  values (p_order, 'payment', 'Klients izvēlējās apmaksu ar bankas pārskaitījumu (tiešsaistes maksājums netika pabeigts)');
  select number into v_invoice from public.invoices
   where order_id = p_order and type = 'proforma' and status <> 'void' order by created_at desc limit 1;
  if v_invoice is null then
    v_invoice := public.issue_invoice(p_order, 'proforma', 7);
  end if;
  return jsonb_build_object('id', o.id, 'number', o.number, 'total_gross', o.total_gross, 'invoice_number', v_invoice);
end $$;

-- ───────── ensure_final_invoice: online payments of either provider ─────────
create or replace function public.ensure_final_invoice(p_order uuid, p_force boolean default false)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders%rowtype;
  v_pr public.invoices%rowtype;
  v_number text;
  v_paid timestamptz;
  v_notes text;
  v_label text;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then return null; end if;
  if o.payment_status <> 'paid' or o.status = 'cancelled' then return null; end if;
  if not p_force and not coalesce((public.setting('invoice')->>'auto_final_invoice')::boolean, true) then return null; end if;
  if exists (select 1 from public.invoices where order_id = p_order and type = 'invoice' and status <> 'void') then return null; end if;

  select * into v_pr from public.invoices
   where order_id = p_order and type = 'proforma' and status <> 'void'
   order by created_at desc limit 1;

  if not found then
    if o.payment_provider is null or o.payment_provider not in ('montonio', 'stripe') then return null; end if;
    v_label := public.payment_provider_label(o.payment_provider);
    v_paid := coalesce(o.paid_at, now());
    v_number := public.issue_invoice(p_order, 'invoice', 0);
    v_notes := concat_ws(E'\n',
      'Apmaksāts tiešsaistē (' || v_label || ', ' || public.payment_method_label(o.payment_method, o.payment_meta) || ') '
        || to_char(v_paid at time zone 'Europe/Riga', 'DD.MM.YYYY') || '.',
      nullif(trim(coalesce(public.setting('invoice')->>'notes', '')), ''));
    update public.invoices set status = 'paid', paid_at = v_paid, due_at = issued_at, notes = v_notes where number = v_number;
    update public.order_events set message = v_number || ' — automātiski pēc tiešsaistes maksājuma (' || v_label || ')'
     where order_id = p_order and type = 'invoice' and message = v_number;
    return v_number;
  end if;

  v_paid := coalesce(o.paid_at, v_pr.paid_at, now());
  v_number := public.issue_invoice(p_order, 'invoice', 0);
  v_notes := concat_ws(E'\n',
    'Apmaksāts saskaņā ar avansa rēķinu ' || v_pr.number || ' (' || to_char(v_paid at time zone 'Europe/Riga', 'DD.MM.YYYY') || ').',
    nullif(trim(coalesce(public.setting('invoice')->>'notes', '')), ''));
  update public.invoices set status = 'paid', paid_at = v_paid, due_at = issued_at, notes = v_notes where number = v_number;
  update public.order_events set message = v_number || ' — automātiski pēc avansa rēķina ' || v_pr.number || ' apmaksas'
   where order_id = p_order and type = 'invoice' and message = v_number;
  return v_number;
end $$;

revoke execute on function public.payment_provider_label(text) from public, anon, authenticated;
