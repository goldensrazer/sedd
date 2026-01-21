/**
 * Format a date to ISO string with timezone
 */
export const formatTimestamp = (date: Date = new Date()): string => {
  return date.toISOString();
};

/**
 * Get a session timestamp for file naming (YYYY-MM-DD_HH-mm-ss)
 */
export const getSessionTimestamp = (date: Date = new Date()): string => {
  const pad = (n: number): string => n.toString().padStart(2, '0');

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
};

/**
 * Parse a session timestamp back to a Date
 */
export const parseSessionTimestamp = (timestamp: string): Date => {
  const match = timestamp.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid session timestamp format: ${timestamp}`);
  }

  const [, year, month, day, hours, minutes, seconds] = match;
  return new Date(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    parseInt(hours),
    parseInt(minutes),
    parseInt(seconds)
  );
};

/**
 * Format a date for display in changelog entries
 */
export const formatChangelogDate = (date: Date = new Date()): string => {
  return date.toISOString().split('T')[0];
};
