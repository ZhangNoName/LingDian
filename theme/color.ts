/**
 * 根据主色生成色板（10阶梯），类似于 antd 的色板
 * @param baseColor 基础色（主色），如 #aa3bff
 * @param options 可选参数：明度/色调/饱和度调整幅度
 * @returns 10 阶梯色值数组
 */
function generateColorScales(
  baseColor: string,
  options?: {
    lightStep?: number // 变浅步进，0~1，默认0.07
    darkStep?: number  // 变深步进，0~1，默认0.10
    count?: number     // 颜色阶数，默认10
  }
): string[] {
  // 需要 hsl 计算，可选用简易实现，无依赖
  function hexToRgb(hex: string): { r: number, g: number, b: number } {
    let h = hex.replace(/^#/, '');
    if (h.length === 3) h = h.split('').map(s => s + s).join('');
    const num = parseInt(h, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    }
  }
  function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
  }
  function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    s /= 100; l /= 100;
    h = h % 360; if (h < 0) h += 360;
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else[r, g, b] = [c, 0, x];
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  }
  function rgbToHex(r: number, g: number, b: number): string {
    return "#" + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  }
  // 默认参数
  const lightStep = options?.lightStep ?? 0.07;
  const darkStep = options?.darkStep ?? 0.10;
  const count = options?.count ?? 10;
  const rgb = hexToRgb(baseColor);
  let [h, s, l] = rgbToHsl(rgb.r, rgb.g, rgb.b);

  const colors: string[] = [];
  for (let i = 0; i < count; i++) {
    // 顺序与 antd 风格类似，5~6较基准色，前亮后暗
    let delta: number;
    if (i < 5) {
      delta = lightStep * (5 - i); // 变浅，最多4档
      colors[i] = rgbToHex(...hslToRgb(h, s, Math.min(100, l + delta * 100)));
    } else if (i === 5) {
      colors[i] = baseColor;
    } else {
      delta = darkStep * (i - 5); // 变深
      colors[i] = rgbToHex(...hslToRgb(h, s, Math.max(0, l - delta * 100)));
    }
  }
  return colors;
}

/**
 * 返回标准主色/成功/警告/危险/信息色板（浅~深，10阶）
 * 可用于 theme/colors.css 同步配色
 */
export function getThemeColorScales() {
  return {
    primary: generateColorScales('#aa3bff'),
    success: generateColorScales('#22c55e'),
    warning: generateColorScales('#f59e0b'),
    error: generateColorScales('#ef4444'),
    info: generateColorScales('#06aed4')
  }
}