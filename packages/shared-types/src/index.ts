export type OrderStatus = "draft" | "pending" | "confirmed" | "cancelled";

export interface ApiErrorBody {
  error: string;
  code?: string;
  details?: unknown;
}
