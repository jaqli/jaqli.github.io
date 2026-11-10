# jaq/li

以海边工作室为入口的个人博客。原图 `assets/IMG_1183.PNG` 的 WebP 副本在浏览器中渲染为全屏动态彩色 ASCII。标识及标签页统一使用 `jaq/li`。原生 HTML、CSS、JavaScript，无构建步骤或第三方运行时依赖，可直接发布至 GitHub Pages。

## 本地运行

```sh
cd /workspace/lijia7.github.io
python3 -m http.server 8081 --bind 0.0.0.0
```

通过 HTTP 的 8081 端口访问，JavaScript 使用 ES modules。

## 场景交互

- 中间三个电脑屏幕 → `/tech/`；主屏幕有 `TECH BLOG` 提示。
- 人物 → `/cv/`；`ABOUT ME` 提示常驻，与 `TECH BLOG` 一致。
- 水面上的小黄鸭 → `/life/`；没有可见标签、悬停高亮或鼠标手形提示。键盘访问仍保留无障碍焦点。
- 场景采用等比例 cover 铺满视口。竖屏可左右滑动探索整个房间；点击区域始终使用原图坐标，与画面一起缩放、移动。
- 内部页面跳转有字符消散动画，子页有浮现动画；系统开启减少动态效果时停用这些动画。右下角可暂停场景，后台标签页停止绘制。

入口多边形与目标链接位于 `site.config.js`，原图尺寸为 1536 × 1024。首页无上传、拖入图片或密度调整功能。

渲染由 `ascii-renderer.js` 完成。全景共用约 3.5 px 间距的字符网格（1536 px 宽时为 439 列），字号使用 0.35–0.8 倍共十档，间隔 0.05；主要集中在中间档位，每格均保留字符。屏幕与动态物体使用相同的基准字号和范围，通过 ASCII 文本、双通道波形、频谱和状态侧栏保留细节，边缘渐变接回原图反光与边框。水面使用完整的字符底层，移动反光与局部涟漪不会留下黑缝；人物躯干和手臂保持固定。

首屏优先显示 `assets/scene-preview.webp` 中预先渲染的 ASCII，下载 `assets/scene.webp` 的同时预载 Worker 模块，随后分段初始化动画，保持入口可点击。进度条跟随真实下载字节数、物体准备和字符绘制进度；没有长度头时，下载阶段显示不定进度。原始 PNG 不参与首页下载。静态字符同样复用图集，云纹理生成复用数组，同尺寸重复布局不会重新生成缓存。修改渲染样式或原图后，在静态服务运行时执行 `node tools/prepare-scene.cjs` 更新这两个资源（需要 ffmpeg、Playwright 和 Chromium）。

五只海鸥沿各自的闭合曲线飞行，穿插扇翼、滑翔和转弯。`flight-layer.js` 维护小型透明字符画布，`scene-layers.js` 让十一组漂浮物复用纹理、通过合成变换移动；Life 隐藏入口与小黄鸭使用同一时钟更新。其余约 1.8% 的字符独立轻微缩放，不使用全屏条纹。

`layered-scene.js` 在 Worker 中分别更新水面、云层、纸张、眼睛、三块屏幕和灯光。固定背景只画一次，环境字符变化时只恢复小块底图；浏览器直接合成这些局部画布，每帧无需复制或传递整幅房间。显示屏用 CSS 四角透视，头发轮廓单独覆盖，转场通过 `scene-snapshot.js` 合成所有层。水面字符位置固定，Worker 每秒采样 12 次亮度，三个有上限的局部缓冲提前准备相邻时刻；主线程按显示节奏做加法混合，使涟漪连续变化，避免每帧重绘和上传整片水面。海鸥、漂浮物与水波混合目标 60 Hz；波形与纸张由局部绘制更新，慢速云纹理和灯光按 30 Hz 更新。实际帧率取决于设备，全部动作保持真实时间速度。

`render-budget.js` 将高 DPI 栅格比例限制在 1.5、完整场景缓冲面积限制在约 240 万像素，字符网格与 0.35–0.8 字号范围保持不变。移动字形图集按字形和颜色去重；烘焙后释放静态调色图集和源画布；灯光图集最多 2048 格，屏幕文字纹理最多 2 MiB / 384 项，缩放后释放旧显示缓冲。水面缓冲始终只有三个，传递后立即关闭 ImageBitmap。最多一个 Worker 请求在途，隐藏标签页和暂停时停止调度。缺少 Worker/OffscreenCanvas 或启动失败时回退到 Canvas2D；系统要求减少动态效果时默认暂停。

`scene-details.js` 定义机器人眨眼、黄鸭与泳圈的浮动、九张纸的固定点与风动、吊盆叶尖和云层区域。`scene-lights.js` 控制机械云变色呼吸灯、红眼目光以及两侧机器人的四种表情，`screen-content.js` 绘制三块屏幕。云层在窗框后漂移；太阳、城市与室内结构保持稳定。`glyph-atlas.js` 缓存全景与灯光的彩色字符。[逐项动作设计与边界](docs/scene-motion.md)记录了受力方式、固定点和遮挡处理。

城市、人物与周围场景共用同一网格、字形和颜色规则，不叠加局部细网格。边缘取色避免跨物体混色，天空使用稳定的小字；发丝按原图遮挡屏幕，保留发丝之间的背景空隙。`scene-geometry.js` 统一显示屏与左下机器人面板的四角透视。右侧显示区域扩到内侧 1–2 圈白色字符，人物头发仍遮挡显示器。`scene-floats.js` 为船、罐子、纸张、平板、手机与玩具车配置独立的浮动周期和相位；加上黄鸭，共十一组漂浮物。

## 内容映射

`content/site.json` 是网站使用的本地内容快照，由 `content.js` 排版为技术文章、生活随记、文章详情和 CV。网页无需 Notion 令牌，也不会在访客浏览器中请求 Notion 或 Scholar API。原文链接保留在各页面。

当前快照收录 11 篇已发布文章（技术 2 篇、生活 9 篇）、111 张本地配图，以及 Scholar 的 18 条论文记录。

**来源访问：**发布后的新环境已验证可访问博客、Notion 公开站点与 Google Scholar。Notion 数据源使用公开站点，筛选 `Post`、`Published` 且未加锁的记录；忽略隐藏记录及菜单项。Scholar 资料仅使用公开姓名、机构、研究方向和论文，不推断未列出的履历。

内容快照格式：

- `notion.posts[]`：`id`（稳定的 Notion 页面 ID）、`category`（`tech` 或 `life`）、`title`、`date`、`summary`、`source`、`blocks`。
- `blocks[]`：`paragraph`、`heading`、`subheading`、`quote`、`code` 使用 `text`；`list` 使用 `items` 与可选 `ordered`；`link` 使用 `text` 和 `url`；`image` 使用 `url` 和 `alt`。
- 文章地址为 `/post/?id=<Notion 页面 ID>`，分类列表自动指向该地址，正文按本网站风格排版。文本不会作为 HTML 执行。`runs` 可保存段内链接；图片会保存到 `assets/notion/` 并通过相对路径读取，避免临时链接过期。
- `profile`：`name`、`affiliation`、`bio`、`interests[]`、`publications[]`、`source`、`syncedAt`。每篇论文含 `title`、`authors`、`venue`、`year`、`url`。仅在完成真实资料核对后填写 `syncedAt`。

这是可审阅的本地内容快照，不是自动同步服务。当前按来源页面 ID 保持映射；`LIFE` 与年度生活文章进入生活页，技术学习及 AI 相关笔记进入技术页。原文链接与原始分类保留在记录中。可使用公开来源或 Notion 官方导出的 Markdown/HTML ZIP 更新快照，不需要网站读者登录 Notion。

## 验证

环境已安装 Playwright 和 Chromium，启动上述静态服务后执行：

```sh
node tests/smoke.cjs
node tests/loading.cjs
node tests/responsiveness.cjs
node tests/layers.cjs
# 单独运行，避免其他浏览器测试影响计时
node tests/performance.cjs
```

测试比较墙面、人物躯干、手臂、水面与三块屏幕，检查人物保持固定、屏幕独立更新、水面不出现黑缝，以及海鸥飞行范围、小黄鸭的移动入口与转场。还验证低帧率不会拖慢场景时间。

可通过 `TEST_ORIGIN` 和 `CHROMIUM_PATH` 指定测试服务地址和浏览器路径。测试覆盖实际图像点位跳转、手机触摸平移和旋转、隐藏入口、键盘、减少动态效果、转场、历史返回以及内容映射。测试不访问外部来源。响应测试会故意阻塞动画线程，验证海鸥仍持续移动和扇翼、Tech Blog 的悬停仍立即生效、渲染请求不积压、暂停丢弃迟到帧，并验证 Worker 启动失败、画布转移后的失败恢复。分层画面的实际浏览器截图与参考画面在静止和运动时对比，覆盖水面、头发、屏幕、云、浮鸭和纸张；长时间颜色变化验证灯光缓存上限。性能脚本报告桌面/手机尺寸下的 Worker 帧率、水波插值帧率、帧间隔和绘图缓冲估算，支持 `PERF_OUTPUT` 保存 JSON。

## 发布

仓库 **Settings → Pages** 使用 **master / (root)**。`.nojekyll` 允许直接发布静态文件，目录中的 `index.html` 支持子页直达与刷新。推送代码与 Pages 构建完成是独立步骤。
