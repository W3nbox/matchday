# MATCHDAY / 赛点

原生 HTML / CSS / JavaScript 体育与电竞赛程网站，无后端或数据库。

## 当前部署
- GitHub：W3nbox/matchday（私有仓库）
- Cloudflare Pages：https://matchday-b43.pages.dev
- main 保留已上线初版；experiment/football-lol-sync 是尚未启用的真实赛程实验。

## 赛程实验
足球先覆盖英超，来源 football-data.org；LOL 使用 PandaScore。按数据源公布的未来七天窗口查询，不保证覆盖所有联赛；休赛期可能没有赛程。未公布日期的赛事可能不被上游窗口接口返回。
没有填充虚构真实赛程。data/schedule.json 的初始状态为 pending；密钥配置完成且实际同步成功后才有真实数据。
页面读取静态 JSON，不接触 API 密钥。收藏使用数据源稳定编号；已退出查询窗口的比赛仍保留收藏编号，但不再展示。

## 运行与检查
通过本地 HTTP 服务打开，不能双击 file:// 页面加载 JSON。

```sh
python -m http.server 5500 --bind 127.0.0.1
node --check app.js
node check.cjs
node --test scripts/sync.test.cjs
```

## 启用同步（待账号及密钥）
注册来源：
- https://www.football-data.org/client/register
- https://www.pandascore.co/

确认免费方案的数据展示、缓存和署名条款后，将密钥保存在仓库 Settings → Secrets and variables → Actions → Repository secrets：
- FOOTBALL_DATA_TOKEN
- PANDASCORE_TOKEN

不要把密钥放进网页、仓库文件、命令参数或截图。
代码推送并合入 main 后，在 Actions 选择 Sync football and LoL schedules，手动运行一次。成功后检查 data/schedule.json 的两个来源状态、比赛时间及 Cloudflare 部署。密钥尚未配置时不要宣称实时数据已接通。
定时任务每两小时在 UTC 偶数小时的第17分钟触发，可能有延迟。一个月最多约372次计划部署，另计开发部署；私有仓库 Actions 受账号分钟额度约束。
工作流用 GitHub 自带 GITHUB_TOKEN 写入数据并推送；如仓库策略禁止写入或 main 禁止机器人直接推送，会明确失败，不强制覆盖。Cloudflare 的 GitHub 集成负责部署这些推送。
单个数据源失败保留它的上次比赛列表和成功更新时间；另一个数据源仍可更新。失败状态也写入文件并标记工作流失败。

## 初版及课程要求
四页：index.html、sports.html、esports.html、favorites.html。
设计参考 Sport-Scout 的项目/日期/联赛组织，及 esport_ics 的静态分发思路；未复制代码与图片。
课程知识说明放在交付讲解与项目文档，不放在网站页面。
HTML 语义与键盘访问、CSS Grid/Flexbox/响应式、JS DOM/事件/状态、HTTP/DNS、Git 和静态部署均结合实际代码讲解。
