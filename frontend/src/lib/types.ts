/** Shapes returned by the backend. Kept in one place so cards never guess. */

export type LiveState = {
  car_id: number;
  /** "mqtt" while the broker is delivering, "db" on a cold start. */
  source?: "mqtt" | "db";
  updated_at?: number;
  state?: string;
  since?: string;
  display_name?: string;
  battery_level?: number;
  usable_battery_level?: number;
  est_battery_range_km?: number | null;
  rated_battery_range_km?: number | null;
  odometer?: number;
  elevation?: number;
  speed?: number;
  power?: number;
  latitude?: number;
  longitude?: number;
  geofence?: string | null;
  inside_temp?: number | null;
  outside_temp?: number | null;
  locked?: boolean;
  sentry_mode?: boolean;
  plugged_in?: boolean;
  is_climate_on?: boolean;
  charging_state?: string;
  charger_power?: number;
  charge_energy_added?: number;
  charge_limit_soc?: number;
  time_to_full_charge?: number;
  version?: string;
  update_available?: boolean;
};

export type Car = {
  id: number;
  model: string | null;
  name: string | null;
  marketing_name: string | null;
  trim_badging: string | null;
  vin: string | null;
  label: string;
  vin_suffix: string;
};

export type Drive = {
  id: number;
  start_date: string;
  end_date: string | null;
  duration_min: number | null;
  distance_km: number;
  from: string | null;
  to: string | null;
  from_lat: number | null;
  from_lng: number | null;
};

export type Driving = {
  today_drives: number;
  today_km: number;
  month_drives: number;
  month_km: number;
};

export type Summary = {
  car: Car;
  live: LiveState;
  driving: Driving;
  recent_drives: Drive[];
};

export type DrivesPage = { car_id: number; drives: Drive[] };
