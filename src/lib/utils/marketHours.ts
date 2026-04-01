/**
 * Market hours utility for Indian stock market (NSE)
 * NSE operates Monday-Friday, 9:15 AM to 3:30 PM IST
 */

/**
 * Get current time in IST (UTC+5:30)
 */
function getISTTime(): Date {
  const utcDate = new Date();
  // IST is UTC+5:30, so add 5.5 hours to UTC
  const istDate = new Date(utcDate.getTime() + 5.5 * 60 * 60 * 1000);
  return istDate;
}

export function isMarketOpen(): boolean {
  const istTime = getISTTime();

  // Market is closed on weekends (0 = Sunday, 6 = Saturday)
  const dayOfWeek = istTime.getUTCDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }

  const hours = istTime.getUTCHours();
  const minutes = istTime.getUTCMinutes();

  // Market opening: 9:15 AM IST
  const marketOpen = 9 * 60 + 15;
  // Market closing: 3:30 PM IST
  const marketClose = 15 * 60 + 30;

  const currentMinutes = hours * 60 + minutes;

  // Market is open between 9:15 AM and 3:30 PM
  return currentMinutes >= marketOpen && currentMinutes < marketClose;
}

/**
 * Get time until market opens/closes
 */
export function getMarketStatus(): {
  isOpen: boolean;
  nextEvent: "opens" | "closes";
  timeUntilSeconds: number;
} {
  const istTime = getISTTime();

  const dayOfWeek = istTime.getUTCDay();
  const hours = istTime.getUTCHours();
  const minutes = istTime.getUTCMinutes();
  const seconds = istTime.getUTCSeconds();

  const marketOpenMinutes = 9 * 60 + 15;
  const marketCloseMinutes = 15 * 60 + 30;
  const currentMinutes = hours * 60 + minutes + seconds / 60;

  // Check if it's a weekday
  const isWeekday = dayOfWeek !== 0 && dayOfWeek !== 6;

  if (!isWeekday) {
    // Market is closed on weekends, next opening is Monday 9:15 AM
    const daysUntilMonday = (1 - dayOfWeek + 7) % 7 || 7;
    const nextOpenTime = new Date(istTime.getTime());
    nextOpenTime.setUTCDate(nextOpenTime.getUTCDate() + daysUntilMonday);
    nextOpenTime.setUTCHours(9, 15, 0, 0);

    const timeUntilSeconds = Math.max(0, (nextOpenTime.getTime() - istTime.getTime()) / 1000);

    return {
      isOpen: false,
      nextEvent: "opens",
      timeUntilSeconds,
    };
  }

  if (currentMinutes < marketOpenMinutes) {
    const nextOpenMinutes = marketOpenMinutes - currentMinutes;
    return {
      isOpen: false,
      nextEvent: "opens",
      timeUntilSeconds: nextOpenMinutes * 60,
    };
  }

  if (currentMinutes < marketCloseMinutes) {
    return {
      isOpen: true,
      nextEvent: "closes",
      timeUntilSeconds: (marketCloseMinutes - currentMinutes) * 60,
    };
  }

  // Market closed after hours
  const nextOpenMinutes = 24 * 60 - currentMinutes + marketOpenMinutes + 1440; // Next day 9:15 AM
  return {
    isOpen: false,
    nextEvent: "opens",
    timeUntilSeconds: nextOpenMinutes * 60,
  };
}
