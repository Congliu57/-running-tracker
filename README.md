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

## V2.0 新增功能与数据兼容

- 比赛管理：多场比赛、编辑/删除、最近一场倒计时和历史筛选。比赛日期为设备本地日期，今天显示“今天比赛”，次日转为“已结束”；不判断当天比赛的具体结束时间。
- 成绩预测：保存一项 5K、10K、半马或全马参考成绩，通过 Riegel 指数 1.06 预测任意目标距离。公式预测与自己设定的比赛目标分开显示，仅供参考。
- 配速计划：按匀速显示 5K、10K、半马和终点累计用时；超出目标距离的分段隐藏，分段等于终点时只显示终点。
- JSON 备份：点击“导出 JSON 数据”，保存训练、比赛、参考成绩及原始存储字符串。当前不支持导入，请保管备份。

原训练键 `running-tracker.records.v1` 和记录结构完全保留，无需迁移。比赛存储键是 `running-tracker.races.v2`，参考成绩键是 `running-tracker.reference.v2`。新功能不会写入训练存储；只有原训练的新增、编辑、删除操作会更新训练记录。浏览器存储读取损坏时阻止覆盖，写入失败时保留当前数据。

## iPhone 审查、合并和发布 V2

1. 用 Safari 登录 GitHub，打开 V2 Pull Request。在 Files changed 查看修改，Conversation 查看测试报告。此时 main 和已发布网站仍保持原版本。
2. GitHub 不会自动为功能分支生成在线预览；合并前可审查代码和测试报告。建议先在原网站导出已有训练备份。不要清除 Safari 网站数据。
3. 确认后在 PR 底部点击 Merge pull request（或 Squash and merge），再点击 Confirm merge。如果看不到按钮，先检查是否登录仓库所有者账号，并可在 Safari 地址栏菜单选择“请求桌面网站”。
4. 仓库 Settings → Pages 设置为 Deploy from a branch、main、/ (root)。若之前已这样设置，合并后会自动部署，不必重新设置。
5. 打开 Actions 查看 pages build and deployment 是否成功。成功后刷新原网址 `https://congliu57.github.io/-running-tracker/`，看到 V2.0 标识即已更新。
6. 在同一个 Safari 网站地址确认原记录仍在；添加比赛、输入参考成绩、计算配速并下载 JSON 备份。iPhone Safari 的日期输入显示格式由系统语言决定。

若自动创建 PR 不可用，打开 GitHub 的分支比较页面，确认 base 为 main、compare 为 feature/running-tracker-v2，点击 Create pull request，再进入上述审查步骤。无需在 iPhone 手动复制代码。

## 可重复的浏览器测试

测试工具仅用于开发，不是网页依赖。准备 Node.js、Playwright 和 Chromium 后，在 `/workspace` 启动 `python3 -m http.server 8001`；测试默认访问 `http://127.0.0.1:8001/-running-tracker/`，用于验证 GitHub Pages 子目录路径。

```sh
node --check app.js
node --check v2.js
node tests/v1-regression.cjs
node tests/v2.cjs
```

Playwright 需能被 Node.js 查找到（安装在仓库外亦可，通过 NODE_PATH 指定）。Chromium 默认 `/usr/bin/chromium`；V2 测试可通过 CHROMIUM_PATH 指定。测试使用独立临时浏览器上下文，不接触你的 Safari 数据。真实 iPhone Safari 仍需在发布后实机验收。

### 成绩输入修复

成绩输入采用文本键盘，iPhone Safari 可输入冒号。参考成绩使用 HH:MM:SS，例如 01:45:30；分钟、秒必须在 00–59 内，时间必须大于零。为兼容超长成绩，也接受三位小时。输入时即时校验，计算前转换为秒；预测公式与旧跑步数据不变。

测试可使用 TEST_URL 指定服务地址，例如 `TEST_URL=http://127.0.0.1:8002/-running-tracker/ node tests/v2.cjs`。

### 两种参考成绩输入方式

成绩预测现在可选择“直接输入 HH:MM:SS”或“分别填写小时、分钟、秒”。文本方式使用普通键盘，支持冒号；分段方式使用数字键盘。两种方式切换时会保留有效时间。分钟与秒必须为 0–59 的整数，总时间必须大于零。参考成绩仍存为原来的秒数，跑步记录与比赛数据不会被此功能改写。

在 iPhone 上打开修复 PR，检查 Files changed 后合并到 main；Pages 配置为 main / (root) 时会自动重新部署。等待 Actions 成功后刷新原网址，不要清除 Safari 网站数据。
