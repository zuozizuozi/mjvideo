// mjvideo 工作台前端：零依赖，hash 路由（#styles / #scenes / #projects / #project/<名字>）
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const app = $("#app");
let STYLES = [], SCENES = [], GAMES = [];

async function api(path, body) {
  const r = await fetch(path, body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || r.statusText); return j;
}
function toast(msg, err) { const d = document.createElement("div"); d.textContent = msg; if (err) d.className = "err"; $("#toast").append(d); setTimeout(() => d.remove(), err ? 7000 : 3500); }
async function waitJob(id, label) {
  for (;;) {
    const j = await api("/api/job?id=" + id);
    if (j.status === "done") return j;
    if (j.status === "failed") throw new Error(`${label || j.label}失败：\n` + j.out.slice(-600));
    await new Promise((r) => setTimeout(r, 800));
  }
}
async function busy(btn, fn) { btn.disabled = true; const t = btn.textContent; btn.textContent = "处理中…"; try { await fn(); } catch (e) { toast(e.message, true); } finally { btn.disabled = false; btn.textContent = t; } }
const lineHTML = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");

// ---------- 风格 ----------
function viewStyles() {
  app.innerHTML = `<h1>风格包</h1><p class="muted">每套风格用同一组样张画面渲染，方便比较。项目页可以一键套用，套用后还能在 project.json 的 theme 里继续改。风格包是起点，不是终点。</p>
  <div class="grid">${STYLES.map((s) => `<div class="card">
    ${s.preview ? `<img class="media" src="${s.preview}" alt="${esc(s.title)}">` : `<div class="media empty">还没有样张：运行 mjv previews</div>`}
    <div class="body"><h3>${esc(s.title)} <span class="chip code">${esc(s.name)}</span></h3>
      <div class="desc">${esc(s.desc)}</div>
      <div class="chips"><span class="chip">${s.mode === "light" ? "浅底" : "深底"}</span><span class="chip">纹理 ${esc(s.texture)}</span><span class="sw">${s.colors.map((c) => `<i style="background:${esc(c)}" title="${esc(c)}"></i>`).join("")}</span></div>
    </div></div>`).join("")}</div>`;
}

// ---------- 场景库 ----------
function viewScenes(filter = "全部", kw = "") {
  const list = SCENES.filter((s) => (filter === "全部" || s.orientation === filter) && (!kw || (s.name + s.title + s.desc).includes(kw)));
  app.innerHTML = `<h1>场景库</h1><p class="muted">场景是零件：每个演一种画面。颜色跟随项目风格（竖屏的老场景颜色是固定的）。想要库里没有的画面，在项目页对镜头写"需要新画面"，交给 Codex 写。</p>
  <div class="bar"><select id="f">${["全部", "横屏", "竖屏"].map((x) => `<option ${x === filter ? "selected" : ""}>${x}</option>`).join("")}</select>
  <input type="search" id="kw" placeholder="搜索：粒子、概率、图片…" value="${esc(kw)}"> <span class="muted">${list.length} 个</span></div>
  <div class="grid">${list.map((s) => `<div class="card">
    ${s.video ? `<video class="media" src="${s.video}" poster="${s.poster || ""}" muted loop autoplay playsinline></video>` : `<div class="media empty">还没有预览</div>`}
    <div class="body"><h3>${esc(s.title || s.name)}</h3><div class="chips"><span class="chip code">${esc(s.name)}</span><span class="chip">${s.orientation}</span></div>
      <div class="desc">${esc(s.desc)}</div>
      ${s.params.length ? `<div class="chips">${s.params.map((p) => `<span class="chip code">${esc(p)}</span>`).join("")}</div>` : ""}
    </div></div>`).join("")}</div>`;
  $("#f").onchange = (e) => viewScenes(e.target.value, $("#kw").value);
  $("#kw").oninput = (e) => { clearTimeout(viewScenes.t); viewScenes.t = setTimeout(() => { viewScenes(filter, e.target.value); $("#kw").focus(); }, 300); };
}

// ---------- 项目列表 ----------
async function viewProjects() {
  const ps = await api("/api/projects");
  app.innerHTML = `<h1>项目</h1>
  <div class="bar"><input type="text" id="nn" placeholder="新项目名（英文、数字、下划线）">
    <select id="nt"><option value="">无口播（字幕 + 配乐）</option><option value="gameplay">试玩解说（录屏 + 配音）</option></select>
    <select id="ng"><option value="">（试玩解说选游戏）</option>${GAMES.map((g) => `<option value="${g.slug}">${esc(g.name)}</option>`).join("")}</select>
    <select id="ns"><option value="">不套风格包（之后再选）</option>${STYLES.map((s) => `<option value="${s.name}">${esc(s.title)}</option>`).join("")}</select>
    <button class="primary" id="nb">新建项目</button></div>
  <div class="list">${ps.map((p) => `<a class="row" href="#project/${encodeURIComponent(p.name)}"><div><b>${esc(p.title)}</b>
    <div class="chips"><span class="chip code">${esc(p.name)}</span>${p.style ? `<span class="chip">风格 ${esc(p.style)}</span>` : ""}<span class="chip">${p.shots} 个镜头</span>${p.silent ? `<span class="chip">无口播</span>` : `<span class="chip">配音</span>`}${p.output ? `<span class="chip">有成片</span>` : ""}${p.openNotes ? `<span class="chip" style="color:var(--accent)">${p.openNotes} 条意见未处理</span>` : ""}</div></div>
    <div class="muted">${new Date(p.updated).toLocaleString()}</div></a>`).join("") || `<div class="empty">还没有项目</div>`}</div>`;
  $("#nb").onclick = (e) => busy(e.target, async () => { const name = $("#nn").value.trim(); await api("/api/new", { name, style: $("#ns").value, template: $("#nt").value, game: $("#ng").value }); toast("已新建 " + name); location.hash = "#project/" + name; });
}

// ---------- 项目 ----------
function codexPrompt(p) {
  const open = p.notes.filter((n) => n.status !== "done"), ns = open.filter((n) => n.kind === "newscene");
  let s = `用 mjvideo（MCP）继续做项目「${p.name}」（${p.cfg.title || ""}）。\n`;
  if (p.cfg.game || p.footage.length) s += `这是一期试玩解说：先读 mjv_guide doc=gameplay。游戏：${p.cfg.game || "（还没选，先问我）"}，用 mjv_games 读资料。录屏：${p.footage.map((f) => `${f.key}（${f.duration}s）`).join("、") || "还没有"}，看 footage/ 里的分析报告和拼图挑高光。我没给稿子，解说由你写。\n`;
  if (p.cfg.style) s += `风格：${p.cfg.style}（主题已写在 project.json 的 theme，可以按美术方案微调）。\n`;
  if (p.refFiles.length) s += `参考素材在 refs/（${p.refFiles.join("、")}），先读 refs/ref_report.md 和拼图，提炼风格，不要照抄。\n`;
  if (Object.keys(p.cfg.images || {}).length) s += `图片素材已登记在 project.json 的 images：${Object.keys(p.cfg.images).join("、")}。\n`;
  if (open.length) s += `先用 mjv_notes 读工作台里的 ${open.length} 条修改意见，逐条处理，处理完把意见标成已完成。\n`;
  if (ns.length) s += `需要新画面的镜头：${ns.map((n) => `${n.shot || "整体"}（${n.text}）`).join("；")}。新写场景，颜色和字体从主题取。\n`;
  s += `做完用 mjv_stills 出改过镜头的静帧给我看，满意后再渲染。`;
  return s;
}
async function viewProject(name) {
  const p = await api("/api/project?name=" + encodeURIComponent(name)), cfg = p.cfg;
  const scenesBy = (o) => SCENES.filter((s) => s.orientation === o);
  const sceneSelect = (cur) => `<select class="scene">${["横屏", "竖屏"].map((o) => `<optgroup label="${o}">${scenesBy(o).map((s) => `<option value="${s.name}" ${s.name === cur ? "selected" : ""}>${esc(s.title || s.name)}（${s.name}）</option>`).join("")}</optgroup>`).join("")}
    ${SCENES.some((s) => s.name === cur) ? "" : `<optgroup label="项目自带"><option selected value="${esc(cur)}">${esc(cur)}</option></optgroup>`}</select>`;
  const notesOf = (id) => p.notes.filter((n) => (n.shot || "") === id);
  const noteHTML = (n) => `<div class="note ${n.status === "done" ? "done" : ""}"><span class="k">${n.kind === "newscene" ? "新画面" : "修改"}</span><span style="flex:1">${esc(n.text)}</span><button class="mini" data-resolve="${n.id}">${n.status === "done" ? "重开" : "完成"}</button></div>`;
  const para = (id) => p.timeline?.paras.find((x) => x.id === id);
  app.innerHTML = `<a href="#projects" class="muted">← 项目</a><h1>${esc(cfg.title || p.name)}</h1>
  <div class="chips"><span class="chip code">${esc(p.name)}</span><span class="chip">${cfg.format?.width || 1080}×${cfg.format?.height || 1920}</span>${p.timeline ? `<span class="chip">时长 ${p.timeline.total.toFixed(1)}s</span>` : `<span class="chip">还没有时间轴</span>`}</div>
  <div class="bar">风格 <select id="st"><option value="">（${esc(cfg.style || cfg.theme?.name || "自定义 / 默认")}）</option>${STYLES.map((s) => `<option value="${s.name}">${esc(s.title)}</option>`).join("")}</select>
    <button id="sta">套用风格</button>
    游戏 <select id="gm"><option value="">（不是试玩解说）</option>${GAMES.map((g) => `<option value="${g.slug}" ${g.slug === cfg.game ? "selected" : ""}>${esc(g.name)}</option>`).join("")}</select><button id="tl">配音 + 时间轴</button><button class="primary" id="cp">复制给 Codex 的指令</button><button id="rf">刷新</button></div>
  ${p.output ? `<video class="out" src="${p.output}" controls preload="metadata"></video>` : ""}
  <h2>整体意见</h2>${notesOf("").map(noteHTML).join("")}
  <div class="bar"><textarea id="gn" placeholder="对整条视频的意见，例如：节奏再快一点；配乐高潮不明显"></textarea></div><button data-note="">提交整体意见</button>

  <h2>录屏（试玩解说用）</h2>
  <div class="drop" data-kind="footage">把无声录屏拖到这里（mp4 / mov / webm / mkv），自动导入并分析高光</div>
  <p class="guide">长短不限、横竖屏都行。尽量录游戏画面本身（全屏、关掉无关窗口）；同一期可以拖多段。导入后 Codex 会看拼图挑高光、写解说。</p>
  ${p.footage.map((f) => `<details open><summary><b>${esc(f.key)}</b> · ${f.size} · ${f.duration}s · 高光候选 ${f.candidates.length} 段（${f.candidates.map((c) => `${c.start}–${c.end}s`).join("、")}） · <a href="${f.report}" target="_blank">分析报告</a></summary>
    <div class="thumbs">${f.sheets.map((s) => `<figure><a href="${s.url}" target="_blank"><img src="${s.url}"></a>${esc(s.kind)} ${s.from}–${s.to}s</figure>`).join("")}</div></details>`).join("")}

  <h2>素材</h2><div class="two">
    <div><h3>参考素材（学风格用）</h3>
      <div class="drop" data-kind="refs">把参考图 / 参考视频拖到这里，上传后自动分析</div>
      <table class="guide"><tr><td>参考视频</td><td>1–2 条，30 秒到 3 分钟，学节奏和动效；手机录屏先裁掉手机界面</td></tr>
        <tr><td>参考图</td><td>3–6 张同一种风格，学配色、质感、构图</td></tr><tr><td>别忘了</td><td>在"整体意见"里写一句"学它的什么"，例如"学配色，不学字体"</td></tr></table>
      <div class="thumbs">${p.refs.map((r) => `<figure><a href="${r.url}" target="_blank"><img src="${r.url}"></a>${esc(r.name)}</figure>`).join("")}</div>
      ${p.refReport ? `<details><summary>分析报告</summary><pre>${esc(p.refReport)}</pre></details>` : ""}</div>
    <div><h3>图片素材（放进视频里用）</h3>
      <div class="drop" data-kind="assets">把图片拖到这里，自动登记进项目（名字 = 文件名）</div>
      <p class="guide">书封、产品、截图、AI 生成的插画……文件名起好认的，例如 <code>书封.png</code>。AI 生成的记得在意见里注明，画面上要标"示意"。</p>
      <div class="thumbs">${p.assets.map((a) => `<figure><img src="${a.url}">${esc(a.name)}</figure>`).join("")}</div></div>
  </div>
  ${p.design ? `<details><summary>美术方案 design.md</summary><pre>${esc(p.design)}</pre></details>` : ""}

  <h2>镜头（${cfg.shots.length}）</h2>
  ${cfg.shots.map((s) => { const pa = para(s.id); return `<div class="shot" data-id="${esc(s.id)}"><div>
      <div><span class="id">${esc(s.id)}</span> ${esc(s.label || "")} ${pa ? `<span class="muted">${pa.start.toFixed(1)}–${pa.end.toFixed(1)}s</span>` : ""}</div>
      <ul class="lines">${(s.lines || [{ text: s.text }]).map((l) => `<li>${lineHTML(l.text)}</li>`).join("")}</ul>
      <div class="bar">画面 ${sceneSelect(s.scene)}</div>
      ${notesOf(s.id).map(noteHTML).join("")}
      <textarea placeholder="对这个镜头的意见"></textarea>
      <div class="bar"><select class="kind"><option value="change">修改</option><option value="newscene">需要新画面</option></select><button data-note="${esc(s.id)}">提交意见</button></div>
    </div><div>${p.sheets[s.id] ? `<img class="sheet" src="${p.sheets[s.id]}">` : `<div class="empty">还没有静帧</div>`}
      <div class="bar"><button data-stills="${esc(s.id)}">出静帧</button><span class="muted">开头、每句字幕出现后、结尾各一张</span></div></div></div>`; }).join("")}`;

  const reload = () => viewProject(name);
  $("#rf").onclick = reload;
  $("#cp").onclick = async () => { const t = codexPrompt(p); try { await navigator.clipboard.writeText(t); toast("已复制，粘贴到 Codex 就行"); } catch { prompt("复制下面这段：", t); } };
  $("#sta").onclick = (e) => { const v = $("#st").value; if (!v) return toast("先在下拉里选一个风格"); if (!confirm(`套用「${v}」会覆盖项目现在的主题（theme），确定？`)) return; busy(e.target, async () => { await api("/api/style?name=" + encodeURIComponent(name), { style: v }); toast("已套用，出静帧看看效果"); reload(); }); };
  $("#gm").onchange = async (e) => { try { await api("/api/game?name=" + encodeURIComponent(name), { slug: e.target.value }); toast(e.target.value ? "已设为 " + e.target.value : "已清除游戏"); } catch (err) { toast(err.message, true); } };
  $("#tl").onclick = (e) => busy(e.target, async () => { const r = await api("/api/timeline?name=" + encodeURIComponent(name), {}); await waitJob(r.job, "时间轴"); toast("时间轴已生成"); reload(); });
  app.querySelectorAll("select.scene").forEach((sel) => sel.onchange = async () => { const id = sel.closest(".shot").dataset.id; try { await api("/api/shot?name=" + encodeURIComponent(name), { id, scene: sel.value }); toast(`${id} 换成 ${sel.value}。注意参数可能要让 Codex 调整`); } catch (e) { toast(e.message, true); } });
  app.querySelectorAll("[data-stills]").forEach((b) => b.onclick = () => busy(b, async () => { const r = await api("/api/stills?name=" + encodeURIComponent(name), { id: b.dataset.stills }); await waitJob(r.job, "出静帧"); reload(); }));
  app.querySelectorAll("[data-note]").forEach((b) => b.onclick = () => busy(b, async () => {
    const box = b.dataset.note ? b.closest(".shot") : null, ta = box ? $("textarea", box) : $("#gn");
    await api("/api/note?name=" + encodeURIComponent(name), { shot: b.dataset.note, text: ta.value, kind: box ? $(".kind", box).value : "change" }); toast("已记下，Codex 用 mjv_notes 能读到"); reload(); }));
  app.querySelectorAll("[data-resolve]").forEach((b) => b.onclick = () => busy(b, async () => { await api("/api/note?name=" + encodeURIComponent(name), { resolve: b.dataset.resolve }); reload(); }));
  app.querySelectorAll(".drop").forEach((d) => {
    d.ondragover = (e) => { e.preventDefault(); d.classList.add("over"); }; d.ondragleave = () => d.classList.remove("over");
    d.ondrop = async (e) => {
      e.preventDefault(); d.classList.remove("over");
      for (const f of e.dataTransfer.files) {
        d.textContent = `上传 ${f.name}…`;
        try {
          const r = await fetch(`/api/upload?name=${encodeURIComponent(name)}&kind=${d.dataset.kind}&file=${encodeURIComponent(f.name)}`, { method: "POST", body: f }).then((x) => x.json());
          if (r.error) throw new Error(r.error);
          if (r.job) { d.textContent = d.dataset.kind === "footage" ? `导入并分析 ${f.name}（长录屏要等一会儿）…` : `分析 ${f.name}…`; await waitJob(r.job, d.dataset.kind === "footage" ? "导入录屏" : "参考分析"); }
          toast(`${f.name} 已上传${r.key ? `，登记为图片「${r.key}」` : "并分析完"}`);
        } catch (err) { toast(err.message, true); }
      }
      reload();
    };
  });
}

// ---------- 路由 ----------
async function route() {
  const h = location.hash.slice(1) || "styles", [tab, arg] = h.split("/");
  document.querySelectorAll("nav a").forEach((a) => a.classList.toggle("on", a.dataset.tab === (tab === "project" ? "projects" : tab)));
  try {
    if (!STYLES.length) [STYLES, SCENES, GAMES] = await Promise.all([api("/api/styles"), api("/api/scenes"), api("/api/games")]);
    if (tab === "scenes") viewScenes(); else if (tab === "projects") await viewProjects(); else if (tab === "project") await viewProject(decodeURIComponent(arg)); else viewStyles();
  } catch (e) { app.innerHTML = `<div class="empty">出错了：${esc(e.message)}</div>`; }
}
window.onhashchange = route; route();
// 环境检查：有缺的东西就在顶部提醒（例如这台电脑还没装本人音色）
api("/api/doctor").then((rows) => {
  const bad = rows.filter((r) => r.ok !== "ok"); if (!bad.length) return;
  $("#doctor").innerHTML = `<div class="warn">${bad.map((r) => `<div><b>${r.ok === "bad" ? "✗" : "⚠"} ${esc(r.name)}</b>：${esc(r.detail)}${r.fix ? `　→ <code>${esc(r.fix)}</code>` : ""}</div>`).join("")}</div>`;
}).catch(() => {});
