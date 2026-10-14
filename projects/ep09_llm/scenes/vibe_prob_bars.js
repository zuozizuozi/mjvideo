// 场景「下一个字的概率」：左边半句话，句尾一个空位在闪；右边几根候选词概率条长出来，最高的那个发光、飞进句尾；
// 一轮接一轮，最后加速，句子一个字一个字"长"出来。概率是示意数字，右下角标"示意"。
// 时间：第 0 句出现半句话；第 1 句概率条长出；第 2 句开始挑词（每轮 pick 秒）；第 3 句加速续写。
MJ.scene("vibe_prob_bars", {
  title: "下一个字的概率",
  desc: "半句话 + 候选词概率条，最高的词飞进句尾，一轮轮续写并加速。适合讲大模型逐字生成、预测、概率、投票占比。横屏无口播 Vibe 风格。",
  dark: true,
  music: "ambient_piano",
  design: [1920, 1080],
  params: {
    prompt: "今天天气真",
    rounds: [[["好", 62], ["不错", 21], ["冷", 9], ["热", 5]], [["啊", 48], ["，", 31], ["！", 14]], [["，", 57], ["！", 28], ["。", 10]]],
    more: "适合出去走走，去公园晒晒太阳，顺便买杯咖啡……",
    pick: 1.1,           // 每轮挑词用时（秒）
    note: "示意",
    captionY: 960,
  },
  create(ctx) {
    const { W, H, clamp, mix, E, pr, rng, rr, text, SONG, SONGH, captions, glowText, bgVibe, glowDot, dot, GOLD } = MJ.lib;
    const { sfx } = ctx, P = ctx.params, L = ctx.lines;
    const T = (i) => (L[i] ? L[i].t0 : 0);
    const tShow = T(0), tBars = T(1), tPick = T(2), tAcc = T(3);
    const rounds = P.rounds, NR = rounds.length;
    const roundStart = (r) => tPick + r * P.pick;
    rounds.forEach((_, r) => sfx(roundStart(r) + 0.45, "chime", 0.35));
    sfx(tBars, "shimmer", 0.4); sfx(tAcc, "swell", 0.5);
    const more = [...P.more];
    // 加速续写：第 k 个字出现的时间（越来越快）
    const accT = more.map((_, k) => tAcc + 0.3 + 1.2 * Math.sqrt(k * 0.9));
    more.forEach((_, k) => { if (k % 3 === 0) sfx(accT[k], "tick", 0.12); });
    const R = rng(21);
    const FONT = 72, X0 = 200, Y0 = 430, BX = 1100, BY = 270, ROW = 100, BWMAX = 520;
    const sprite = glowDot(GOLD, 40);

    return (c, u) => {
      bgVibe(c, u);
      // 已经接上的字
      let picked = "";
      for (let r = 0; r < NR; r++) if (u >= roundStart(r) + 0.95) picked += rounds[r][0][0];
      let accN = 0; for (const t of accT) if (u >= t) accN++;
      const sentence = P.prompt + picked + more.slice(0, accN).join("");
      const accK = pr(u, tAcc, 0.8, E.inOut);                       // 加速阶段：概率条淡出，句子可以换行铺开
      const maxW = mix(BX - X0 - 80, W - 2 * X0, accK);
      // 句子（自动换行）
      const showA = pr(u, tShow, 0.6);
      c.save(); c.globalAlpha = showA; c.font = SONG(FONT);
      const rows = []; let row = "";
      for (const ch of sentence) { if (c.measureText(row + ch).width > maxW) { rows.push(row); row = ""; } row += ch; }
      rows.push(row);
      const yTop = Y0 - (rows.length - 1) * 50 * accK;
      rows.forEach((s, i) => {
        const pl = P.prompt.length;
        // 原始半句白色，接上的字金色
        let x = X0, idx = rows.slice(0, i).join("").length;
        for (const ch of s) {
          const gold = idx >= pl; c.font = SONG(FONT);
          glowText(c, ch, x, yTop + i * 100, SONG(FONT), gold ? "#f3c46b" : "#f2efe6", gold ? 16 : 6, gold ? "rgba(255,190,90,0.7)" : "rgba(255,255,255,0.3)");
          x += c.measureText(ch).width; idx++;
        }
      });
      // 句尾空位：闪烁的方框
      c.font = SONG(FONT);
      const lastW = c.measureText(rows[rows.length - 1]).width;
      const slotX = X0 + lastW + 10, slotY = yTop + (rows.length - 1) * 100;
      const blink = 0.45 + 0.4 * Math.cos(u * 5);
      c.globalAlpha = showA * blink;
      rr(c, slotX, slotY - FONT * 0.82, FONT * 0.9, FONT * 1.02, 10); c.strokeStyle = "#f3c46b"; c.lineWidth = 3; c.setLineDash([10, 8]); c.stroke(); c.setLineDash([]);
      c.restore();

      // 概率条
      const barsA = pr(u, tBars, 0.5) * (1 - accK);
      if (barsA > 0.01) {
        let r = 0; while (r < NR - 1 && u >= roundStart(r + 1)) r++;
        const rs = u < tPick ? -99 : roundStart(r);
        const opts = rounds[r];
        const grow = r === 0 ? pr(u, tBars, 0.9, E.out) : pr(u, rs - 0.05, 0.5, E.out);
        c.save(); c.globalAlpha = barsA;
        opts.forEach(([w, p], i) => {
          const y = BY + i * ROW, top = i === 0;
          const sel = top ? pr(u, rs + 0.35, 0.3) : 0;
          const fly = top ? pr(u, rs + 0.6, 0.4, E.inOut) : 0;
          text(c, w, BX, y + 44, SONG(52), top ? "#f3c46b" : "#d8d2c2", "left");
          const bw = BWMAX * p / 100 * grow;
          rr(c, BX + 140, y + 4, BWMAX, 52, 10); c.fillStyle = "rgba(255,255,255,0.05)"; c.fill();
          if (bw > 2) { rr(c, BX + 140, y + 4, bw, 52, 10); c.fillStyle = top ? `rgba(243,196,107,${0.55 + 0.4 * sel})` : "rgba(160,170,200,0.35)"; c.fill(); }
          text(c, `${Math.round(p * grow)}%`, BX + 160 + BWMAX, y + 44, `600 34px Georgia, serif`, top ? "#f3c46b" : "#aaa595", "left");
          if (top && sel > 0) {
            c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = barsA * sel * (1 - fly) * 0.7; dot(c, sprite, BX + 26, y + 30, 1.2); c.restore();
          }
          // 飞向句尾
          if (top && fly > 0 && fly < 1) {
            const fx = mix(BX, slotX, fly), fy = mix(y + 44, slotY, fly) - Math.sin(fly * Math.PI) * 80;
            c.save(); c.globalCompositeOperation = "lighter"; dot(c, sprite, fx + 25, fy - 25, 1.4); c.restore();
            text(c, w, fx, fy, SONG(FONT * mix(0.72, 1, fly)), "#f3c46b", "left");
          }
        });
        c.restore();
        // 右下角"示意"
        c.save(); c.globalAlpha = barsA * 0.55; text(c, P.note, W - 70, H - 40, SONG(24), "#cfc7b0", "right"); c.restore();
      }
      captions(c, L, u, { y: P.captionY });
    };
  },
});
