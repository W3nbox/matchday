# MATCHDAY / 赛点

原生 HTML/CSS/JavaScript 四页赛程网站。GitHub 私有仓库保存代码；Cloudflare Pages 提供公开地址 https://matchday-b43.pages.dev 。

## 当前来源
- 英超：openfootball/football.json 的当季 en.1.json。CC0 社区数据，无需密钥。同步时根据 7 月赛季分界计算目录，不固定年份。404 或结构变化时保留旧快照。
- LOL：PandaScore upcoming 接口，逐条依据 league 字段仅收录 LPL 和 World Championship（Worlds）；不依据参赛队伍归属筛选。包含来源返回的赛事阶段。未配置 Token，尚未做真实请求验证。
- 本地已用普通 HTTP 成功读取 2026/27 英超整季 380 场及生成同步快照；这不等于 GitHub Actions 已成功运行。

## 数据限制
openfootball 的 JSON 自动生成不保证上游数据实时更新。README 指明上游仍依赖社区维护；不要把每日生成等同实时改期通知。英国本地时间使用 Europe/London 处理夏令时，JSON 已有时间才转换，缺失显示待定，不自行补默认开球时间。
英超没有来源 ID 的记录，使用赛季+主客队计算稳定编号，不包含日期/时间或轮次，改期不影响收藏。球队名称被上游改名仍可能改变此后备编号。
内部时间带时区，页面与日期查询使用 Asia/Shanghai。没有确定时间的比赛不能可靠归入北京时间日期，日期筛选不会返回这些记录。
每次保存未来七天的未结束比赛及无日期待定项；已离开窗口的比赛不展示，但浏览器仍保留收藏编号。
页面中的“最近成功检查”是本项目成功读取数据的时间，不代表上游已确认改期或实时比分。

## 同步与凭据
GitHub Actions 每两小时运行一次，也支持 workflow_dispatch 手动运行。每个来源独立成功/失败；失败保留该来源比赛和最后成功更新时间，写入失败类别，工作流报告失败。成功返回空列表与结构错误、未配置、网络错误区分。
PandaScore 的唯一所需 Secret 为 PANDASCORE_TOKEN。保存在仓库 Settings → Secrets and variables → Actions，不放进源码、前端或 URL 查询参数。
Token 通过 Authorization Bearer 请求头传递。没有 Token 时足球仍能更新，LOL 显示尚未接通，不替换演示或伪造赛程。
工作流用自带 GITHUB_TOKEN 更新 JSON，github-actions[bot] 提交清楚标明数据更新；Cloudflare 通过 GitHub 集成自动部署。没有强制推送或重写历史。
私有仓库 Actions 有账号分钟额度；Pages 免费构建每月500次，本计划每月约360—372次，另加开发部署。定时触发可能延迟。

## 运行与检查
页面需要 HTTP 服务，file:// 无法可靠 fetch 同源 JSON。

```sh
python -m http.server 5500 --bind 127.0.0.1
node --check app.js
node check.cjs
node --test scripts/sync.test.cjs
node scripts/sync.cjs
```

## 来源文档
- https://github.com/openfootball/football.json （README、CC0 及更新说明）
- https://github.com/openfootball/england （英超原始 Football.TXT）
- https://developers.pandascore.co/docs/plan-reference
- https://developers.pandascore.co/reference/get_lol_matches_upcoming

蓝黑配色、四页导航、可伸缩空侧栏和键盘交互保留。课程知识说明只在交付文档或讲解，不添加到网站页面。
