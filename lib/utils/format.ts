/**
 * Shared utility functions for formatting data
 * Used throughout the application to ensure consistent display
 */

/**
 * Format a number as Vietnamese Dong currency
 * @param amount - The amount to format
 * @returns Formatted currency string (e.g., "1.000.000 ₫")
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "0 ₫";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format a date to Vietnamese locale
 * @param date - The date to format (string, Date, or number)
 * @param options - Optional Intl.DateTimeFormatOptions
 * @returns Formatted date string (e.g., "22/10/2025")
 */
export function formatDate(
  date: string | Date | number | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }
): string {
  if (!date) return "";
  const dateObj =
    typeof date === "string" || typeof date === "number"
      ? new Date(date)
      : date;
  return new Intl.DateTimeFormat("vi-VN", options).format(dateObj);
}

/**
 * Format a date and time to Vietnamese locale
 * @param date - The date to format
 * @returns Formatted date-time string (e.g., "22/10/2025 12:30")
 */
export function formatDateTime(
  date: string | Date | number | null | undefined
): string {
  return formatDate(date, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format a number with thousand separators
 * @param num - The number to format
 * @param decimals - Number of decimal places (default: 0)
 * @returns Formatted number string (e.g., "1.000.000")
 */
export function formatNumber(
  num: number | null | undefined,
  decimals: number = 0
): string {
  if (num === null || num === undefined) return "0";
  return new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * Format a percentage
 * @param value - The value to format (0-100)
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted percentage string (e.g., "15.5%")
 */
export function formatPercent(
  value: number | null | undefined,
  decimals: number = 1
): string {
  if (value === null || value === undefined) return "0%";
  return `${formatNumber(value, decimals)}%`;
}

/**
 * Format a file size in bytes to human-readable format
 * @param bytes - The size in bytes
 * @returns Formatted file size (e.g., "1.5 MB")
 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes === 0) return "0 B";
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Truncate text to specified length
 * @param text - The text to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated text with ellipsis if needed
 */
export function truncateText(
  text: string | null | undefined,
  maxLength: number = 50
): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

/**
 * Format phone number to Vietnamese format
 * @param phone - The phone number to format
 * @returns Formatted phone number (e.g., "0901 234 567")
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");

  // Format based on length
  if (digits.length === 10) {
    return `${digits.substring(0, 4)} ${digits.substring(
      4,
      7
    )} ${digits.substring(7)}`;
  }
  return phone;
}
