# 开发记录与验收

## 2026-11-06：初版
- 阅读 Sport-Scout 的 App.jsx 与 MatchList.jsx，研究项目导航、日期筛选、联赛分组及收藏组织。
- 阅读 esport_ics 的 README，研究按游戏/战队分发赛程的方式。
- 独立设计 MATCHDAY / 赛点：深色底色、绿色强调、球场图形、分组赛程行。未复用第三方代码或图像。
- 阶段一提交：四个真实 HTML 页面、导航、语义结构和项目说明。
- 阶段二提交：桌面双栏与手机单栏、项目横向滚动、焦点样式。
- 阶段三提交：虚构演示赛程、组合筛选、关注状态、localStorage、空结果与存储失败提示、自动检查。

## 开发规则
课程内容只放在交付讲解和项目文档，不添加到产品页面。
使用 header/nav/main/section/article/footer、单个 h1、关联 label、原生 button、time 与 aria-pressed。
CSS 使用 border-box、Flexbox、Grid、媒体查询；无外部字体与图片依赖。
JavaScript 使用 DOM 创建节点及 textContent，事件更新筛选与收藏状态；不把数据拼成 HTML。
当前无网络数据请求，因此没有伪造加载状态。未来接入真实数据必须增加加载、失败、最后更新时间与缓存回退。

## 检查
运行 `node --check app.js` 和 `node check.cjs`。
覆盖类别隔离、大小写搜索、日期筛选、关注筛选、空结果、唯一 ID、日期可解析性、页面资源和导航链接。
最小 DOM 环境执行完整 app.js，检查真实收藏按钮、持久化、搜索事件与重置行为。
本轮本地 HTTP 服务在宿主中启动后，独立请求及内置浏览器均连接超时；未完成真实浏览器视觉、键盘与手机尺寸验收。

## GitHub Pages 发布（待执行）
当前 GitHub CLI 凭据失效，尚未创建远程仓库或推送；本地 Git 历史完整保留。
恢复登录后，在本项目目录执行：

```sh
gh auth login -h github.com
gh repo create matchday --public --source=. --remote=origin --push
```

GitHub 仓库 Settings → Pages → Deploy from a branch → main / (root)，保存。
使用 GitHub 实际返回的发布地址进行检查，不能把预期 URL 当作部署成功。
建议仓库添加 .gitignore、README 和许可时不要在远程再次初始化，避免产生无关历史。
发布后需验证首页、三条导航、静态资源、收藏与手机布局，再交付部署讲解。

## 最终交付时讲解
结合实际 Pages 地址解释 DNS → HTTPS/HTTP → 静态文件 → HTML DOM / CSS 布局 / JS 事件 → 浏览器绘制。
结合实际代码解释语义化、无障碍、盒模型、Flexbox、Grid、状态管理和提交记录。
排查顺序：域名解析 → 网络/TLS → HTTP 状态 → 文件路径与大小写 → JS 控制台 → 数据新鲜度 → CSS 布局。

## 下一阶段
选择并验证允许使用的数据源；独立提交真实数据接入与失败处理；再完成正式部署。

## 界面精简
按用户标注删除品牌副标语、宣传标题与说明、绿色球场装饰及底部宣传区；四页统一采用功能性文案，保留简短页面标题与赛程入口。删除对应无用 CSS。筛选、收藏、空状态和四页链接检查通过；本轮未做浏览器视觉验收。
