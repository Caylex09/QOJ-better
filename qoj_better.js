// ==UserScript==
// @name         QOJ Better
// @namespace    http://tampermonkey.net/
// @version      1.9
// @description  Make QOJ great again!
// @match        https://qoj.ac/*
// @match        https://jiang.ly/*
// @match        https://huang.lt/*
// @match        https://contest.ucup.ac/*
// @match        https://oj.qiuly.org/*
// @match        https://relia.uk/*
// @match        https://love.larunatre.cy/*
// @grant        none
// @license      MIT
// @author       cyx
// ==/UserScript==

// 全局状态
window.onlyUCUPTeams = false;
window.cachedProblemIndices = null;

const RATING_CONFIG = { BASE: 4100, K: 950 };

// 获取题号
function getProblemId() {
    const matchContest = location.pathname.match(/\/contest\/(\d+)\/problem\/(\d+)/);
    if (matchContest) return matchContest[2];
    const matchProblem = location.pathname.match(/\/problem\/(\d+)/);
    if (matchProblem) return matchProblem[1];
    return null;
}

// 获取用户名
function getUsername() {
    const userLink = document.querySelector('a.dropdown-item[href*="/user/profile/"]');
    if (userLink) {
        const match = userLink.href.match(/\/user\/profile\/([^/?#]+)/);
        if (match) return match[1];
    }
    return null;
}

function switchDomain() {
    if (document.getElementById('domain-switcher')) return;
    const currentHost = location.host;
    const pathname = location.pathname + location.search + location.hash;
    const isContest =
        pathname.includes('/contest/') ||
        pathname.includes('/contests') ||
        pathname.includes('/user') ||
        pathname.includes('/results');
    const domains = isContest
        ? ['qoj.ac', 'jiang.ly', 'huang.lt', 'oj.qiuly.org', 'relia.uk', 'love.larunatre.cy', 'contest.ucup.ac']
        : ['qoj.ac', 'jiang.ly', 'huang.lt', 'oj.qiuly.org', 'relia.uk', 'love.larunatre.cy'];

    // 构造域名切换内容
    const span = document.createElement('span');
    span.id = 'domain-switcher';
    span.style.fontSize = '0.9em';
    span.style.color = '#666';
    span.textContent = 'switch to: ';

    domains.forEach((domain, i) => {
        const link = document.createElement('a');
        link.textContent = domain;
        link.style.marginLeft = '4px';
        link.style.color = domain === currentHost ? '#999' : '#007bff';
        link.style.cursor = domain === currentHost ? 'default' : 'pointer';
        link.style.textDecoration = 'none';
        link.onmouseover = () => (link.style.textDecoration = 'underline');
        link.onmouseout = () => (link.style.textDecoration = 'none');
        if (domain !== currentHost) {
            link.onclick = () => (window.location.href = `https://${domain}${pathname}`);
        }
        span.appendChild(link);
        if (i < domains.length - 1) span.append(' ');
    });

    // 优先尝试插入到顶部的 float-right nav（登录区域）
    const navPills = document.querySelector('.nav.nav-pills.float-right');
    if (navPills && !navPills.querySelector('#domain-switcher')) {
        const li = document.createElement('li');
        li.className = 'nav-item';
        li.appendChild(span);
        navPills.insertBefore(li, navPills.firstChild);
        return;
    }

    // 如果有登录的用户（navbar 中的 dropdown-toggle）
    const navbarUser = document.querySelector('.navbar .nav-link.dropdown-toggle');
    if (navbarUser) {
        const parentUl = navbarUser.closest('ul');
        if (parentUl && !parentUl.querySelector('#domain-switcher')) {
            const li = document.createElement('li');
            li.style.listStyle = 'none';
            li.appendChild(span);

            const userLi = navbarUser.closest('li');
            if (userLi && userLi.parentElement) {
                userLi.parentElement.insertBefore(li, userLi);
            }
        }
        return;
    }

    document.body.insertBefore(span, document.body.firstChild);
}

// ========== UCUP 评分功能 ==========

function getMultiplier(x) {
    if (x <= 20) return 1.0;
    if (x <= 40) return 1.01;
    if (x <= 60) return 1.03;
    if (x <= 70) return 1.05;
    if (x <= 80) return 1.08;
    if (x <= 90) return 1.12;
    if (x <= 95) return 1.20;
    if (x === 96) return 1.30;
    if (x === 97) return 1.50;
    if (x === 98) return 1.80;
    if (x === 99) return 2.50;
    if (x >= 100) return 3.50;
    return 1.0;
}

function getStyle(r) {
    if (r >= 3000) return '#AA0000';
    if (r >= 2600) return '#FF3333';
    if (r >= 2400) return '#FF7777';
    if (r >= 2100) return '#FFBB55';
    if (r >= 1900) return '#FF88FF';
    if (r >= 1600) return '#AAAAFF';
    if (r >= 1400) return '#03A89E';
    return '#77FF77';
}

function isProblemHeader(text) {
    if (!text) return false;
    text = text.trim();
    return /^[A-Z][0-9]?($|[\s\n\(\)])/.test(text);
}

function getProblemIndices() {
    // 如果已缓存，返回缓存的值
    if (window.cachedProblemIndices !== null) {
        return window.cachedProblemIndices;
    }

    const table = document.querySelector('table');
    if (!table) return [];

    let headerRow = table.querySelector('thead tr') || table.rows[0];
    if (!headerRow) return [];

    const cells = Array.from(headerRow.cells);
    const problemIndices = [];

    cells.forEach((cell, idx) => {
        const text = cell.innerText || cell.textContent;
        if (isProblemHeader(text)) {
            problemIndices.push(idx);
        }
    });

    // 缓存起来
    if (problemIndices.length > 0) {
        window.cachedProblemIndices = problemIndices;
    }

    return problemIndices;
}

function calculateRatings() {
    const table = document.querySelector('table');
    if (!table) return;

    let headerRow = table.querySelector('thead tr') || table.rows[0];
    if (!headerRow) return;

    if (typeof standings === 'undefined' || !Array.isArray(standings)) return;
    if (typeof score === 'undefined' || typeof score !== 'object') return;

    // 使用缓存的题目索引
    const problemIndices = getProblemIndices();
    if (problemIndices.length === 0) return;

    let validTeams = standings.filter(row => {
        if (!Array.isArray(row) || row.length < 3) return false;
        const userInfo = row[2];
        if (!userInfo || !Array.isArray(userInfo)) return false;

        if (window.onlyUCUPTeams) {
            const userId = userInfo[0];
            return userId.startsWith('ucup-team');
        }
        return true;
    });

    const totalParticipants = validTeams.length;

    // 当没有有效队伍时，也需要显示 4000 分
    if (totalParticipants === 0) {
        // 没有符合条件的队伍，所有题目都显示 4000
        problemIndices.forEach((columnIdx) => {
            const th = headerRow.cells[columnIdx];
            let badge = th.querySelector('.qoj-precise-rating');

            if (!badge) {
                badge = document.createElement('div');
                badge.className = 'qoj-precise-rating';
                badge.style.cssText = 'display:block; font-size:12px; font-weight:bold; margin-bottom:4px; line-height:1; font-family:monospace;';
                th.insertBefore(badge, th.firstChild);
            }

            badge.innerText = 4000;
            badge.style.color = getStyle(4000);
            badge.title = `评分: 4000（默认，无有效队伍）`;
        });
        return;
    }

    problemIndices.forEach((columnIdx, scoreIdx) => {
        let acCount = 0;

        validTeams.forEach(row => {
            const userInfo = row[2];
            const userId = userInfo[0];

            if (score[userId] && score[userId][scoreIdx]) {
                const problemData = score[userId][scoreIdx];
                if (problemData[0] > 0) {
                    acCount++;
                }
            }
        });

        // 计算评分
        let rating;
        if (acCount === 0) {
            // 没人过题，评分为 4000
            rating = 4000;
        } else {
            const acPercentage = (acCount / totalParticipants) * 100;
            const multiplier = getMultiplier(acPercentage);
            const estimatedTotal = acCount * multiplier;

            if (estimatedTotal <= 1) {
                rating = 4000;
            } else {
                rating = Math.round(RATING_CONFIG.BASE - RATING_CONFIG.K * Math.log10(estimatedTotal));
                rating = Math.max(800, Math.min(4000, rating));
            }
        }

        const th = headerRow.cells[columnIdx];
        let badge = th.querySelector('.qoj-precise-rating');

        if (!badge) {
            badge = document.createElement('div');
            badge.className = 'qoj-precise-rating';
            badge.style.cssText = 'display:block; font-size:12px; font-weight:bold; margin-bottom:4px; line-height:1; font-family:monospace;';
            th.insertBefore(badge, th.firstChild);
        }

        badge.innerText = rating;
        badge.style.color = getStyle(rating);

        // 当没人过题时，显示更明确的 tooltip
        if (acCount === 0) {
            badge.title = `AC 数: 0\n评分: 4000（默认，暂无人通过）\n参赛队: ${totalParticipants}`;
        } else {
            const acPercentage = (acCount / totalParticipants) * 100;
            const multiplier = getMultiplier(acPercentage);
            const estimatedTotal = acCount * multiplier;
            badge.title = `AC 数: ${acCount}\nAC 率: ${acPercentage.toFixed(1)}%\n补偿系数: ${multiplier.toFixed(2)}\n预测全场: ${estimatedTotal.toFixed(1)}\n参赛队: ${totalParticipants}`;
        }
    });
}

const GP30_SCORES = [100, 75, 60, 50, 45, 40, 36, 32, 29, 26, 24, 22, 20, 18, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

function getGP30(rank) {
    if (rank >= 1 && rank <= 30) return GP30_SCORES[rank - 1];
    return 0;
}

function getPerfColor(perf) {
    if (perf >= 270) return '#AA0000';
    if (perf >= 240) return '#FF3333';
    if (perf >= 210) return '#FF7777';
    if (perf >= 175) return '#FFBB55';
    if (perf >= 145) return '#FF88FF';
    if (perf >= 110) return '#AAAAFF';
    if (perf >= 70) return '#03A89E';
    return '#77FF77';
}

function calculatePerformance() {
    const table = document.querySelector('table');
    if (!table) return;

    let headerRow = table.querySelector('thead tr') || table.rows[0];
    if (!headerRow) return;

    if (typeof standings === 'undefined' || !Array.isArray(standings)) return;
    if (typeof score === 'undefined' || typeof score !== 'object') return;

    const problemIndices = getProblemIndices();
    if (problemIndices.length === 0) return;

    // 移除已有的 Perf 列（支持重复调用）
    if (headerRow.querySelector('.qoj-perf-header')) {
        headerRow.querySelector('.qoj-perf-header').remove();
        table.querySelectorAll('.qoj-perf-cell').forEach(td => td.remove());
    }

    const filteredStandings = standings.filter(row => {
        if (!Array.isArray(row) || row.length < 3) return false;
        const userInfo = row[2];
        if (!userInfo || !Array.isArray(userInfo)) return false;
        return userInfo[0].startsWith('ucup-team');
    });

    // n_teams：在过滤后的队伍中，过了至少一题的队伍数
    function solvedAtLeastOne(row) {
        const userId = row[2][0];
        for (let i = 0; i < problemIndices.length; i++) {
            if (score[userId]?.[i]?.[0] > 0) return true;
        }
        return false;
    }

    const teamsWithSolves = filteredStandings.filter(solvedAtLeastOne);
    const nTeams = teamsWithSolves.length;

    // 构建 userId -> performance 映射（standings 已按名次排序）
    const perfMap = {};
    teamsWithSolves.forEach((row, idx) => {
        const userId = row[2][0];
        const rank = idx + 1;
        const gp30 = getGP30(rank);
        const perf = nTeams > 0 ? 200 * (nTeams - rank + 1) / nTeams + gp30 : gp30;
        perfMap[userId] = perf;
    });

    // 添加表头
    const perfTh = document.createElement('th');
    perfTh.className = 'qoj-perf-header';
    perfTh.textContent = 'Perf';
    perfTh.style.cssText = 'font-size:12px; white-space:nowrap; text-align:center;';
    perfTh.title = `Performance = 200 × (n_teams − rank + 1) / n_teams + GP30\nn_teams: 至少过一题的队伍数`;
    headerRow.appendChild(perfTh);

    // 为 tbody 每一行添加单元格
    // standings 与 tbody 行一一对应
    const tbodyRows = table.querySelectorAll('tbody tr');
    standings.forEach((row, idx) => {
        if (!Array.isArray(row) || row.length < 3) return;
        const userInfo = row[2];
        if (!userInfo || !Array.isArray(userInfo)) return;
        const userId = userInfo[0];

        const tr = tbodyRows[idx - 100 * (getPageId() - 1)]; // 根据当前页码调整索引
        if (!tr) return;

        const td = document.createElement('td');
        td.className = 'qoj-perf-cell';
        td.style.cssText = 'text-align:center; font-weight:bold; font-family:monospace;';

        if (perfMap[userId] !== undefined) {
            const perf = perfMap[userId];
            td.textContent = perf % 1 === 0 ? perf.toFixed(0) : perf.toFixed(1);
            td.style.color = getPerfColor(perf);
            const rank = teamsWithSolves.indexOf(row) + 1;
            const gp30 = getGP30(rank);
            td.title = `Rank: ${rank}\nGP30: ${gp30}\nn_teams: ${nTeams}\nPerf: ${perf.toFixed(2)}`;
        } else {
            td.textContent = '—';
            td.style.color = '#999';
            td.title = '未过题，不计入 Performance';
        }
        tr.appendChild(td);
    });
}

function addToggleButton() {
    if (document.getElementById('toggle-ucup-teams')) return;

    const navbarUser = document.querySelector('.nav-link.dropdown-toggle');
    if (!navbarUser) return;

    const parentUl = navbarUser.closest('ul.navbar-nav, ul.nav');
    if (!parentUl) return;

    const li = document.createElement('li');
    li.style.listStyle = 'none';
    li.style.marginLeft = '10px';

    const button = document.createElement('button');
    button.id = 'toggle-ucup-teams';
    button.type = 'button';
    button.textContent = 'Only UCUP Teams';
    button.style.cssText = 'padding: 5px 10px; background-color: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 0.9em;';

    button.onmouseover = () => (button.style.backgroundColor = '#218838');
    button.onmouseout = () => (button.style.backgroundColor = '#28a745');

    button.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        window.onlyUCUPTeams = !window.onlyUCUPTeams;
        button.textContent = window.onlyUCUPTeams ? 'Show All Teams' : 'Only UCUP Teams';
        calculateRatings();
        calculatePerformance();
        return false;
    };

    li.appendChild(button);
    parentUl.insertBefore(li, navbarUser.parentElement);
}

function isStandingsPage() {
    return /\/contest\/\d+\/(standings|standings\/external)/.test(location.pathname);
}

function getPageId() {
    const pagination = document.querySelector('ul.pagination');
    if (!pagination) return 1;
    const active = pagination.querySelector('li.page-item.active a.page-link');
    if (!active) return 1;
    const match = active.textContent.trim().match(/^(\d+)$/);
    return match[1] || '1';
}

// ========== 其他功能 ==========

function backProblem() {
    if (document.querySelector('.nav-link.back-problem')) return;
    const nav = document.querySelector("ul.nav.nav-tabs");
    if (!nav) return;

    const match = location.pathname.match(/^\/contest\/(\d+)\/problem\/(\d+)/);
    if (!match) return;
    const pid = match[2];

    const li = document.createElement("li");
    li.className = "nav-item";
    li.innerHTML = `<a class="nav-link back-problem" href="/problem/${pid}" role="tab">Back to the problem</a>`;

    const backToContest = Array.from(nav.querySelectorAll("a")).find(a => a.textContent.includes("Back to the contest"));
    if (backToContest) backToContest.parentElement.before(li);
    else nav.appendChild(li);
}

function viewSubmissions() {
    if (document.querySelector('.nav-link.view-submissions')) return;
    const nav = document.querySelector('ul.nav.nav-tabs[role="tablist"]');
    if (!nav) return;

    const matchContest = location.pathname.match(/\/contest\/(\d+)\/problem\/(\d+)/);
    const matchProblem = location.pathname.match(/\/problem\/(\d+)/);
    const pid = matchContest ? matchContest[2] : matchProblem ? matchProblem[1] : null;
    if (!pid) return;

    const userLink = document.querySelector('a.dropdown-item[href*="/user/profile/"]');
    const username = userLink ? userLink.href.match(/profile\/([^/?#]+)/)?.[1] : null;
    if (!username) return;

    const li = document.createElement('li');
    li.className = 'nav-item';
    li.innerHTML = `<a class="nav-link view-submissions" href="/submissions?problem_id=${pid}&submitter=${username}" role="tab">View submissions</a>`;
    nav.appendChild(li);
}

function viewInContestLinks() {
    const alertBox = document.querySelector('.alert.alert-primary');
    if (!alertBox) return;

    const listItems = alertBox.querySelectorAll('ul.uoj-list li a[href*="/contest/"]');
    if (!listItems.length) return;

    const pidMatch = window.location.pathname.match(/\/problem\/(\d+)/);
    if (!pidMatch) return;
    const pid = pidMatch[1];

    listItems.forEach(a => {
        if (a.parentElement.querySelector('a[data-added="true"]')) return;
        const match = a.href.match(/\/contest\/(\d+)(\?v=\d+)?/);
        if (!match) return;
        const cid = match[1];
        const ver = match[2] || '';
        const viewLink = document.createElement('a');
        viewLink.textContent = '[view in contest]';
        viewLink.href = `/contest/${cid}/problem/${pid}${ver}`;
        viewLink.style.marginLeft = '4px';
        viewLink.dataset.added = 'true';
        a.insertAdjacentElement('afterend', viewLink);
    });
}

function addAcTag() {
    if (window.__qoj_fullscore_lock) return;
    window.__qoj_fullscore_lock = true;
    if (window.__qoj_no_ac) return;
    const pid = getProblemId();
    const username = getUsername();
    if (!pid || !username) return;
    try {
        const pid = getProblemId();
        const username = getUsername();
        if (!pid || !username) return;

        const infoRow = document.querySelector('.row.d-flex.justify-content-center');
        if (!infoRow) return;
        if (infoRow.querySelector('.badge-fullscore')) return;

        const totalEl = [...infoRow.querySelectorAll('.badge.badge-secondary')]
            .find(e => e.textContent.includes('Total points'));
        if (!totalEl) return;

        const total = parseFloat(totalEl.textContent.replace(/[^\d.]/g, ''));
        if (isNaN(total)) return;

        fetch(`/submissions?problem_id=${pid}&submitter=${username}&min_score=${total}&max_score=${total}`)
            .then(res => res.text())
            .then(html => {
                const match = html.match(/<td><a href="(\/submission\/\d+)">/);
                if (!match) {
                    window.__qoj_no_ac = true;
                    return;
                }
                const sub = match[1];
                const badge = document.createElement('a');
                badge.className = 'badge badge-success mr-1 badge-fullscore';
                badge.textContent = 'Accepted ✓';
                badge.href = `${sub}`;
                badge.target = '_blank';
                infoRow.appendChild(badge);
                const submitLink = document.querySelector('a.nav-link[href="#tab-submit-answer"]');
                if (!submitLink) return;

                if (submitLink.classList.contains('submit-green')) return;

                submitLink.classList.add('submit-green');

                const style = document.createElement('style');
                style.textContent = `
                        a.nav-link.submit-green {
                            color: #00cc00 !important;
                        }
                        a.nav-link.submit-green:hover {
                            color: #00cc00 !important;
                        }
                    `;
                document.head.appendChild(style);
            })
            .catch(err => console.error('检测满分失败:', err))
            .finally(() => {
                setTimeout(() => { window.__qoj_fullscore_lock = false; }, 100);
            });
    } catch (e) {
        console.error(e);
        window.__qoj_fullscore_lock = false;
    }
}

(function () {
    'use strict';
    // --- 定义主函数 ---
    function main() {
        switchDomain();

        // standings 页面特有功能
        if (isStandingsPage()) {
            addToggleButton();
            // 延迟执行，等待表格渲染完成
            setTimeout(calculateRatings, 500);
        }

        // 其他功能
        backProblem();
        viewSubmissions();
        viewInContestLinks();
        addAcTag();
    }

    // --- 初次执行 ---
    main();

    // --- 使用 MutationObserver 监听 DOM 动态变化 ---
    const observer = new MutationObserver(() => {
        // 检查关键元素是否存在
        const needRun =
            document.querySelector('.alert.alert-primary') || // 可能是 viewInContestLinks 所需
            document.querySelector('ul.nav.nav-tabs') || // viewSubmissions / backProblem
            document.querySelector('.nav-link.dropdown-toggle') || // 登录状态
            document.querySelector('.nav.nav-pills.float-right'); // 游客状态

        if (needRun) {
            observer.disconnect(); // 先断开，防止重复触发
            setTimeout(() => {
                main(); // 稍延迟再执行，确保元素已稳定渲染

                // standings 页面需要额外延迟等待表格渲染
                if (isStandingsPage()) {
                    setTimeout(calculateRatings, 500);
                    setTimeout(calculatePerformance, 500);
                }

                observer.observe(document.body, { childList: true, subtree: true }); // 重新监听
            }, 100);
        }
    });

    // 启动观察器
    observer.observe(document.body, { childList: true, subtree: true });
})();