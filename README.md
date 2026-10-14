# Running Tracker 跑步训练记录

中文、适配手机的静态网页应用，无需后端或第三方运行依赖。支持训练新增、编辑、删除，自动配速，每周（周一开始）、每月和累计跑量，以及按周/月展示的 SVG 趋势图。心率可选，日期不能晚于今天。

## 本地运行

在仓库目录执行：

```sh
python3 -m http.server 8000
```

在浏览器打开 `http://localhost:8000`。也可以直接打开 index.html，但建议使用 HTTP 服务，确保浏览器存储行为一致。

数据以 `running-tracker.records.v1` 为键保存在当前浏览器的 localStorage 中。不同设备、浏览器和网站地址之间不会同步；清除网站数据会删除记录。存储失败会提示且不更新当前记录；损坏的数据不会自动覆盖。正式部署后，请固定使用同一网站地址。

## 提交到 GitHub

```sh
 git add index.html style.css app.js README.md
 git commit -m "Add Chinese running tracker web app"
 git push origin HEAD:main
```

推送前确认远程 main 没有新增提交；如果提示权限不足或分支保护，请推送到功能分支并创建 Pull Request。云环境的本地分支可能名为 work，上面的命令将当前提交推送到远程 main。

## GitHub Pages 部署

1. 将文件提交并推送到 `Congliu57/-running-tracker` 的 main 分支。
2. 打开仓库 Settings → Pages。
3. 在 Build and deployment 中选择 Deploy from a branch。
4. 选择 main 分支和 / (root)，点击 Save。
5. 等待 Pages 部署完成，查看页面提供的网址，通常是 `https://congliu57.github.io/-running-tracker/`。

在 iPhone Safari 打开该网址即可使用，也可以通过分享菜单“添加到主屏幕”。本应用未实现离线缓存；首次及重新加载页面需要网络。所有资源采用相对路径，兼容 GitHub Pages 仓库子目录。

## 验证

使用 Chromium 的手机视口检查新增、自动配速、统计、编辑、取消编辑、删除确认、刷新后的数据保存、趋势切换、非法输入与布局。真实 iPhone Safari 仍建议在部署后进行设备验收。
