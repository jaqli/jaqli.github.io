export const site = {
  image: './assets/scene.webp?v=20261111-clarity46', width: 1536, height: 1024,
  // Coordinates refer to the original image, never the viewport.
  hotspots: [
    { id: 'tech', href: './tech/', label: '技术博客', hint: 'TECH BLOG ↗', hintAt: [497, 338], points: '423,347 608,367 600,493 422,478' },
    { id: 'tech-left', href: './tech/', label: '技术博客：左侧屏幕', points: '325,390 449,397 451,493 328,488' },
    { id: 'tech-right', href: './tech/', label: '技术博客：右侧屏幕', points: '628,419 737,434 730,510 628,502' },
    { id: 'cv', href: './cv/', label: '个人 CV', hint: 'ABOUT ME ↗', hintAt: [801, 439], points: '727,450 772,447 798,474 857,475 888,526 865,618 809,611 768,562 691,555 651,541 667,519 710,497' },
    // Floating yellow duck: no visual label, hover effect, or pointer cue.
    { id: 'life', href: './life/', label: '生活', secret: true, points: '294,834 305,829 306,807 314,790 326,785 343,787 352,797 353,814 377,809 392,814 401,823 404,835 417,839 419,853 402,863 370,873 333,871 308,861 288,855 290,842' },
  ],
};
