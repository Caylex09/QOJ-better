
实现功能：

- General
  - Show mirror switcher：切换 `contest.ucup.ac`，`qoj.ac`，`jiang.ly`，`huang.lt`，`oj.qiuly.org`，`relia.uk`，`love.larunatre.cy`，`hate.larunatre.cy` 域名。
- Problems
  - Add view-my-submissions link： 快速查看本题个人提交记录。
  - Show view-in-contest link on problem pages：快速切换为比赛内看题。
  - Add Accepted badge for full score：添加 AC 标记，点击可以查看最后一发 AC 记录，AC 之后将 Submit 按钮设为绿色。
- Contests
  - Add back link on contest problem pages：快速切换为题库内看题。
- Standings
  - Show problem difficulty：显示本题预测 Codeforces 评分。具体计算来源为@a_little_cute 人脑拟合的函数，并且使用 Github Copilot 缝合进了脚本并做了些微修复。当然，这个函数是人脑拟合出来的，QOJ 的各种比赛也和 CF Rules 相去甚远，故仅图一乐，并非一个标准化的换算。可选项为：
    - Difficulty only counts UCUP teams：[true/false] 表示是否仅计算 ucup-teams 带来的影响。因为 ucup-teams 有长期稳定的 rating 计算。
  - Show performance (GP30)：比赛界面显示当前 performance，按照 [Universal Cup Rules](https://ucup.ac/rule/) 的规则计算。

- Profile
  - Add authored problems vote viewer：可以在个人界面查看该用户所有 authored problems 的 votes 详情与总和。