import dayjs from 'dayjs';
import tz from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
dayjs.extend(tz);
dayjs.extend(utc);
dayjs.tz.setDefault('Asia/Ho_Chi_Minh');
export function isSameTimeframe(date1: dayjs.Dayjs, timestamp2: number, type: 'daily' | 'weekly' | 'monthly' | 'yearly') {
  const date2 = dayjs.tz(timestamp2);
  switch (type) {
    case 'daily':
      return date1.startOf('day').isSame(date2.startOf('day'));
    case 'weekly':
      return date1.isSame(date2, 'week');
    case 'monthly':
      return date1.isSame(date2, 'month');
    case 'yearly':
      return date1.isSame(date2, 'year');
  }
}

export function getStartOfTimeframe(timestamp: number, type: 'daily' | 'weekly' | 'monthly' | 'yearly') {
  const date = dayjs.tz(timestamp);
  switch (type) {
    case 'daily':
      return date.startOf('day');
    case 'weekly':
      return date.startOf('week');
    case 'monthly':
      return date.startOf('month');
    case 'yearly':
      return date.startOf('year');
  }
}

export function getEndOfTimeframe(timestamp: number, type: 'daily' | 'weekly' | 'monthly' | 'yearly') {
  const date = dayjs.tz(timestamp);
  switch (type) {
    case 'daily':
      return date.endOf('day');
    case 'weekly':
      return date.endOf('week');
    case 'monthly':
      return date.endOf('month');
    case 'yearly':
      return date.endOf('year');
  }
}

export function getPreviousTimeframe(timestamp: number, type: 'daily' | 'weekly' | 'monthly' | 'yearly') {
  const currentDate = dayjs.tz(timestamp);
  let previousDate: dayjs.Dayjs;

  switch (type) {
    case 'daily':
      previousDate = currentDate.subtract(1, 'day');
      break;
    case 'weekly':
      previousDate = currentDate.subtract(1, 'week');
      break;
    case 'monthly':
      previousDate = currentDate.subtract(1, 'month');
      break;
    case 'yearly':
      previousDate = currentDate.subtract(1, 'year');
      break;
    default:
      throw new Error('Invalid timeframe type');
  }
  return previousDate;
}

export function getNow() {
  return dayjs.tz(Date.now());
}

export function getTime(time: number | string | Date) {
  return dayjs.tz(new Date(time));
}

export function isSame(time: string | number | dayjs.Dayjs, compareTarget: string | number | dayjs.Dayjs, compareUnit: string) {
  return dayjs.tz(time).isSame(dayjs.tz(compareTarget), compareUnit as any);
}
