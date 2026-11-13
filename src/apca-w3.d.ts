// The package ships no types: only the two functions this tool calls.
declare module 'apca-w3' {
  export function sRGBtoY(rgb: readonly number[]): number;
  export function APCAcontrast(txtY: number, bgY: number, places?: number): number;
}
