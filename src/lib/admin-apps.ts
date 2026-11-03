import "server-only";
import type { AppAccounts, AppCounts, AppDay, Cohort } from "@/lib/admin-apps-core";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

// 管理 › 姉妹アプリ: the sisters' counts from the pl_admin_app_* functions
// (supabase/migrations/20261103000000_app_usage.sql), which only the service role may call. As in admin-usage.ts,
// every loader checks the admin itself.

type AppSqlRow = {
  app: string;
  devices: number;
  today: number;
  week: number;
  month: number;
  new_week: number;
  from_home_week: number;
  opens_week: number;
  learns_week: number;
  says_week: number;
  first_day: string | null;
  last_day: string | null;
};

type AccountsSqlRow = { app: string; accounts: number; week: number; month: number };

type DaySqlRow = {
  day: string;
  devices: number;
  new_devices: number;
  from_home: number;
  opens: number;
  learns: number;
  says: number;
};

type CohortSqlRow = {
  first_day: string;
  devices: number;
  back_next: number | null;
  back_week: number | null;
  back_any: number;
};

/** Each app that has counted anything, by its id. */
export async function loadAppCounts(): Promise<Map<string, AppCounts>> {
  await requireAdmin();
  const { data, error } = await createAdminClient().rpc("pl_admin_apps");
  if (error) throw new Error(`[admin-apps] apps: ${error.message}`);
  return new Map(
    ((data ?? []) as AppSqlRow[]).map((r) => [
      r.app,
      {
        devices: r.devices,
        today: r.today,
        week: r.week,
        month: r.month,
        newWeek: r.new_week,
        fromHomeWeek: r.from_home_week,
        opensWeek: r.opens_week,
        learnsWeek: r.learns_week,
        saysWeek: r.says_week,
        firstDay: r.first_day,
        lastDay: r.last_day,
      },
    ]),
  );
}

/** Accounts keeping their record in each sister (excluded accounts left out), by app id. */
export async function loadAppAccounts(): Promise<Map<string, AppAccounts>> {
  await requireAdmin();
  const { data, error } = await createAdminClient().rpc("pl_admin_app_accounts");
  if (error) throw new Error(`[admin-apps] accounts: ${error.message}`);
  return new Map(
    ((data ?? []) as AccountsSqlRow[]).map((r) => [r.app, { accounts: r.accounts, week: r.week, month: r.month }]),
  );
}

/** One app's last `span` days, oldest first and today last. */
export async function loadAppDays(app: string, span: number): Promise<AppDay[]> {
  await requireAdmin();
  const { data, error } = await createAdminClient().rpc("pl_admin_app_days", { p_app: app, span_days: span });
  if (error) throw new Error(`[admin-apps] days: ${error.message}`);
  return ((data ?? []) as DaySqlRow[]).map((r) => ({
    day: r.day,
    devices: r.devices,
    newDevices: r.new_devices,
    fromHome: r.from_home,
    opens: r.opens,
    learns: r.learns,
    says: r.says,
  }));
}

/** Devices by the day they first came in the last `span` days, newest first. */
export async function loadAppCohorts(app: string, span: number): Promise<Cohort[]> {
  await requireAdmin();
  const { data, error } = await createAdminClient().rpc("pl_admin_app_cohorts", { p_app: app, span_days: span });
  if (error) throw new Error(`[admin-apps] cohorts: ${error.message}`);
  return ((data ?? []) as CohortSqlRow[]).map((r) => ({
    firstDay: r.first_day,
    devices: r.devices,
    backNext: r.back_next,
    backWeek: r.back_week,
    backAny: r.back_any,
  }));
}
