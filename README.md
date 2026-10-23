# MATCHDAY / 赛点

体育与电竞赛程查询网站，原生 HTML / CSS / JavaScript，无构建依赖。

## 当前阶段
初版原型。所有对阵和时间均为虚构演示，不代表真实赛事。未接入抓取或 API。

## 本地运行
在此目录运行 `python -m http.server 5500 --bind 127.0.0.1`，打开 http://127.0.0.1:5500 。

## 页面
首页 index.html；体育 sports.html；电竞 esports.html；关注 favorites.html。

## 设计研究
- https://github.com/panzmoravylab/Sport-Scout ：参考项目切换、日期筛选、搜索及联赛分组的信息结构。
- https://github.com/snutij/esport_ics ：参考游戏与战队分类、静态数据分发思路。
界面与代码独立编写，没有复制上述项目的代码或图片。

## 开发阶段
1. 需求与四页语义化结构。
2. 响应式视觉与原创品牌。
3. 演示赛程、筛选、收藏与检查。

## 后续
确认可合法获取的数据源，再实现定时更新；最后创建 GitHub 仓库、推送完整历史并启用 Pages。不要把其他项目的提交当作本项目的开发历史。

## 知识模块
HTML 语义与无障碍；CSS Grid、媒体查询；JavaScript DOM、事件和 localStorage；HTTP 静态托管与相对路径；Git 分阶段提交；GitHub Pages 部署。
