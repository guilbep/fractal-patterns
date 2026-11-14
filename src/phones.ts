// The phone list under "Phone wallpaper": 32 models most used in 2026, with their screen pixels and density.
// Ranking: Counterpoint 2025 top 10 (it publishes no more), filled with the current Apple range and common Android phones.
// The iPhones are confirmed (Apple compare page; density from yesviz). The Android values are approximate: Wikipedia,
// yesviz, and computed densities; on such a phone, "This phone (detected)" is exact.
// Sources:
//   https://www.apple.com/iphone/compare/
//   https://yesviz.com/iphones.php
//   https://www.cultofmac.com/news/iphone-sales-2025
//   https://en.wikipedia.org/wiki/Samsung_Galaxy_S25
//   https://yesviz.com/devices.php
//   https://en.wikipedia.org/wiki/Samsung_Galaxy_A56_5G
//   https://en.wikipedia.org/wiki/Samsung_Galaxy_A36_5G
//   https://en.wikipedia.org/wiki/Samsung_Galaxy_A16_5G
//   https://en.wikipedia.org/wiki/Samsung_Galaxy_A06
//   https://en.wikipedia.org/wiki/Pixel_10
//   https://en.wikipedia.org/wiki/Pixel_9
//   https://counterpointresearch.com/default.htm/insights/iphone-16-worlds-best-selling-smartphone-in-2025-apple-takes-7-spots-in-top-10-models
//   https://www.sammobile.com/news/galaxy-a56-worlds-top-selling-android-phone-q4-2025-galaxy-s25-made-list/
//   https://gs.statcounter.com/vendor-market-share/mobile
//   https://gs.statcounter.com/screen-resolution-stats/mobile/worldwide

export interface Phone {
  readonly brand: string;
  readonly model: string;
  /** Device pixels, portrait. */
  readonly width: number;
  readonly height: number;
  /** Device pixels per CSS pixel. */
  readonly dpr: number;
  /** Checked against the maker's page; false: approximate. */
  readonly confirmed: boolean;
}

export const PHONES: readonly Phone[] = [
  { brand: 'Apple', model: 'iPhone 17', width: 1206, height: 2622, dpr: 3, confirmed: true },
  { brand: 'Apple', model: 'iPhone Air', width: 1260, height: 2736, dpr: 3, confirmed: true },
  { brand: 'Apple', model: 'iPhone 17 Pro', width: 1206, height: 2622, dpr: 3, confirmed: true },
  { brand: 'Apple', model: 'iPhone 17 Pro Max', width: 1320, height: 2868, dpr: 3, confirmed: true },
  { brand: 'Apple', model: 'iPhone 16e', width: 1170, height: 2532, dpr: 3, confirmed: true },
  { brand: 'Apple', model: 'iPhone 16', width: 1179, height: 2556, dpr: 3, confirmed: true },
  { brand: 'Apple', model: 'iPhone 16 Plus', width: 1290, height: 2796, dpr: 3, confirmed: true },
  { brand: 'Apple', model: 'iPhone 16 Pro', width: 1206, height: 2622, dpr: 3, confirmed: true },
  { brand: 'Apple', model: 'iPhone 16 Pro Max', width: 1320, height: 2868, dpr: 3, confirmed: true },
  { brand: 'Apple', model: 'iPhone 15', width: 1179, height: 2556, dpr: 3, confirmed: true },
  { brand: 'Apple', model: 'iPhone 15 Pro', width: 1179, height: 2556, dpr: 3, confirmed: true },
  { brand: 'Apple', model: 'iPhone 15 Pro Max', width: 1290, height: 2796, dpr: 3, confirmed: true },
  { brand: 'Apple', model: 'iPhone 14', width: 1170, height: 2532, dpr: 3, confirmed: true },
  { brand: 'Apple', model: 'iPhone 13', width: 1170, height: 2532, dpr: 3, confirmed: true },
  { brand: 'Samsung', model: 'Galaxy S25 Ultra', width: 1080, height: 2340, dpr: 2.625, confirmed: false },
  { brand: 'Samsung', model: 'Galaxy S25+', width: 1080, height: 2340, dpr: 2.625, confirmed: false },
  { brand: 'Samsung', model: 'Galaxy S25', width: 1080, height: 2340, dpr: 3, confirmed: false },
  { brand: 'Samsung', model: 'Galaxy A56', width: 1080, height: 2340, dpr: 2.625, confirmed: false },
  { brand: 'Samsung', model: 'Galaxy A36', width: 1080, height: 2340, dpr: 2.625, confirmed: false },
  { brand: 'Samsung', model: 'Galaxy A16 5G', width: 1080, height: 2340, dpr: 2.625, confirmed: false },
  { brand: 'Samsung', model: 'Galaxy A06', width: 720, height: 1600, dpr: 2, confirmed: false },
  { brand: 'Samsung', model: 'Galaxy A07', width: 720, height: 1600, dpr: 2, confirmed: false },
  { brand: 'Samsung', model: 'Galaxy A15 5G', width: 1080, height: 2340, dpr: 2.625, confirmed: false },
  { brand: 'Google', model: 'Pixel 10', width: 1080, height: 2424, dpr: 2.625, confirmed: false },
  { brand: 'Google', model: 'Pixel 10 Pro', width: 1280, height: 2856, dpr: 3, confirmed: false },
  { brand: 'Google', model: 'Pixel 9', width: 1080, height: 2424, dpr: 2.625, confirmed: false },
  { brand: 'Google', model: 'Pixel 9a', width: 1080, height: 2424, dpr: 2.625, confirmed: false },
  { brand: 'Xiaomi', model: 'Redmi A5', width: 720, height: 1640, dpr: 2, confirmed: false },
  { brand: 'Xiaomi', model: 'Redmi Note 14 5G', width: 1080, height: 2400, dpr: 2.75, confirmed: false },
  { brand: 'Vivo', model: 'Y29 5G', width: 720, height: 1612, dpr: 1.875, confirmed: false },
  { brand: 'Oppo', model: 'A5', width: 720, height: 1604, dpr: 1.875, confirmed: false },
  { brand: 'Honor', model: 'X7c', width: 720, height: 1600, dpr: 2, confirmed: false },
];
