import { Color } from './solver';

export interface ColorInfo {
  code: Color;
  name: string;
  color: string;
}

export const COLOR_MAP: ColorInfo[] = [
  { code: "Re", name: "Red", color: "#ff4444" },
  { code: "Or", name: "Orange", color: "#ff8800" },
  { code: "Ye", name: "Yellow", color: "#ffdd00" },
  { code: "LG", name: "Light Green", color: "#88ff88" },
  { code: "BG", name: "Bright Green", color: "#44ff44" },
  { code: "DG", name: "Dark Green", color: "#228822" },
  { code: "Cy", name: "Cyan", color: "#44ffff" },
  { code: "LB", name: "Light Blue", color: "#88ccff" },
  { code: "DB", name: "Dark Blue", color: "#4488ff" },
  { code: "Pu", name: "Purple", color: "#8844ff" },
  { code: "Ma", name: "Magenta", color: "#ff44ff" },
  { code: "Pi", name: "Pink", color: "#ffaadd" },
  { code: "Wh", name: "White", color: "#ffffff" },
  { code: "Gr", name: "Grey", color: "#888888" },
  { code: "Bl", name: "Black", color: "#222222" },
];

export function getColorInfo(code: Color): ColorInfo {
  return COLOR_MAP.find(c => c.code === code)!;
}