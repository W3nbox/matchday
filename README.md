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
保存数据源提供的全部未来赛程及无日期待定项，不设7天、30天等日期上限；过去、已结束和取消比赛不展示，浏览器仍保留收藏编号。LOL 继承底层 PandaScore 比赛 ID，改期或替换数据源不会使同一 ID 的收藏丢失。
页面中的“最近成功检查”是本项目成功读取数据的时间，不代表上游已确认改期或实时比分。

## 自动同步（不需要密钥）
GitHub Actions 每两小时运行一次，也支持 workflow_dispatch 手动运行。英超与 LOL 分别处理，任一来源失败保留其原有数据。所有外部请求不含 Token 或认证头。
工作流不再读取任何 Secret，旧的 PANDASCORE_TOKEN 即使存在也不会使用。
正常空列表显示暂无赛程，空列表不当成抓取失败；未知结构、损坏记录和网络错误不会清空旧快照。
LOL 汇总 JSON 包含 generatedAt，页面同时显示上游生成时间与本项目检查时间；上游超过36小时未生成新快照会提示可能过期。反复抓到同一文件不代表数据更新。
公开日历源不完整提供比赛状态，未取消的未来场次标为“赛程预告”，不推测实时进行中或比分。阶段只从源 summary 中明确的前缀解析，缺失显示阶段待定；没有队伍信息显示TBD。LPL 无未来比赛不等于数据源失败，也不能仅凭空列表断言整个联赛休赛。
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

## 队伍图标
英超20支球队队徽来自 https://github.com/luukhopman/football-logos 的2026/27目录，按球队名人工核对映射并保存为本站PNG；来源清单见 data/football-logos.json。LOL使用 zlypher 公共快照 opponents.imageUrl，保留队伍与图标对应关系。队徽和商标权利归相关俱乐部及战队，未宣称开源代码许可等于商标授权。缺失或加载失败回退文字，TBD不显示虚构图标。

## CS2 与瓦洛兰特
两类赛程来自 https://github.com/snutij/esport_ics 公开团队日历，读取完整 ZIP 快照后只处理 ics/counter_strike 与 ics/valorant；不注册、不使用 Token、不访问 PandaScore API。
使用 Python 标准库 zipfile 读取内存压缩包，不解压路径或执行仓库代码。一次网络请求取得两个项目；各项目解析与失败状态独立。按 UID 去重，多战队副本存在冲突时拒绝该项目新数据并保留旧快照。
只接受明确 UTC DTSTART，不用 Today/Tomorrow 或本机时区推测。已过去或明确取消事件排除，没有日期上限。保留来源描述、阶段、双方、稳定ID和来源文件链接。日历没有图标、实时比分与状态，使用文字图标/赛程预告，不把估算结束时间当作真实结束时间。
日历 DTSTAMP 在该项目中等于比赛时间，不能用作数据更新时间，因此页面仅显示本项目最近成功读取时间；上游未提供可靠生成时间。此来源依赖社区维护，不保证覆盖全部赛事。
本地真实验证 CS2 122 场、瓦洛兰特43场。工作流新增 setup-python 和 python scripts/test_calendars.py；Node 逻辑和原有网页检查继续运行。

CS2/瓦洛兰特队徽：按游戏与准确队名匹配，战队官网、赛事主办方或对阵资料页及图片地址记录在 data/esports-logos.json。缩写 CW 按赛事区分 Chinggis Warriors 和 Copenhagen Wolves；HooK官网赛程栏提供的对手图标也逐一按显示名称核对。保存本站原始PNG/WebP/SVG，沿用失败文字回退。100 Thieves内嵌SVG设置官网深色背景使用的白色继承色，NIP、FaZe与BIG黑色标志增加浅底，不重绘标志。不同分队、未知缩写与TBD不模糊匹配，不借用主队图标。后续同步会自动应用相同映射；未确认的其他队伍保留文字。队徽与商标权仍属相应权利人。

## 棒球（MLB）
使用 MLB 公开 Stats 接口（https://statsapi.mlb.com），无需账号、Token 或额外服务器。获取方式参考 https://github.com/toddrob99/MLB-StatsAPI 所封装的公开接口；本项目直接用现有Node fetch，不复制该GPL库或引入新依赖。
每两小时请求 /api/v1/seasons/all?sportId=1 获取官方发布的赛季清单，再按赛季请求 /api/v1/schedule?sportId=1&season=...。只请求必要字段，收录当前及以后全部已发布赛季，不设置7天、30天等日期上限。任一赛季请求或结构校验失败，整份MLB快照保留上次成功内容，不发布部分新赛季。正常空dates与抓取失败分别处理。
按gamePk生成稳定编号mlb:<id>，沿用旧编号，改期不影响收藏。不同日期上的延期副本保留较新官方比赛日期，同日冲突则拒绝新快照。按MLB球队ID排除大学队、国际俱乐部与全明星队；包含春训、常规赛、外卡、分区系列赛、联盟冠军赛和世界大赛等明确赛事阶段。
只有官方startTimeTBD=false才显示Preview的gameDate，待定或缺少确认标记显示待定；时间必须明确带时区，内部转为UTC，页面与日期筛选统一Asia/Shanghai。仅有官方比赛日期时保守延迟移除，不猜测北京时间。比赛链接指向MLB官方gameday。最近成功检查表示本项目读取成功时间，不声称数据实时不变。
30支MLB真实队徽保存为本地PNG，来自 https://github.com/alexmarple/mlb-images 的logos目录，球队ID/名称对照参考 https://github.com/camdenk/mlbplotR/blob/main/data-raw/MLB_Colors_Logos.csv ，明细见data/baseball-logos.json。按球队ID匹配，TBD或图标失败回退文字。队徽和数据权利仍属相应权利人。
MLB数据使用仍受 https://gdx.mlb.com/components/copyright.txt 和 https://www.mlb.com/official-information/terms-of-use 约束；公开可读取、第三方包装库开源不等于数据获得开源许可。本项目不宣称获得MLB授权，不绕过登录、验证码或访问限制；若接口拒绝访问，保留旧数据并报错。

2026-11-08真实读取验证：2897场未来比赛（467场春训、2430场常规赛），1342场确认时间、1555场待定；全部匹配本地队徽。待定场次显示官方比赛日，与北京时间日期筛选明确区分。
