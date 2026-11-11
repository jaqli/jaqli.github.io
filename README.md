# jaq/li

以海边工作室为入口的个人博客。原图 `assets/IMG_1183.PNG` 的 WebP 副本呈现为全屏动态像素场景，电脑屏幕、加载和转场保留 ASCII。标识及标签页统一使用 `jaq/li`。原生 HTML、CSS、JavaScript，无构建步骤或第三方运行时依赖，可直接发布至 GitHub Pages。

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
- 场景采用等比例 cover 铺满视口，上端裁切量为下端的一半（上 : 下 = 1 : 2）；字符加载预览、静态回退与正式场景保持一致。竖屏可左右滑动探索整个房间；点击区域始终使用原图坐标，与画面一起缩放、移动。
- 内部页面双向跳转采用字符打散/重组与镜头缩放：进入子页拉近，返回首页缩远；系统开启减少动态效果时停用这些动画。右下角可暂停场景，后台标签页停止绘制。

入口多边形与目标链接位于 `site.config.js`，原图尺寸为 1536 × 1024。首页无上传、拖入图片或密度调整功能。

渲染由 `pixel-scene.js` 完成。房间、人物、城市、水面和天空保留原图颜色与像素轮廓，画面不再全局换字或变化字号。显示画布固定为原图的 1536×1024，CSS 等比例铺满并使用最近邻放大，避免大屏增加渲染缓存；三块屏幕从字形到最终合成都保留 3 倍分辨率，使用覆盖屏幕区域的独立画布（1260×570），避免回落到房间的原图像素；主屏字号 5.6、左屏 6.2、右屏 5.8 源图像素，保留透视。主循环目标 60 Hz，云层纹理 30 Hz，显示屏 24 Hz，动作使用真实时间。暂停、后台标签页与页面切换会停止调度。

`scene-objects.js` 保存海鸥航线、轮廓、水面区域与头发遮挡，供像素场景和保留的旧 ASCII 渲染器共同使用。五只海鸥沿原来的独立曲线飞行并扇翼；浮鸭、船、纸张、罐子等按 `scene-details.js` 和 `scene-floats.js` 的原有周期漂浮。纸张从固定端摆动、衣角轻动、机器人眨眼与换表情、机械云彩色呼吸灯均保留；顶部吊灯每 3.5 秒短暂暗闪一次（约 0.26 秒），仅作用于暖色灯面，随全局暂停和减少动态设置停用；人物躯干和城市保持静止。物体裁片只在初始化提取；完整轮廓包含平板右侧边框、纸张卷边、罐口、手机外壳和玩具车轮。漂浮物下方只从周围水色像素补齐，排除物体高光和深色外壳，避免把边框复制回背景；外围背景使用 8 px 的渐变衔接，实际物体边缘仍保持完全不透明。纸张以固定端为轴整张变形，不使用水平分条。漂浮物及纸张只在运动变换时使用局部亚像素采样，避免小角度旋转逐列跳到相邻像素行、形成扫过物体的竖线；场景底图仍按原尺寸和最近邻方式显示，无全屏模糊或额外高分辨率画布。海鸥原位置使用邻近天空色修复。云层是不透明的单一天空表面，替换原位置而非叠加副本；在同一源图内做连续的有限范围漂移，遇到窗框、电线、植物、太阳和城市时平滑收敛，保留前景。像素采样映射和边界距离仅在初始化计算；动画不读取画布或逐帧分配图像缓存。

`scene-extras.js` 补充十处独立动作：杯口三缕像素蒸汽、小风扇转动、黄色吊牌摆动、窗台植物三组叶片、绿色机器人眨眼与四种表情、右下圆机器人眼睛转动与眨眼、左机架异步活动灯、右机架间歇追逐灯、前景线缆中段浮动、窗前七颗微尘。风扇复用原图纹理，网罩、轮毂与底座固定；植物各叶片错相，花盆固定；吊牌在挂点转动，线缆连接端不动。线缆只对小裁片做连续反向采样和预乘透明度插值，避免分条、竖向扫描与暗边。缓存仅在准备阶段提取，逐帧不读取画布、不下载新图、不开独立计时器，随场景统一暂停。

ASCII 仅用于三块电脑屏幕中的代码、波形、频谱与状态信息，以及开场字符生成、页面切换的字符打散/重组。`screen-content.js` 与 `scene-geometry.js` 保留显示器的四角透视；独立的头发与运动纸张遮罩保证高清屏幕位于前景后方，像素边框保留；暂停、旋转、滑动和转场同步两个画布。水面采用低分辨率像素高光、椭圆涟漪与小反光，限制在实际水面区域，并由漂浮物覆盖。

首屏由独立的 `scene-intro.js` 读取约 9 KiB 的 `assets/scene-seed.webp`，用实际字符逐步形成轮廓。真实下载与物体准备进度驱动生成目标；每次最多新增 280 字、刷新最近 180 字。完整场景就绪后释放临时画布和数组，不强制等待开场动画。正常访问只下载色彩图和约 366 KiB 的 `scene.webp`；不加载原始 PNG、ASCII 预览、色彩底光、字形图集或旧 Worker 模块。加载失败或禁用 JavaScript 时显示静态像素图，入口仍可访问。

旧 `ascii-renderer.js`、Worker 与图集代码暂保留为历史参考及旧画面导出工具，首页不加载它们。`tools/prepare-scene.cjs` 仍可更新原图 WebP 和加载色彩图；其中 ASCII 预览/底光输出不参与当前首页。

## 内容映射

`content/site.json` 是网站使用的本地内容快照，由 `content.js` 排版为技术文章、生活随记和文章详情，About Me 由按需加载的 `profile.js` 排版，地址保持 `/cv/`。网页无需 Notion 令牌，也不会在访客浏览器中请求 Notion 或 Scholar API。原文链接保留在各页面。

当前快照收录 11 篇已发布文章（技术 2 篇、生活 9 篇）、111 张本地配图，以及 Scholar 的 18 条论文记录。

About Me 综合 [Notion About](https://familiar-koi-5e4.notion.site/About-fb5deb79d61040ebad5edaf10e8b7c6e?pvs=74)、Scholar 与作者确认的最新工作信息。介绍围绕视觉生成、世界模型和 3D 视觉，工作经历为腾讯混元视觉生成团队 Senior Research Scientist，放在论文之前，不推断入职日期。页面只展示 Hy-Nomas、GameCraft 2、GameCraft、CH3Depth、SDDR、DADP、NVDS 七个项目，按首次发表时间从新到旧排列（同年也按时间排序）；荣誉仅保留国家奖学金、HUST 荣誉学士两条简短信息，移除教育、竞赛、微信/QQ 及对应图片。Contact 章节和论文末尾的 Scholar 按钮已删除，顶部保留 Scholar、GitHub、邮箱。完整 Scholar 记录仅保存在快照中，不再在网页展开。

每项论文提供已核对的论文、GitHub、项目页或视频链接，详情见 [素材来源](assets/publications/SOURCES.md)。七张预览图合计约 488 KiB，延迟加载；GameCraft 与 Hy-Nomas 使用各 12 秒的本地静音循环预览，GameCraft 2 使用约 5.3 秒的完整官方演示；三段视频总计 450,731 字节（约 440 KiB），480 px 宽、24 fps，H.264 高压缩编码并启用 faststart。视频进入视口才加载并自动循环，离屏、后台和页面转场期间暂停，手动暂停状态会保留；减少动态效果时保持静态，可手动播放。完整官方视频由预览下方的 Full video / Demo video 链接打开。CH3Depth 和 DADP 方法图从公开论文的对应 Figure 渲染，保留原有颜色和文字。未核实到可公开访问的 CH3Depth 代码库以及 DADP 官方代码库/独立项目页，因此只保留对应论文、图示和已公开材料。

头像使用 Google Scholar 的 256×241 原始 JPEG，本地保存为 `assets/profile/jiaqi-li.jpg`（14,748 字节）；不裁切、不套颜色滤镜，照片下方没有姓名或标签。邮箱经作者确认统一为 `lijiaqi.work@outlook.com`。原 PDF 地址 `https://lijia7.github.io/lijiaqi_cv.pdf` 返回 404，不展示失效下载入口。

**来源访问：**发布后的新环境已验证可访问博客、Notion 公开站点与 Google Scholar。Notion 数据源使用公开站点，筛选 `Post`、`Published` 且未加锁的记录；忽略隐藏记录及菜单项。Scholar 资料用于公开姓名、机构、研究方向、论文及头像；荣誉采用用户指定的 Notion About；当前职位采用作者明确提供的信息，不推断未列出的履历。

内容快照格式：

- `notion.posts[]`：`id`（稳定的 Notion 页面 ID）、`category`（`tech` 或 `life`）、`title`、`date`、`summary`、`source`、`blocks`。
- `blocks[]`：`paragraph`、`heading`、`subheading`、`quote`、`code` 使用 `text`；`list` 使用 `items` 与可选 `ordered`；`link` 使用 `text` 和 `url`；`image` 使用 `url` 和 `alt`。
- 文章地址为 `/post/?id=<Notion 页面 ID>`，分类列表自动指向该地址，正文按本网站风格排版。文本不会作为 HTML 执行。`runs` 可保存段内链接；图片会保存到 `assets/notion/` 并通过相对路径读取，避免临时链接过期。
- `profile`：`name`、`affiliation`、`bio`、`interests[]`、`publications[]`、`source`、`syncedAt`。每篇论文含 `title`、`authors`、`venue`、`year`、`url`。仅在完成真实资料核对后填写 `syncedAt`。
- `profile.avatar`：本地 `url`、原图 `source`、`alt`、尺寸；`profile.about`：Notion `source`、独立 `syncedAt`、`experience[]`、`research[]`、`selectedPublications[]`、`awards[]`、`contacts`。Notion 来源项保留 `sourceBlockId`，代表论文用 `scholarURL` 对应完整论文快照，并包含 `links[]` 与本地 `media`（尺寸、来源、可选官方视频地址）。`profile.css` 仅由 About Me 加载，保留全站暗色背景与字符风格的章节编号。

这是可审阅的本地内容快照，不是自动同步服务。当前按来源页面 ID 保持映射；`LIFE` 与年度生活文章进入生活页，技术学习及 AI 相关笔记进入技术页。原文链接与原始分类保留在记录中。可使用公开来源或 Notion 官方导出的 Markdown/HTML ZIP 更新快照，不需要网站读者登录 Notion。

## 页面切换

`navigation-boot.js` 在目标页首帧前读取一次短期转场标记，失败会自动恢复可见；`navigation.js` 管理离场 560 ms、入场 640 ms 的双向切换。`page-particles.js` 从当前可见文本或首页颜色采样生成最多 1,400 个 ASCII 粒子，按各自方向散开并在目标页聚合。摄像机用浏览器合成变换缩放并平移真实页面，不截图重建文字。首页进入子页时推近到 1.95 倍，并朝入口平移；返回首页从 1.95 倍缩远，子页离场缩至 0.58 倍并移位。镜头明显移动期间保留页面可见度，字符粒子使用相同的缩放/位移。加载动画不等待完整场景准备。首屏布局采用未变换的 clientWidth/clientHeight，避免转场缩放改变画面尺寸。

每次动画结束立即销毁粒子与画布，退出/历史返回清理过渡状态，提供计时器兜底；同页锚点、外链、下载、修饰键和系统减少动态效果保留原生行为。同一 pathname 的不同文章 query 也支持转场。只预取目标 HTML，不预取视频或整套场景资源；首页动效在转场期间暂停计算，完成后恢复。

## 验证

环境已安装 Playwright 和 Chromium，启动上述静态服务后执行：

```sh
node tests/pixel-scene.cjs
node tests/scene-extras.cjs
node tests/loading.cjs
node tests/navigation.cjs
node tests/profile-media.cjs
```

像素场景测试覆盖原图色彩保真、人物/城市固定、完整物体边缘与无残影底图、连续帧采样、高清屏幕遮挡、局部物体与屏幕动画、暂停、减少动态效果、手机平移旋转、上下 1 : 2 裁切、云层完全覆盖原始天空、三个内容入口和无运行时错误；新增细节测试覆盖十处动作、固定支点与外壳、线缆连续帧、缓存面积和禁止逐帧像素回读；加载测试覆盖慢网、初始化旋转、字符预览的裁切比例与资源释放。旧的 glyph/GPU/layers/smoke/performance 测试针对历史全屏 ASCII 实现，保留供该渲染器单独维护，不作为当前首页验收。

## 发布

仓库 **Settings → Pages** 使用 **master / (root)**。`.nojekyll` 允许直接发布静态文件，目录中的 `index.html` 支持子页直达与刷新。推送代码与 Pages 构建完成是独立步骤。
