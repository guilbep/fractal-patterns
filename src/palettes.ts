export interface Palette {
  readonly name: string;
  readonly colors: readonly string[];
}

export const PALETTE_SOURCE = 'https://hookagency.com/website-color-schemes';

// Palettes from https://hookagency.com/website-color-schemes (PALETTE_SOURCE).
export const PALETTES: readonly Palette[] = [
  { name: 'Soft Beach', colors: ['#51e2f5', '#9df9ef', '#edf756', '#ffa8b6', '#a28089'] },
  { name: "Purple 90's", colors: ['#a0d2eb', '#e5eaf5', '#d0bdf4', '#8458b3', '#a28089'] },
  { name: 'Bright Power', colors: ['#ff1d58', '#f75990', '#fff685', '#00ddff', '#0049b7'] },
  { name: 'Banking and Finance', colors: ['#fbe3e8', '#5cbdb9', '#ebf6f5'] },
  { name: 'Deep Blue and Tan', colors: ['#e1b382', '#c89666', '#2d545e', '#12343b'] },
  { name: "70's Inspired", colors: ['#101357', '#fea49f', '#fbaf08', '#00a0a0', '#007f4f'] },
  { name: 'Metallic Blue Purple Red', colors: ['#0f2862', '#9e363a', '#091f36', '#4f5f76'] },
  { name: 'Apricot Avalanche', colors: ['#6b7a8f', '#f7882f', '#f7c331', '#dcc7aa'] },
  { name: 'Strong Contrast and Trustworthy', colors: ['#1561ad', '#1c77ac', '#1dbab4', '#fc5226'] },
  { name: 'Subtle and Succulent', colors: ['#acb7ae', '#82716e', '#e4decd', '#c2b490'] },
  { name: 'Photographic Memory', colors: ['#3d7c47', '#09868b', '#76c1d4', '#f7f7f7'] },
  { name: 'Intellectual Nonchalance', colors: ['#6ed3cf', '#9068be', '#e1e8f0', '#e62739'] },
  { name: 'Extra Snug', colors: ['#3a4660', '#c9af98', '#ed8a63', '#845007'] },
  { name: 'Dark Horse', colors: ['#feda6a', '#d4d4dc', '#393f4d', '#1d1e22'] },
  { name: 'Sleepy Green Streaks', colors: ['#7dce94', '#3d3d3f', '#f6f5f3', '#f9f8fd'] },
  { name: 'Precious Metals', colors: ['#bd8c7d', '#d1bfa7', '#8e8e90', '#49494b'] },
  { name: 'European Bodies', colors: ['#fbf579', '#005995', '#fa625f', '#600473'] },
  { name: 'Simple Brilliant Accents', colors: ['#cd5554', '#91684a', '#00c07f', '#313d4b'] },
  { name: 'Playful Restraint', colors: ['#4abdac', '#fc4a1a', '#f7b733', '#dfdce3'] },
  { name: 'Trust Blue and Green', colors: ['#368cbf', '#7ebc59', '#33363b', '#eaeaea'] },
  { name: 'Stark Contrast', colors: ['#262626', '#3f3f3f', '#f5f5f5', '#dcdcdc'] },
  { name: 'Goldifox', colors: ['#a39274', '#dfd8c8', '#252523'] },
  { name: 'Minty Refreshed', colors: ['#4cb69f', '#f5f5f5', '#201d3a'] },
  { name: 'Sleek Modern', colors: ['#111c30', '#9a4d55', '#80756b'] },
  { name: 'Subdued Modern', colors: ['#b5e9e9', '#fef6dd', '#ffe1d0', '#fff1b5', '#dcf3d0'] },
  { name: 'Fresh Modern', colors: ['#1d1145', '#0db4b9', '#f2a1a1', '#e76d89'] },
  { name: 'Earthy Modern', colors: ['#de493c', '#608074', '#daefd9'] },
  { name: 'Rusted Modern', colors: ['#c1432e', '#4b6777', '#ce9e62', '#2c2c2c'] },
  { name: 'Electric Blue', colors: ['#373e98', '#f16775', '#fee36e', '#ceb92c', '#2a2a2a'] },
  { name: 'Sorbet', colors: ['#f4d8ae', '#dc7027', '#b6c48e', '#ea8a81', '#301008'] },
  { name: 'Orchid', colors: ['#4cbfa6', '#f6ebf4', '#482673', '#ed0b70', '#301008'] },
  { name: 'Infrared and Purple', colors: ['#de354c', '#932432', '#3c1874', '#283747', '#f3f3f3'] },
  { name: 'Classic Double Blue', colors: ['#12232e', '#007cc7', '#4da8da', '#203647', '#eefbfb'] },
  { name: 'Greenery and Gradients', colors: ['#164a41', '#4d774e', '#9dc88d', '#f1b24a', '#ffffff'] },
  { name: 'Greenery and Pearl', colors: ['#a3bcb6', '#39603d', '#3c403d', '#daded4', '#ffffff'] },
];
