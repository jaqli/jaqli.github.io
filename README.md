# LIJIA7 — In characters.

以动态彩色 ASCII 字符画为主视觉的个人主页。使用原生 HTML、CSS、JavaScript，无构建步骤或外部运行时依赖，可直接托管在 GitHub Pages。

## 本地运行

```sh
cd /workspace/lijia7.github.io
python3 -m http.server 8081 --bind 0.0.0.0
```

浏览器访问本地服务的 8081 端口。JavaScript 使用 ES modules，请通过 HTTP 服务打开。

## 设置首页照片

首页已接入上传的原图 `assets/IMG_1183.PNG`：海边电脑工作室与夕阳。原始 PNG 保持不变；浏览器根据亮度选择 ASCII 字符，保留每个区域的颜色，并加入缓慢的字符变换、波动与鼠标交互。

`site.config.js` 中的 `image` 指定默认图片，`imageAlt` 提供无障碍描述。更换图片时更新这两个字段即可。默认细节为 220 列，手机根据画面尺寸自动降低采样量；滑块可调整细节。图片未配置或加载失败时，会显示明确标注的生成光环。

页面也支持选择或拖入本地图片临时预览，最大 20 MB。照片只在当前浏览器中处理，不上传、不保存；刷新后恢复配置的首页图片。发布到仓库的默认照片会成为公开网站资源。

字符密度可以调整，动效可以暂停。系统开启“减少动态效果”时默认暂停，页面切到后台时也会停止绘制。图片完整缩放显示，不裁剪；透明像素不会绘制字符。

## GitHub Pages

在仓库 **Settings → Pages** 中选择 **Deploy from a branch**，选择 **master** 分支及 **/(root)**。`.nojekyll` 允许直接发布静态文件。代码推送与开启 GitHub Pages 是独立步骤。
