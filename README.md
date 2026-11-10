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

首屏优先显示 `assets/scene-preview.webp` 中预先渲染的 ASCII，下载 `assets/scene.webp` 后分段初始化动画，保持入口可点击。进度条跟随真实下载字节数、物体准备和字符绘制进度；没有长度头时，下载阶段显示不定进度。原始 PNG 不参与首页下载。静态字符同样复用图集，云纹理生成复用数组，同尺寸重复布局不会重新生成缓存。修改渲染样式或原图后，在静态服务运行时执行 `node tools/prepare-scene.cjs` 更新这两个资源（需要 ffmpeg、Playwright 和 Chromium）。

五只海鸥沿各自的闭合曲线在窗外飞行，穿插短促扇翼、滑翔和转弯。大海鸥的中心覆盖约 286 × 179 个原图像素。`flight-layer.js` 使用五块小型透明字符画布，让飞行、转向和扇翼随屏幕刷新独立更新，不必等待整幅场景渲染；位移只更新合成变换，翅膀变化时才重绘字符。Life 隐藏入口跟随小黄鸭的浮动位置，以已显示的场景帧为准。原位置补回天空，飞行时遮挡身后的天空字符，避免残影与文字叠加。其余约 1.8% 的字符独立轻微缩放，不使用全屏条纹。动画默认通过 `scene-worker.js` 在独立线程计算，由 `scene-renderer.js` 提交完整画面；主线程处理悬停、点击与滚动。每次只允许一帧在途，暂停会丢弃迟到画面；不支持 Worker 时自动使用 Canvas2D 回退。云层使用固定字形遮罩合成，漂浮物复用整块字符纹理，屏幕文字与表情缓存复用。动画使用实际经过时间；暂停或系统要求减少动态效果时，右下角显示「播放动效」。

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
```

测试比较墙面、人物躯干、手臂、水面与三块屏幕，检查人物保持固定、屏幕独立更新、水面不出现黑缝，以及海鸥飞行范围、小黄鸭的移动入口与转场。还验证低帧率不会拖慢场景时间。

可通过 `TEST_ORIGIN` 和 `CHROMIUM_PATH` 指定测试服务地址和浏览器路径。测试覆盖实际图像点位跳转、手机触摸平移和旋转、隐藏入口、键盘、减少动态效果、转场、历史返回以及内容映射。测试不访问外部来源。响应测试会故意阻塞动画线程，验证海鸥仍持续移动和扇翼、Tech Blog 的悬停仍立即生效、渲染请求不积压、暂停丢弃迟到帧，并验证 Worker 启动失败的回退。

## 发布

仓库 **Settings → Pages** 使用 **master / (root)**。`.nojekyll` 允许直接发布静态文件，目录中的 `index.html` 支持子页直达与刷新。推送代码与 Pages 构建完成是独立步骤。
