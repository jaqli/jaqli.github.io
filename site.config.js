export const site = {
  image: './assets/IMG_1183.PNG', width: 1536, height: 1024,
  // Coordinates refer to the original image, never the viewport.
  hotspots: [
    { id: 'tech', href: './tech/', label: '技术博客', hint: 'TECH BLOG ↗', hintAt: [497, 338], points: '423,347 608,367 600,493 422,478' },
    { id: 'tech-left', href: './tech/', label: '技术博客：左侧屏幕', points: '325,390 449,397 451,493 328,488' },
    { id: 'tech-right', href: './tech/', label: '技术博客：右侧屏幕', points: '628,419 737,434 730,510 628,502' },
    { id: 'cv', href: './cv/', label: '个人 CV', hint: 'ABOUT ME ↗', hintAt: [801, 439], reveal: 'hover', points: '727,450 772,447 798,474 857,475 888,526 865,618 809,611 768,562 691,555 651,541 667,519 710,497' },
    // Large gull above the water: no visual label, hover effect, or pointer cue.
    { id: 'life', href: './life/', label: '生活', secret: true, points: '939,223 962,235 980,250 1016,237 1041,241 1014,254 1001,270 1017,275 1008,283 982,275 974,260 958,250 944,233' },
  ],
};
