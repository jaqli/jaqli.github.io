# Publication previews

Verified on 2026-11-11 against the author-linked paper, official repository or project page. Images retain the original colors and labels, with WebP encoding for page delivery. The JPG for Hy-Nomas is the original project poster. All figures link to their original source. These are research illustrations by the linked authors; no illustration was generated.

| Local file | Original source | Use |
| --- | --- | --- |
| `gamecraft.webp` | https://raw.githubusercontent.com/Tencent-Hunyuan/Hunyuan-GameCraft-1.0/main/asset/teaser.png | Official teaser, scaled to 1100 px wide |
| `nomas.jpg` | https://hy-nomas.hy.tencent.com/gallery/promo-draft-v2-20261023.jpg | Official video poster, unchanged |
| `nvds.webp` | https://raymondwang987.github.io/NVDS/img/fig1_0717_2.png | Project overview, scaled to 1100 px wide |
| `ch3depth.webp` | https://openaccess.thecvf.com/content/CVPR2025/papers/Li_CH3Depth_Efficient_and_Flexible_Depth_Foundation_Model_with_Flow_Matching_CVPR_2025_paper.pdf | Figure 1, page 1, rendered from PDF region (57, 216, 555, 484) at 2× |
| `sddr.webp` | https://raw.githubusercontent.com/lijia7/SDDR/master/assets/neurips2024.png | Official teaser, scaled to 1100 px wide |
| `dadp.webp` | https://arxiv.org/pdf/2308.02283 | Figure 2, page 3, rendered from PDF region (53, 84, 295, 202) at 2× |

Local silent previews play automatically and loop only while visible. They are fetched on entering the viewport; hidden tabs and page transitions pause playback. The original full videos remain linked:

- GameCraft: https://hunyuan-gamecraft.github.io/assets/videos/teaser.mov
- Hy-Nomas: https://hy-nomas.hy.tencent.com/gallery/hy_nomas_promo.mp4
- NVDS supplementary video (external link): https://www.bilibili.com/video/BV1KW4y1d7F8/

Paper identities and authors are mapped to the retained Scholar snapshot in `content/site.json`. The CH3Depth paper explicitly marks Jiaqi Li and Yiran Wang as equal contributors. No publicly accessible CH3Depth code repository was verified; its paper and supplementary material are linked instead. No official DADP repository or dedicated project page was verified; only the paper, publisher and its method figure are shown.

## Local looping previews

- `gamecraft-loop.mp4`: official teaser, seconds 8–20; 480×278, 24 fps, 12 seconds, 221,622 bytes.
- `nomas-loop.mp4`: official promo, seconds 48–60; 480×270, 24 fps, 12 seconds, 176,280 bytes.

Both use H.264/yuv420p, CRF 35, `veryslow`, no audio, and `+faststart`. The 397,902-byte total is for excerpts, not a claim that the full 47 MB / 199 MB originals were compressed to that size. H.264 was smaller than the tested VP9/AV1 candidates at usable thumbnail quality and supports common mobile hardware decoders. Source colors and the 24 fps motion are retained. The original image teasers remain as static fallbacks.

Reproduction, using the linked source and corresponding start time:

```sh
ffmpeg -ss 8 -i gamecraft-source.mov -t 12 -vf 'fps=24,scale=480:-2:flags=lanczos' -an -c:v libx264 -preset veryslow -crf 35 -pix_fmt yuv420p -movflags +faststart gamecraft-loop.mp4
ffmpeg -ss 48 -i nomas-source.mp4 -t 12 -vf 'fps=24,scale=480:-2:flags=lanczos' -an -c:v libx264 -preset veryslow -crf 35 -pix_fmt yuv420p -movflags +faststart nomas-loop.mp4
```
