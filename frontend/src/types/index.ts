export interface Dish {
  id: number;
  name: string;
  quantity: number;
  price: number | null;
  calories: number | null;
  is_estimated: boolean;
}

export interface Order {
  id: number;
  email_id: string;
  order_date: string;
  restaurant_name: string;
  total_calories: number | null;
  total_price: number | null;
  has_estimates: boolean;
  dishes: Dish[];
}

export interface CalendarDayData {
  orders: Order[];
  total_calories: number;
  total_price: number;
  has_estimates: boolean;
}

export interface CalendarMonthResponse {
  year: number;
  month: number;
  days: Record<string, CalendarDayData>;
  monthly_calories: number;
  monthly_price: number;
}

export interface User {
  id: number;
  email: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface SyncStatus {
  status: string;
  emails_processed: number;
  orders_created: number;
  errors: string[];
}

export interface MonthData {
  month: string;
  short_month: string;
  year: number;
  month_num: number;
  total_calories: number;
  total_price: number;
  days_ordered: number;
  order_count: number;
}

export interface SummaryResponse {
  avg_monthly_spend: number;
  avg_monthly_calories: number;
  avg_days_ordered: number;
  avg_order_count: number;
  total_months_analyzed: number;
  months_data: MonthData[];
  top_dish: string | null;
  top_dish_count: number;
  health_insights: HealthInsights | null;
  daily_health_scores: DailyHealthScore[] | null;
  late_night_order_pct: number | null;
}

// Health Intelligence Types

export interface HabitItem {
  item: string;
  detail: string;
}

export interface NutrientLevel {
  name: string;
  level: 'high' | 'medium' | 'low';
}

export interface HealthInsights {
  health_index: number;  // 0-100
  one_liner: string;
  good_habits: HabitItem[];  // Healthy things being consumed
  bad_habits: HabitItem[];   // Unhealthy things being consumed
  lacking: string[];         // Nutrients/foods missing from diet
  best_dishes: string[];     // Healthiest dishes ordered
  worst_dishes: string[];    // Unhealthiest dishes ordered
  narrative: string;         // Second person narrative
  nutrient_levels: NutrientLevel[] | null;  // Macro/micro levels
  late_night_pct: number | null;  // % of orders after 9pm
}

export interface DailyHealthScore {
  date: string;
  health_index: number;
}
