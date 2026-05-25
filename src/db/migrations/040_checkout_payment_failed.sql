-- Track failed online checkout payments instead of leaving them as unpaid
-- or accidentally promoting them to paid.

alter table checkout_orders
  drop constraint if exists checkout_orders_payment_status_check;

alter table checkout_orders
  add constraint checkout_orders_payment_status_check
  check (payment_status in ('unpaid','marked_paid','payment_failed','refunded'));
