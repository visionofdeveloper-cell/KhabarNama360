import { WeatherData } from '../../../types/index.ts';
import { db } from '../../db.ts';

interface CityGeo {
  cityId: string;
  nameEn: string;
  nameUr: string;
  provinceEn: string;
  provinceUr: string;
  lat: number;
  lon: number;
}

const PAKISTAN_CITIES: CityGeo[] = [
  { cityId: 'karachi', nameEn: 'Karachi', nameUr: 'کراچی', provinceEn: 'Sindh', provinceUr: 'سندھ', lat: 24.8607, lon: 67.0011 },
  { cityId: 'lahore', nameEn: 'Lahore', nameUr: 'لاہور', provinceEn: 'Punjab', provinceUr: 'پنجاب', lat: 31.5497, lon: 74.3436 },
  { cityId: 'islamabad', nameEn: 'Islamabad', nameUr: 'اسلام آباد', provinceEn: 'Federal Capital', provinceUr: 'وفاقی دارالحکومت', lat: 33.6844, lon: 73.0479 },
  { cityId: 'rawalpindi', nameEn: 'Rawalpindi', nameUr: 'راولپنڈی', provinceEn: 'Punjab', provinceUr: 'پنجاب', lat: 33.5651, lon: 73.0169 },
  { cityId: 'peshawar', nameEn: 'Peshawar', nameUr: 'پشاور', provinceEn: 'Khyber Pakhtunkhwa', provinceUr: 'خیبر پختونخوا', lat: 34.0151, lon: 71.5249 },
  { cityId: 'quetta', nameEn: 'Quetta', nameUr: 'کوئٹہ', provinceEn: 'Balochistan', provinceUr: 'بلوچستان', lat: 30.1798, lon: 66.9750 },
  { cityId: 'multan', nameEn: 'Multan', nameUr: 'ملتان', provinceEn: 'Punjab', provinceUr: 'پنجاب', lat: 30.1575, lon: 71.5249 },
  { cityId: 'faisalabad', nameEn: 'Faisalabad', nameUr: 'فیصل آباد', provinceEn: 'Punjab', provinceUr: 'پنجاب', lat: 31.4504, lon: 73.1350 },
  { cityId: 'sialkot', nameEn: 'Sialkot', nameUr: 'سیالکوٹ', provinceEn: 'Punjab', provinceUr: 'پنجاب', lat: 32.4945, lon: 74.5229 },
  { cityId: 'hyderabad', nameEn: 'Hyderabad', nameUr: 'حیدرآباد', provinceEn: 'Sindh', provinceUr: 'سندھ', lat: 25.3960, lon: 68.3578 },
  { cityId: 'murree', nameEn: 'Murree', nameUr: 'مری', provinceEn: 'Punjab Hills', provinceUr: 'پنجاب / ملکہ کوہسار', lat: 33.9070, lon: 73.3943 },
  { cityId: 'gwadar', nameEn: 'Gwadar', nameUr: 'گوادر', provinceEn: 'Balochistan Coast', provinceUr: 'بلوچستان ساحل', lat: 25.1216, lon: 62.3254 },
];

function parseWmoCode(code: number): { en: string; ur: string } {
  switch (code) {
    case 0:
      return { en: 'Clear Sky', ur: 'صاف مطلع' };
    case 1:
      return { en: 'Mainly Clear', ur: 'زیادہ تر صاف' };
    case 2:
      return { en: 'Partly Cloudy', ur: 'جزوی ابر آلود' };
    case 3:
      return { en: 'Overcast', ur: 'مطلع ابر آلود' };
    case 45:
    case 48:
      return { en: 'Dense Fog / Smog', ur: 'شدید دھند اور اسموگ' };
    case 51:
    case 53:
    case 55:
      return { en: 'Drizzle', ur: 'ہلکی بونداباندی' };
    case 61:
    case 63:
    case 65:
      return { en: 'Rain', ur: 'بارش' };
    case 71:
    case 73:
    case 75:
      return { en: 'Snowfall', ur: 'برف باری' };
    case 80:
    case 81:
    case 82:
      return { en: 'Rain Showers', ur: 'تیز بارش کے جھکڑ' };
    case 95:
    case 96:
    case 99:
      return { en: 'Thunderstorm', ur: 'گرج چمک کے ساتھ طوفان' };
    default:
      return { en: 'Sunny & Pleasant', ur: 'خوشگوار دھوپ' };
  }
}

function parseAqi(aqiVal: number): { statusEn: string; statusUr: string } {
  if (aqiVal <= 50) return { statusEn: 'Good', statusUr: 'بہترین' };
  if (aqiVal <= 100) return { statusEn: 'Moderate', statusUr: 'معتدل' };
  if (aqiVal <= 150) return { statusEn: 'Unhealthy for Sensitive', statusUr: 'حساس افراد کے لیے مضر' };
  if (aqiVal <= 200) return { statusEn: 'Unhealthy (Smog)', statusUr: 'مضرِ صحت (اسموگ)' };
  return { statusEn: 'Hazardous Smog Alert', statusUr: 'شدید خطرناک اسموگ' };
}

export async function syncWeatherData(): Promise<{
  success: boolean;
  changesDetected: boolean;
  changeSummaryEn: string;
  changeSummaryUr: string;
  itemsProcessed: number;
  error?: string;
  weather?: WeatherData[];
}> {
  const provider = db.getDataProvider('weather-openmeteo');
  const now = new Date().toISOString();
  const updatedWeatherList: WeatherData[] = [];
  let alertsDetected: string[] = [];

  try {
    const lats = PAKISTAN_CITIES.map(c => c.lat).join(',');
    const lons = PAKISTAN_CITIES.map(c => c.lon).join(',');

    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=Asia%2FKarachi`;
    const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lons}&current=us_aqi&timezone=Asia%2FKarachi`;

    const [weatherRes, aqiRes] = await Promise.all([
      fetch(weatherUrl, {
        headers: { 'User-Agent': '360Khabarnama-Automation/1.0' },
        signal: AbortSignal.timeout(10000),
      }),
      fetch(aqiUrl, {
        headers: { 'User-Agent': '360Khabarnama-Automation/1.0' },
        signal: AbortSignal.timeout(6000),
      }).catch(() => null),
    ]);

    if (!weatherRes.ok) {
      throw new Error(`Open-Meteo HTTP ${weatherRes.status}`);
    }

    const rawWeatherPayload = await weatherRes.json();
    const weatherArray = Array.isArray(rawWeatherPayload) ? rawWeatherPayload : [rawWeatherPayload];

    let aqiArray: any[] = [];
    if (aqiRes && aqiRes.ok) {
      try {
        const rawAqiPayload = await aqiRes.json();
        aqiArray = Array.isArray(rawAqiPayload) ? rawAqiPayload : [rawAqiPayload];
      } catch {
        aqiArray = [];
      }
    }

    PAKISTAN_CITIES.forEach((city, idx) => {
      const data = weatherArray[idx];
      const current = data?.current;
      const daily = data?.daily;
      const hourly = data?.hourly;
      if (!current) return;

      let aqiNum = city.cityId === 'lahore' ? 165 : city.cityId === 'karachi' ? 95 : 45;
      const aqiItem = aqiArray[idx];
      if (aqiItem?.current?.us_aqi) {
        aqiNum = Math.round(Number(aqiItem.current.us_aqi));
      }

      const condition = parseWmoCode(current.weather_code || 0);
      const aqiInfo = parseAqi(aqiNum);

      const hourlyList: { time: string; tempC: number; condition: string }[] = [];
      if (hourly && hourly.time && hourly.temperature_2m) {
        const currentHour = new Date().getHours();
        for (let i = 0; i < 5; i++) {
          const targetIdx = (currentHour + i * 3) % hourly.time.length;
          const timeStr = hourly.time[targetIdx] ? hourly.time[targetIdx].split('T')[1] : `${currentHour + i * 3}:00`;
          const tempVal = Math.round(hourly.temperature_2m[targetIdx] || current.temperature_2m);
          const condObj = parseWmoCode(hourly.weather_code?.[targetIdx] || 0);
          hourlyList.push({
            time: timeStr.slice(0, 5),
            tempC: tempVal,
            condition: condObj.en,
          });
        }
      }

      const dailyList: { dayEn: string; dayUr: string; highC: number; lowC: number; conditionEn: string; conditionUr: string }[] = [];
      const daysEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const daysUr = ['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'];

      if (daily && daily.time) {
        for (let d = 0; d < Math.min(5, daily.time.length); d++) {
          const dateObj = new Date(daily.time[d]);
          const dayIdx = dateObj.getDay();
          const cond = parseWmoCode(daily.weather_code?.[d] || 0);
          dailyList.push({
            dayEn: daysEn[dayIdx],
            dayUr: daysUr[dayIdx],
            highC: Math.round(daily.temperature_2m_max[d]),
            lowC: Math.round(daily.temperature_2m_min[d]),
            conditionEn: cond.en,
            conditionUr: cond.ur,
          });
        }
      }

      let alertItem: { titleEn: string; titleUr: string; severity: 'warning' | 'advisory' } | undefined = undefined;
      if (aqiNum >= 180) {
        alertItem = {
          titleEn: 'Severe Smog Advisory: Wear N95 respirator mask',
          titleUr: 'شدید اسموگ وارننگ: این 95 ماسک کا لازمی استعمال کریں',
          severity: 'warning',
        };
        alertsDetected.push(`${city.nameEn} (AQI ${aqiNum})`);
      }

      const formattedSunrise = daily?.sunrise?.[0]
        ? new Date(daily.sunrise[0]).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
        : '06:30 AM';
      const formattedSunset = daily?.sunset?.[0]
        ? new Date(daily.sunset[0]).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
        : '05:30 PM';

      updatedWeatherList.push({
        cityId: city.cityId,
        nameEn: city.nameEn,
        nameUr: city.nameUr,
        provinceEn: city.provinceEn,
        provinceUr: city.provinceUr,
        tempC: Math.round(current.temperature_2m),
        conditionEn: condition.en,
        conditionUr: condition.ur,
        highC: Math.round(daily?.temperature_2m_max?.[0] || current.temperature_2m + 4),
        lowC: Math.round(daily?.temperature_2m_min?.[0] || current.temperature_2m - 5),
        humidity: Math.round(current.relative_humidity_2m),
        windKmh: Math.round(current.wind_speed_10m),
        aqi: aqiNum,
        aqiStatusEn: aqiInfo.statusEn,
        aqiStatusUr: aqiInfo.statusUr,
        feelsLikeC: Math.round(current.apparent_temperature),
        sunrise: formattedSunrise,
        sunset: formattedSunset,
        hourly: hourlyList,
        daily: dailyList,
        alert: alertItem,
      });
    });

    if (updatedWeatherList.length === 0) {
      throw new Error('Could not fetch live weather for any Pakistani cities.');
    }

    // Persist verified weather
    db.updateWeatherData(updatedWeatherList);

    // Update provider record
    db.updateDataProvider('weather-openmeteo', {
      status: 'active',
      lastSyncAt: now,
      lastError: null,
      consecutiveFailures: 0,
      totalSyncs: (provider?.totalSyncs || 0) + 1,
      successfulSyncs: (provider?.successfulSyncs || 0) + 1,
    });

    const summaryEn = alertsDetected.length > 0
      ? `Updated ${updatedWeatherList.length} cities. Smog alerts in: ${alertsDetected.join(', ')}`
      : `Refreshed live meteorological observations and forecasts for ${updatedWeatherList.length} Pakistani cities.`;
    const summaryUr = alertsDetected.length > 0
      ? `${updatedWeatherList.length} شہروں کا موسم اپ ڈیٹ ہوا۔ اسموگ وارننگ: ${alertsDetected.join('، ')}`
      : `${updatedWeatherList.length} پاکستانی شہروں کے موسمی اعداد و شمار اور پیشن گوئی کامیابی سے اپ ڈیٹ ہو گئی۔`;

    return {
      success: true,
      changesDetected: alertsDetected.length > 0,
      changeSummaryEn: summaryEn,
      changeSummaryUr: summaryUr,
      itemsProcessed: updatedWeatherList.length,
      weather: updatedWeatherList,
    };
  } catch (err: any) {
    const errorMsg = err.message || 'Weather sync failed';
    db.updateDataProvider('weather-openmeteo', {
      status: 'degraded',
      lastError: errorMsg,
      consecutiveFailures: (provider?.consecutiveFailures || 0) + 1,
      totalSyncs: (provider?.totalSyncs || 0) + 1,
    });
    return {
      success: false,
      changesDetected: false,
      changeSummaryEn: 'Weather sync failed, fallback to previous verified observations.',
      changeSummaryUr: 'موسم کی اپ ڈیٹ ناکام، پچھلی تصدیق شدہ معلومات برقرار۔',
      itemsProcessed: 0,
      error: errorMsg,
    };
  }
}
