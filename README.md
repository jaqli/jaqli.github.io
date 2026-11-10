# LIJIA7 — A room by the sea

以海边工作室为入口的个人博客。原图 `assets/IMG_1183.PNG` 在浏览器中渲染为全屏动态彩色 ASCII。原生 HTML、CSS、JavaScript，无构建步骤或第三方运行时依赖，可直接发布至 GitHub Pages。

## 本地运行

```sh
cd /workspace/lijia7.github.io
python3 -m http.server 8081 --bind 0.0.0.0
```

通过 HTTP 的 8081 端口访问，JavaScript 使用 ES modules。

## 场景交互

- 中间三个电脑屏幕 → `/tech/`；主屏幕有 `TECH BLOG` 提示。
- 人物 → `/cv/`；悬停或键盘聚焦显示提示。
- 水面上方的大海鸥 → `/life/`；没有可见标签、悬停高亮或鼠标手形提示。键盘访问仍保留无障碍焦点。
- 场景采用等比例 cover 铺满视口。竖屏可左右滑动探索整个房间；点击区域始终使用原图坐标，与画面一起缩放、移动。
- 内部页面跳转有字符消散动画，子页有浮现动画；系统开启减少动态效果时停用这些动画。右下角可暂停场景，后台标签页停止绘制。

入口多边形与目标链接位于 `site.config.js`，原图尺寸为 1536 × 1024。首页无上传、拖入图片或密度调整功能。

## 内容映射

`content/site.json` 是网站使用的本地内容快照，由 `content.js` 排版为技术文章、生活随记、文章详情和 CV。网页无需 Notion 令牌，也不会在访客浏览器中请求 Notion 或 Scholar API。原文链接保留在各页面。

**当前状态：**已记录用户提供的 Notion 与 Google Scholar 来源链接，但云环境网络策略尚未允许读取这两个来源。因此 `syncedAt` 为 `null`、文章和论文列表为空。页面提供原始来源链接；尚未导入真实正文、个人姓名、机构、研究方向或论文。内容渲染测试使用独立测试数据，不会写入网站快照。这个版本不包含自动同步 Notion 的服务。

真实内容获准读取后，将核实后的记录加入快照：

- `notion.posts[]`：`id`（稳定的 Notion 页面 ID）、`category`（`tech` 或 `life`）、`title`、`date`、`summary`、`source`、`blocks`。
- `blocks[]`：`paragraph`、`heading`、`subheading`、`quote`、`code` 使用 `text`；`list` 使用 `items` 与可选 `ordered`；`link` 使用 `text` 和 `url`；`image` 使用 `url` 和 `alt`。
- 文章地址为 `/post/?id=<Notion 页面 ID>`，分类列表自动指向该地址，正文按本网站风格排版。文本不会作为 HTML 执行。
- `profile`：`name`、`affiliation`、`bio`、`interests[]`、`publications[]`、`source`、`syncedAt`。每篇论文含 `title`、`authors`、`venue`、`year`、`url`。仅在完成真实资料核对后填写 `syncedAt`。

也可使用 Notion 官方导出的 Markdown/HTML ZIP 和 Scholar 的公开资料导出作为离线导入来源，不需要网站读者登录 Notion。

## 验证

环境已安装 Playwright 和 Chromium，启动上述静态服务后执行：

```sh
node tests/smoke.cjs
```

可通过 `TEST_ORIGIN` 和 `CHROMIUM_PATH` 指定测试服务地址和浏览器路径。测试覆盖实际图像点位跳转、手机触摸平移和旋转、隐藏入口、键盘、减少动态效果、转场、历史返回以及内容映射。测试不访问外部来源。

## 发布

仓库 **Settings → Pages** 使用 **master / (root)**。`.nojekyll` 允许直接发布静态文件，目录中的 `index.html` 支持子页直达与刷新。推送代码与 Pages 构建完成是独立步骤。
