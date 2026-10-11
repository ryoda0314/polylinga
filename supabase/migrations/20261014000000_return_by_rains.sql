-- A pattern comes back after a number of other rains as well as after a number of days, whichever comes first:
-- someone who bathes a lot meets a new pattern again within the same sitting. return_after is the learner's rain count
-- (clusters bathed in, in that language) at which it is due again.
alter table public.pl_exposures add column if not exists return_after int;
