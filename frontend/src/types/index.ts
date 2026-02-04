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
  total_months_analyzed: number;
  months_data: MonthData[];
}
