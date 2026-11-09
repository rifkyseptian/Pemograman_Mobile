import { CalendarEvent } from '../types';
import { ApiError, fetchWithTimeout, readApiResponse } from './apiRequest';

const CALENDAR_API_BASE_URL = 'https://date.nager.at/api/v3';

interface PublicHolidayDto {
  date: string;
  localName: string;
  name: string;
  countryCode: string;
}

/** Fetch Indonesia's public holidays for a year and map the API response to app data. */
export async function getPublicHolidays(
  year: number,
  countryCode = 'ID',
): Promise<CalendarEvent[]> {
  const response = await fetchWithTimeout(
    `${CALENDAR_API_BASE_URL}/PublicHolidays/${year}/${countryCode}`,
    { headers: { Accept: 'application/json' } },
  );

  const payload: unknown = await readApiResponse<unknown>(response);
  if (!Array.isArray(payload)) {
    throw new ApiError('invalid-response', 'Format respons API kalender tidak sesuai.');
  }

  return (payload as PublicHolidayDto[])
    .filter((holiday) =>
      typeof holiday.date === 'string' &&
      typeof holiday.localName === 'string' &&
      typeof holiday.name === 'string',
    )
    .map((holiday) => ({
      id: `${holiday.countryCode}-${holiday.date}-${holiday.name}`,
      date: holiday.date,
      title: holiday.localName,
      name: holiday.name,
    }))
    .sort((first, second) => first.date.localeCompare(second.date));
}
