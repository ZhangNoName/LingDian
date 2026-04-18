/**
 * 根据主色生成 10 阶色板，便于在 Web、uni-app、后台组件库里统一衍生色。
 */
function generateColorScales(
  baseColor: string,
  options?: {
    lightStep?: number
    darkStep?: number
    count?: number
  }
): string[] {
  function hexToRgb(hex: string): { r: number, g: number, b: number } {
    let h = hex.replace(/^#/, '');
    if (h.length === 3) h = h.split('').map(s => s + s).join('');
    const num = parseInt(h, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
    };
  }

  function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        default:
          h = (r - g) / d + 4;
          break;
      }
      h /= 6;
    }

    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
  }

  function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    s /= 100;
    l /= 100;
    h = h % 360;
    if (h < 0) h += 360;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r = 0;
    let g = 0;
    let b = 0;

    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];

    return [
      Math.round((r + m) * 255),
      Math.round((g + m) * 255),
      Math.round((b + m) * 255),
    ];
  }

  function rgbToHex(r: number, g: number, b: number): string {
    return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
  }

  const lightStep = options?.lightStep ?? 0.07;
  const darkStep = options?.darkStep ?? 0.1;
  const count = options?.count ?? 10;
  const rgb = hexToRgb(baseColor);
  const [h, s, l] = rgbToHsl(rgb.r, rgb.g, rgb.b);

  const colors: string[] = [];
  for (let i = 0; i < count; i += 1) {
    if (i < 5) {
      const delta = lightStep * (5 - i);
      colors[i] = rgbToHex(...hslToRgb(h, s, Math.min(100, l + delta * 100)));
    } else if (i === 5) {
      colors[i] = baseColor;
    } else {
      const delta = darkStep * (i - 5);
      colors[i] = rgbToHex(...hslToRgb(h, s, Math.max(0, l - delta * 100)));
    }
  }

  return colors;
}

export function getThemeColorScales() {
  return {
    primary: generateColorScales('#1677ff'),
    success: generateColorScales('#52c41a'),
    warning: generateColorScales('#faad14'),
    error: generateColorScales('#ff4d4f'),
    info: generateColorScales('#4096ff'),
  };
}
