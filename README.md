# MATCHDAY / 赛点

原生 HTML/CSS/JavaScript 四页赛程网站。GitHub 私有仓库保存代码；Cloudflare Pages 提供公开地址 https://matchday-b43.pages.dev 。

## 当前来源
- 英超：openfootball/football.json 的当季 en.1.json。CC0 社区数据，无需密钥。同步时根据 7 月赛季分界计算目录，不固定年份。404 或结构变化时保留旧快照。
- LOL：读取 zlypher/lol-events 公开 data/matches.json（同一仓库公开日历的生成快照）。无需注册、无需 Token；上游原始数据来自 PandaScore。
- 每条记录根据 leagueId 294（LPL）、297（Worlds）筛选；若存在 leagueName 则交叉验证，名称与 ID 不一致时保留旧数据并报结构错误。不以战队归属判断赛事。
- 真实普通 HTTP 验证两个来源返回200；本地同步成功。是否云端成功以实际 Actions 结果为准。


## 数据限制
openfootball 的 JSON 自动生成不保证上游数据实时更新。README 指明上游仍依赖社区维护；不要把每日生成等同实时改期通知。英国本地时间使用 Europe/London 处理夏令时，JSON 已有时间才转换，缺失显示待定，不自行补默认开球时间。
英超没有来源 ID 的记录，使用赛季+主客队计算稳定编号，不包含日期/时间或轮次，改期不影响收藏。球队名称被上游改名仍可能改变此后备编号。
内部时间带时区，页面与日期查询使用 Asia/Shanghai。没有确定时间的比赛不能可靠归入北京时间日期，日期筛选不会返回这些记录。
每次保存未来七天赛程及无日期待定项；已离开窗口的比赛不展示，但浏览器仍保留收藏编号。LOL 继承底层 PandaScore 比赛 ID，改期或替换数据源不会使同一 ID 的收藏丢失。
页面中的“最近成功检查”是本项目成功读取数据的时间，不代表上游已确认改期或实时比分。

## 自动同步（不需要密钥）
GitHub Actions 每两小时运行一次，也支持 workflow_dispatch 手动运行。英超与 LOL 分别处理，任一来源失败保留其原有数据。所有外部请求不含 Token 或认证头。
工作流不再读取任何 Secret，旧的 PANDASCORE_TOKEN 即使存在也不会使用。
正常空窗口显示暂无赛程，空列表不当成抓取失败；未知结构、损坏记录和网络错误不会清空旧快照。
LOL 汇总 JSON 包含 generatedAt，页面同时显示上游生成时间与本项目检查时间；上游超过36小时未生成新快照会提示可能过期。反复抓到同一文件不代表数据更新。
公开日历源不完整提供比赛状态，未取消的未来场次标为“赛程预告”，不推测实时进行中或比分。阶段只从源 summary 中明确的前缀解析，缺失显示阶段待定；没有队伍信息显示TBD。LPL 无未来比赛不等于数据源失败，也不能仅凭空窗口断言整个联赛休赛。
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
- https://github.com/zlypher/lol-events （MIT 代码；数据来自 PandaScore，项目不改变底层数据的权利归属）
- https://raw.githubusercontent.com/zlypher/lol-events/main/data/matches.json

蓝黑配色、四页导航、可伸缩空侧栏和键盘交互保留。课程知识说明只在交付文档或讲解，不添加到网站页面。
