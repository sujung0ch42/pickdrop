(() => {
  "use strict";
  const usernameDomain = "@users.pickdrop.invalid";
  const usernamePattern = /^[a-z0-9_]{3,24}$/;
  const signupGatewayKey =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpiY2theWloYWdkZnV1dWV1a3F6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ5NjcxNjgsImV4cCI6MjExMDU0MzE2OH0.eZt_tn3wqOj3Vzu5X92AVuVMoN98ZjKOmxP__pyKefM";
  const supa = window.supabase.createClient(
    "https://jbckayihagdfuuueukqz.supabase.co",
    "sb_publishable_Om_4Zrkj1OtUxQPQ1rVPtA_MoWL0kUx",
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    },
  );
  const PRESETS = {
    food: {
      label: "음식 고민",
      icon: "IconFood",
      criteria: ["가격", "건강", "땡긴다", "품질"],
    },
    shopping: {
      label: "쇼핑 고민",
      icon: "IconShopping",
      criteria: ["가격", "활용도", "디자인", "품질"],
    },
    leisure: {
      label: "여가 고민",
      icon: "IconPlay",
      criteria: ["비용", "피로도", "재미", "시간"],
    },
    pair: {
      label: "둘 중 하나",
      icon: "IconScale",
      criteria: ["비용", "거리", "효율"],
    },
    custom: { label: "직접 만들기", icon: "IconPlus", criteria: [] },
  };
  const $ = document.getElementById("page"),
    esc = (x) =>
      String(x ?? "").replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[c],
      ),
    id = () => crypto.randomUUID();
  const read = (k, d) => {
      try {
        return JSON.parse(localStorage.getItem("pd_" + k)) ?? d;
      } catch {
        return d;
      }
    },
    save = (k, v) => localStorage.setItem("pd_" + k, JSON.stringify(v));
  let user = null,
    authReady = false,
    authMode = "login",
    authEmail = "",
    authMessage = "",
    pending = false,
    historyError = false,
    pollError = false,
    view = "home",
    step = 1,
    criterionIndex = 0,
    optionIndex = 0,
    compareIds = [],
    draft,
    decision = null,
    poll = null,
    ownedPolls = [],
    pollsLoading = false,
    pollsError = false,
    morePolls = false,
    current = null,
    vote = "",
    ballot = null,
    editingVote = false,
    note = "",
    voter = "",
    votes = [],
    deadline = "",
    records = read("history", []),
    loading = false;
  const fresh = () => ({
    title: "",
    cat: "",
    criteria: [],
    weights: {},
    options: [],
    ratings: {},
    comparisons: {},
  });
  draft = fresh();
  const transitions = {
    inLeft: { transform: "translateX(100%)", duration: 300 },
    inRight: { transform: "translateX(-100%)", duration: 300 },
    dissolve: { opacity: 0, duration: 200 },
    smart: { opacity: 0, duration: 300 },
  };
  let scoreAdvance, statsRefresh, screenAnimation;
  let playIntro = true;
  const reduceMotion = () =>
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  function animate(node, frames, duration, easing = "ease-out") {
    if (!reduceMotion()) return node?.animate?.(frames, { duration, easing });
  }
  const go = (v, transition) => {
    clearTimeout(scoreAdvance);
    clearTimeout(statsRefresh);
    screenAnimation?.cancel();
    const motion = transitions[transition];
    let outgoing;
    if (motion && !reduceMotion() && $.animate && $.firstElementChild) {
      const bounds = $.getBoundingClientRect();
      outgoing = $.cloneNode(true);
      outgoing.removeAttribute("id");
      outgoing
        .querySelectorAll("[id]")
        .forEach((node) => node.removeAttribute("id"));
      outgoing.classList.add("motion-outgoing");
      outgoing.inert = true;
      outgoing.setAttribute("aria-hidden", "true");
      Object.assign(outgoing.style, {
        top: bounds.top + "px",
        left: bounds.left + "px",
        width: bounds.width + "px",
      });
      $.before(outgoing);
    }
    view = v;
    render();
    window.scrollTo(0, 0);
    if (!outgoing) return;
    const { duration, ...start } = motion;
    $.classList.add("motion-incoming");
    const animation = animate(
      $,
      [
        start,
        start.transform ? { transform: "translateX(0)" } : { opacity: 1 },
      ],
      duration,
    );
    screenAnimation = animation;
    const cleanup = () => {
      outgoing.remove();
      if (screenAnimation === animation) $.classList.remove("motion-incoming");
    };
    if (animation) animation.finished.then(cleanup, cleanup);
    else cleanup();
  };
  function changeColors(selector, update, duration) {
    const nodes = [...document.querySelectorAll(selector)];
    const colors = nodes.map((node) => getComputedStyle(node).backgroundColor);
    update();
    document.querySelectorAll(selector).forEach((node, i) => {
      const color = getComputedStyle(node).backgroundColor;
      if (colors[i] && colors[i] !== color)
        animate(
          node,
          [{ backgroundColor: colors[i] }, { backgroundColor: color }],
          duration,
        );
    });
  }
  function changePreset() {
    const previous = [...$.querySelectorAll(".preset")].map((node) => ({
      bounds: node.getBoundingClientRect(),
      color: getComputedStyle(node).backgroundColor,
    }));
    render();
    $.querySelectorAll(".preset").forEach((node, i) => {
      const old = previous[i];
      const bounds = node.getBoundingClientRect();
      if (!old) return;
      const shift = old.bounds.top - bounds.top;
      const color = getComputedStyle(node).backgroundColor;
      if (shift || color !== old.color)
        animate(
          node,
          [
            {
              transform: "translateY(" + shift + "px)",
              backgroundColor: old.color,
            },
            { transform: "translateY(0)", backgroundColor: color },
          ],
          300,
          "ease-in-out",
        );
    });
    animate(
      $.querySelector(".preset-detail"),
      [{ opacity: 0 }, { opacity: 1 }],
      300,
      "ease-in-out",
    );
  }
  function openOverlay(node, duration) {
    node.showModal();
    const offset = window.innerHeight - node.getBoundingClientRect().top;
    animate(
      node,
      [
        { transform: "translateY(" + offset + "px)" },
        { transform: "translateY(0)" },
      ],
      duration,
    );
  }
  const status = document.getElementById("status");
  let toastTimer;
  const toast = (message, kind = "error", motion) => {
    (dialog.open ? dialog : document.body).append(status);
    status.className = kind;
    status.querySelector("span").textContent = message;
    status.hidden = false;
    if (motion === "slide")
      animate(
        status,
        [
          { transform: "translateX(calc(-50% - 100vw))" },
          { transform: "translateX(-50%)" },
        ],
        200,
      );
    if (motion === "fade")
      animate(status, [{ opacity: 0 }, { opacity: 1 }], 200);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      status.hidden = true;
    }, 4500);
  };
  status.querySelector("button").addEventListener("click", () => {
    status.hidden = true;
  });
  const pollLink = (key) => {
    const url = new URL(location.pathname, location.origin);
    url.searchParams.set("poll", key);
    return url;
  };
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const tie = (result) =>
    result.ranking.filter(
      (option) => option.weighted === result.ranking[0].weighted,
    );
  const winner = (result) =>
    result.ranking.find((option) => option.id === result.chosenId) ??
    (result.ranking.length && tie(result).length === 1
      ? result.ranking[0]
      : null);
  const winnerLabel = (result) => winner(result)?.name ?? "공동 1위";
  async function loadHistory(owner) {
    historyError = false;
    const { data, error } = await supa
      .from("decisions")
      .select("id,data")
      .eq("owner_id", owner)
      .order("created_at", { ascending: false })
      .limit(100);
    if (user?.id !== owner) return;
    historyError = Boolean(error);
    if (!error) {
      const unique = new Map();
      for (const row of data) {
        if (!row.data?.ranking?.length) continue;
        const key = row.data.id ?? row.id;
        if (!unique.has(key))
          unique.set(key, { ...row.data, id: key, dbId: row.id });
      }
      records = [...unique.values()];
    }
    if (view === "history") render();
  }
  async function saveDecision(result) {
    const owner = user?.id;
    if (!owner || !result) return false;
    const rowId = result.dbId ?? result.id;
    const { dbId, ...data } = result;
    const { error } = await supa
      .from("decisions")
      .upsert({ id: rowId, owner_id: owner, title: result.title.trim(), data });
    if (user?.id !== owner) return false;
    if (error) {
      toast("선택 기록을 저장하지 못했어요. 결과 화면에서 다시 저장해 주세요.");
      return false;
    }
    await loadHistory(owner);
    return true;
  }
  function rememberGuest(result) {
    if (user) return;
    records = [result, ...records.filter((item) => item.id !== result.id)];
    save("history", records);
  }

  const durations = { 1: "1시간", 12: "12시간", 24: "24시간", 168: "일주일" };
  const palettes = ["pink", "orange", "green", "blue"];
  const icon = (name) =>
    '<img class="icon" src="/assets/img' + name + '.svg" alt="">';
  const action = (label, name, attrs = "", style = "") =>
    '<button type="button" class="button ' +
    style +
    '" data-act="' +
    name +
    '" ' +
    attrs +
    ">" +
    label +
    "</button>";
  const footer = (...buttons) =>
    '<div class="bottom">' + buttons.join("") + "</div>";
  const header = (title, { back = null, stepLabel = "", progress = 0 } = {}) =>
    '<header class="screen-header">' +
    (back
      ? action(icon("IconBack"), back, 'aria-label="뒤로"', "icon-button")
      : "") +
    "<h1>" +
    esc(title) +
    "</h1>" +
    (stepLabel ? "<span>" + esc(stepLabel) + "</span>" : "") +
    "</header>" +
    (progress
      ? '<div class="progress" role="progressbar" aria-valuenow="' +
        progress +
        '"><div style="width:' +
        progress +
        '%"></div></div>'
      : "");
  const input = (label, key, value, placeholder, max) =>
    '<label class="field">' +
    esc(label) +
    '<input data-in="' +
    key +
    '" value="' +
    esc(value) +
    '" placeholder="' +
    esc(placeholder) +
    '" maxlength="' +
    max +
    '"></label>';
  const muted = (value) => '<p class="muted">' + esc(value) + "</p>";
  const validPhoto = (value) =>
    typeof value === "string" &&
    /^data:image\/(?:jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value);
  const color = (option, index) =>
    palettes.includes(option.color)
      ? option.color
      : palettes[index % palettes.length];
  function card(
    option,
    index,
    { act, selected = false, add = false, large = false } = {},
  ) {
    const cls =
      "card " +
      color(option, index) +
      (selected ? " selected" : "") +
      (add ? " add" : "") +
      (large ? " large" : "");
    const content =
      (validPhoto(option.photo)
        ? '<img class="candidate-photo" src="' + option.photo + '" alt="">'
        : !add && !option.name?.startsWith("+ ")
          ? '<div class="candidate-photo candidate-placeholder" aria-hidden="true"><img src="/assets/imgPickdrop.svg" alt=""></div>'
          : "") +
      "<span>" +
      esc(option.label ?? option.name) +
      "</span>";
    return act
      ? '<button type="button" class="' +
          cls +
          '" data-act="' +
          act +
          '" data-i="' +
          index +
          '"' +
          (act === "voteselect" ? ' aria-pressed="' + selected + '"' : "") +
          ">" +
          content +
          "</button>"
      : '<div class="' + cls + '">' + content + "</div>";
  }
  const addCard = (index, name = "+ 추가하기", blank = true, tint = "pink") =>
    card({ name, color: tint }, index, { act: "candidate", add: blank });
  const rankList = (options) =>
    '<ol class="ranks">' +
    options
      .map(
        ({ rank, label, name, detail }) =>
          "<li><span>" +
          rank +
          "위</span>" +
          esc(label ?? name) +
          (detail ? " " + esc(detail) : "") +
          "</li>",
      )
      .join("") +
    "</ol>";
  const pick = (
    option,
    index,
    caption = "",
    summary = option.name ?? option.label,
  ) =>
    '<div class="winner"><div class="pick-card">' +
    card(option, index) +
    '<span class="stamp">Pick!</span></div>' +
    '<div class="winner-name"><small>PICKDROP</small>' +
    (caption ? "<small>" + caption + "</small>" : "") +
    "<strong>" +
    esc(summary) +
    "</strong></div></div>";
  const optionsReady = () =>
    draft.options.length >= 2 &&
    draft.options.every((option) => option.name.trim());
  const pollReady = () =>
    Boolean(draft.title.trim() && optionsReady() && deadline);
  const descriptor = () =>
    [PRESETS[draft.cat]?.label, draft.title].filter(Boolean).join(" · ");

  function home() {
    const intro = playIntro ? " intro" : "";
    playIntro = false;
    const logo = [1, 2, 3, 4, 5]
      .map(
        (n) =>
          '<img src="/assets/imgColor' +
          n +
          '.svg" alt="" style="--intro-offset:' +
          (268.3125 - (n - 1) * 52.0625) +
          'px">',
      )
      .join("");
    return (
      '<div class="home"><div class="logo-stack' +
      intro +
      '" aria-hidden="true">' +
      logo +
      '</div><img class="wordmark" src="/assets/imgPickdrop.svg" alt="PICKDROP">' +
      '<div class="home-actions">' +
      action(
        icon("IconPerson") +
          "<span>나 혼자 결정하기</span><small>고민되는 선택지를 하나씩<br>비교해 보세요</small>",
        "start",
        "",
        "home-button",
      ) +
      action(
        icon("Group") +
          "<span>친구에게 물어보기</span><small>친구들의 의견을 모아<br>결정해 보세요</small>",
        "friend",
        "",
        "home-button",
      ) +
      "</div>" +
      '<div class="home-account">' +
      action(
        authReady && user ? "마이페이지" : "로그인",
        "account",
        authReady ? "" : "disabled",
        "text-button",
      ) +
      action("선택 기록", "history", "", "text-button") +
      "</div></div>"
    );
  }

  function one() {
    const choices = Object.entries(PRESETS)
      .map(([key, entry]) => {
        const active = key === draft.cat;
        const chips = draft.criteria
          .map(
            (criterion, index) =>
              '<span class="criterion"><button type="button" data-act="criterion" data-i="' +
              index +
              '">' +
              esc(criterion) +
              '</button><button type="button" aria-label="' +
              esc(criterion) +
              ' 삭제" data-act="criteria-remove" data-i="' +
              index +
              '">×</button></span>',
          )
          .join("");
        const additions = entry.criteria.find(
          (name) => !draft.criteria.includes(name),
        );
        return (
          '<div class="preset' +
          (active ? " active" : "") +
          '">' +
          action(
            icon(entry.icon) + esc(entry.label),
            "cat",
            'data-val="' + key + '" aria-pressed="' + active + '"',
            "preset-button",
          ) +
          (active
            ? '<div class="preset-detail"><p>비교할 기준 ' +
              (key === "custom" ? "만들기" : "선택하기") +
              ' · 수정하기</p><div class="chips">' +
              chips +
              (draft.criteria.length < 6
                ? action(
                    "+ " + esc(additions ?? "기준"),
                    "criterion",
                    'data-suggestion="' + esc(additions ?? "") + '"',
                    "chip dashed",
                  )
                : "") +
              "</div></div>"
            : "") +
          "</div>"
        );
      })
      .join("");
    return (
      header("새 고민", { back: "home", stepLabel: "1/4", progress: 25 }) +
      input(
        "무엇을 고민하나요? (선택)",
        "title",
        draft.title,
        "고민을 입력하세요!",
        100,
      ) +
      '<h2 class="form-heading">양식 고르기 (필수)</h2><div class="presets">' +
      choices +
      "</div>" +
      footer(
        action(
          "다음",
          "next",
          draft.cat && draft.criteria.length ? "" : "disabled",
        ),
      )
    );
  }

  function two() {
    const pair = draft.cat === "pair";
    const candidates = draft.options
      .map((option, index) =>
        option.name
          ? card(option, index, { act: "candidate" })
          : addCard(index, "+ 후보 넣기", false, index ? "blue" : "pink"),
      )
      .join("");
    return (
      header("후보 넣기", {
        back: "back",
        stepLabel: pair ? "2/5" : "2/4",
        progress: 50,
      }) +
      (pair
        ? "<h2>둘 중 하나는 후보가 딱 2개예요!</h2>" +
          muted("카드를 눌러 이름과 사진을 바꿔요. 후보 추가 칸은 없어요.")
        : muted(descriptor())) +
      '<div class="card-grid' +
      (pair ? " pair-grid" : "") +
      '">' +
      candidates +
      (!pair && draft.options.length < 4 ? addCard(draft.options.length) : "") +
      "</div>" +
      footer(action("다음", "next", optionsReady() ? "" : "disabled"))
    );
  }

  function scale(value, act, pair = false) {
    return (
      '<div class="scale' +
      (pair ? " pair-scale" : "") +
      '">' +
      [1, 2, 3, 4, 5]
        .map((n) =>
          action(
            pair ? "" : String(n),
            act,
            'data-n="' +
              n +
              '" aria-label="' +
              (pair
                ? [
                    "왼쪽이 훨씬 나아요",
                    "왼쪽이 더 나아요",
                    "비슷해요",
                    "오른쪽이 더 나아요",
                    "오른쪽이 훨씬 나아요",
                  ][n - 1]
                : n + "점") +
              '" aria-pressed="' +
              (value === n) +
              '"',
            "dot dot-" + n,
          ),
        )
        .join("") +
      "</div>"
    );
  }
  const scoreKey = () =>
    draft.options[optionIndex].id + "|" + draft.criteria[criterionIndex];
  function four() {
    const pair = draft.cat === "pair";
    const criterion = draft.criteria[criterionIndex];
    const selected = pair
      ? draft.comparisons[criterion]
      : draft.ratings[scoreKey()];
    return (
      header("점수 매기기", {
        back: "back",
        stepLabel: pair
          ? criterionIndex + 2 + "/" + (draft.criteria.length + 3)
          : "3/4",
        progress: 75,
      }) +
      '<h2>이번 기준은?</h2><h3 class="score-heading">' +
      esc(criterion) +
      "!</h3>" +
      (pair
        ? muted("기준 중심으로, 더 나은 선택지를 고르세요") +
          '<div class="card-grid pair-grid scoring">' +
          draft.options.map((option, i) => card(option, i)).join("") +
          "</div>"
        : '<div class="score-window"><div class="score-cards" style="--index:' +
          optionIndex +
          '">' +
          draft.options
            .map((option, i) => card(option, i, { large: true }))
            .join("") +
          "</div></div>") +
      scale(selected, "score", pair) +
      footer(
        action(
          "다음",
          "next",
          selected && (pair || optionIndex === draft.options.length - 1)
            ? ""
            : "disabled",
        ),
      )
    );
  }

  function pairScoreSummary(result, chosen, runnerUp) {
    const difference = Math.abs(chosen.weighted - runnerUp.weighted);
    const comparisons = result.comparisons ?? {};
    const side = result.options[0]?.id === chosen.id ? -1 : 1;
    let strongest;
    let advantage = 0;
    for (const criterion of result.criteria ?? []) {
      const score = comparisons[criterion];
      if (!Number.isFinite(score)) continue;
      const gap = side * (2 * score - 6) * (result.weights?.[criterion] ?? 3);
      if (gap > advantage) {
        advantage = gap;
        strongest = criterion;
      }
    }
    const description =
      difference === 1
        ? "‘" + chosen.name + "’의 아슬아슬한 승리!"
        : strongest
          ? "‘" +
            chosen.name +
            "’ 선택지가 ‘" +
            strongest +
            "’ 기준에서 많이 앞섰어요!"
          : "";
    return (
      '<section class="pair-summary"><h2>점수 차이는?</h2><h3>' +
      difference +
      "점!</h3>" +
      (description ? muted(description) : "") +
      "</section>"
    );
  }

  function result() {
    if (!decision)
      return header("결과가 나왔어요") + footer(action("홈으로", "home"));
    const chosen = winner(decision);
    const tied = tie(decision);
    const index = (option) =>
      Math.max(
        0,
        decision.options.findIndex((entry) => entry.id === option.id),
      );
    const ranks = decision.ranking.filter((option) =>
      chosen ? option.id !== chosen.id : !tied.includes(option),
    );
    const pair = decision.category === "pair";
    return (
      header("결과가 나왔어요", { stepLabel: "4/4", progress: 100 }) +
      ('<div class="result-caption">' +
        muted("나의 선택은...") +
        action("결과 저장", "save", "", "text-button") +
        "</div>") +
      (!chosen
        ? '<h2>공동 1등이에요!</h2><div class="winner ties">' +
          tied.map((option) => card(option, index(option))).join("") +
          "</div>"
        : pair
          ? '<div class="winner pair-winner"><div class="pick-card">' +
            card(chosen, index(chosen), { large: true }) +
            '<span class="stamp">Pick!</span></div>' +
            ranks.map((option) => card(option, index(option))).join("") +
            "</div>"
          : pick(chosen, index(chosen), "1위", chosen.weighted + "점")) +
      (!pair
        ? '<section class="result-ranks"><h2>다른 후보 순위</h2>' +
          muted("다음 기회에") +
          rankList(
            ranks.map((option, i) => ({
              ...option,
              rank: i + 2,
              detail: "(" + option.weighted + "점)",
            })),
          ) +
          "</section>"
        : chosen && ranks.length
          ? pairScoreSummary(decision, chosen, ranks[0])
          : "") +
      footer(
        '<div class="split">' +
          action(
            chosen ? "다시 뽑기" : "두 개만 비교하기",
            chosen ? "rescore" : "compare-tie",
            "",
            "secondary",
          ) +
          action("새 고민", "start") +
          "</div>",
        action("친구에게도 물어보기 →", "makepoll", "", "text-button"),
      )
    );
  }

  function setup() {
    return (
      header("친구에게 물어보기", {
        back: "setup-back",
        stepLabel: "1/2",
        progress: 50,
      }) +
      input(
        "무엇을 물어볼까요?",
        "title",
        draft.title,
        "투표 제목을 입력하세요!",
        100,
      ) +
      '<h2 class="form-heading">후보 넣기</h2><div class="card-strip poll-options">' +
      (draft.options.length < 4 ? addCard(draft.options.length) : "") +
      draft.options
        .map((option, i) => card(option, i, { act: "candidate" }))
        .join("") +
      "</div>" +
      '<h2 class="deadline-label">투표 마감</h2><div class="chips">' +
      Object.entries(durations)
        .map(([hours, label]) =>
          action(
            label,
            "deadline",
            'data-val="' +
              hours +
              '" aria-pressed="' +
              (deadline === hours) +
              '"',
            "chip",
          ),
        )
        .join("") +
      "</div>" +
      footer(
        action(
          "투표 링크 만들기",
          user ? "createpoll" : "loginpoll",
          pollReady() ? "" : "disabled",
        ),
        user
          ? ""
          : action(
              "이 기기에서 미리 보기",
              "createpoll",
              pollReady() ? "" : "hidden",
              "text-button",
            ),
      )
    );
  }
  const linkbox = () =>
    '<div class="link-box"><input aria-label="투표 링크" readonly value="' +
    esc(pollLink(poll.id).href) +
    '">' +
    action(
      icon("Group1"),
      "copy",
      'aria-label="투표 링크 복사"',
      "icon-button",
    ) +
    "</div>";
  const symbol = (value) =>
    icon(value === "✓" ? "ShareSuccess" : "SharePending");
  function share() {
    return (
      header("링크가 생성되었어요", {
        back: "setup-back",
        stepLabel: "2/2",
        progress: 100,
      }) +
      '<section class="share-message">' +
      symbol("✓") +
      "<h2>친구에게 공유하세요</h2>" +
      muted(
        poll.demo
          ? "이 기기에서만 열리는 미리보기 링크예요"
          : "로그인 없이 링크만 누르면 투표할 수 있어요",
      ) +
      "</section>" +
      linkbox() +
      footer(
        action("결과 확인하기", "stats"),
        poll.demo
          ? action("투표 화면 미리 보기", "visit", "", "text-button")
          : "",
      )
    );
  }
  function publicvote() {
    if (loading)
      return header("투표") + '<p class="center">투표를 불러오는 중...</p>';
    if (pollError)
      return (
        header("투표") +
        '<p class="center">투표를 불러오지 못했어요.</p>' +
        footer(action("다시 시도", "retryvote"))
      );
    if (!current)
      return (
        header("투표") +
        '<p class="center">투표를 찾을 수 없습니다.</p>' +
        footer(action("홈으로", "home"))
      );
    const closed = new Date(current.expires_at) <= new Date();
    const voted = ballot?.option_id ?? read("voted_" + current.id, false);
    if (voted && (!editingVote || closed)) {
      const selected = current.options.find((option) => option.id === voted);
      const counts = current.demo
        ? tally(read("votes", {})[current.id] ?? [])
        : ballot?.counts;
      const ranks = counts ? pollRanks(current, counts) : [];
      return (
        header("투표 완료!", { progress: 100 }) +
        (selected
          ? muted("내가 고른 후보") +
            pick(selected, current.options.indexOf(selected))
          : muted("의견을 전달했어요.")) +
        (ranks.length
          ? '<section class="result-ranks guest-ranks"><h2>전체 후보 순위</h2>' +
            muted(closed ? "투표가 종료됐어요" : "투표는 진행 중!") +
            rankList(ranks) +
            "</section>"
          : "") +
        (ballot?.note
          ? '<section class="result-ranks own-note"><h2>내가 남긴 훈수</h2>' +
            muted(ballot.note) +
            "</section>"
          : "") +
        footer(
          ballot && !closed
            ? action("투표·훈수 수정", "edit-vote", "", "secondary")
            : "",
          action("나도 고민 올리기", "home"),
        )
      );
    }
    if (closed)
      return (
        header("투표 종료!") +
        muted("마감된 투표예요.") +
        footer(action("홈으로", "home"))
      );
    return (
      header(
        editingVote
          ? "내 투표 수정"
          : current.owner_name
            ? current.owner_name + " 님의 고민"
            : "친구의 고민",
        { progress: 50, back: editingVote ? "cancel-vote" : null },
      ) +
      '<h3 class="poll-topic">' +
      esc(current.topic) +
      '</h3><p class="photo-help">옆으로 넘기면서 확인해요 · 사진을 클릭하면 크게 보여요</p>' +
      '<div class="card-strip guest-options">' +
      current.options
        .map(
          (option, i) =>
            '<div class="guest-card">' +
            card(option, i, {
              act: "voteselect",
              selected: vote === option.id,
            }) +
            (validPhoto(option.photo)
              ? action(
                  "",
                  "photo",
                  'data-i="' +
                    i +
                    '" aria-label="' +
                    esc(option.label) +
                    ' 사진 크게 보기"',
                  "photo-target",
                )
              : "") +
            "</div>",
        )
        .join("") +
      "</div>" +
      (current.show_my_result && current.owner_winner
        ? muted("친구의 선택 · " + current.owner_winner)
        : "") +
      input("나의 훈수 (선택)", "note", note, "크흠...", 200) +
      input("닉네임 (선택)", "voter", voter, "익명의 외계인", 30) +
      footer(
        action(
          editingVote ? "수정 저장하기" : "투표하기",
          "cast",
          vote ? "" : "disabled",
        ),
      )
    );
  }
  function tally(entries) {
    return entries.reduce((counts, entry) => {
      counts[entry.option_id] = (counts[entry.option_id] ?? 0) + 1;
      return counts;
    }, Object.create(null));
  }
  function pollRanks(item, counts) {
    let previous = -1,
      rank = 0;
    return item.options
      .map((option, i) => ({
        ...option,
        index: i,
        count: Number(counts[option.id]) || 0,
      }))
      .sort((a, b) => b.count - a.count)
      .map((option, i) => {
        if (option.count !== previous) rank = i + 1;
        previous = option.count;
        return { ...option, rank };
      });
  }
  function stats() {
    const ended = new Date(poll.expires_at) <= new Date();
    const ranked = pollRanks(poll, tally(votes));
    const top = ranked.filter((option) => option.rank === 1 && option.count);
    const notes = action(
      "친구들이 둔 훈수와 선택지 확인하기 " + icon("IconNext"),
      "notes",
      "",
      "inbox-button",
    );
    const intro =
      '<section class="share-message' +
      (votes.length ? "" : " no-votes") +
      '">' +
      symbol("!") +
      "<h2>" +
      (votes.length
        ? "친구에게 공유하세요"
        : ended
          ? "받은 투표가 없어요"
          : "아직 투표한 사람이 없어요") +
      "</h2>" +
      muted(
        votes.length
          ? "로그인 없이 링크만 누르면 투표할 수 있어요"
          : "투표 링크를 복사해 친구에게 공유하세요!",
      ) +
      "</section>";
    return (
      header(ended ? "투표 종료!" : "아직 진행 중이에요", {
        back: poll.demo ? null : "my-polls",
      }) +
      (poll.demo
        ? ""
        : '<p class="owned-poll-topic">' + esc(poll.topic) + "</p>") +
      (ended && top.length
        ? muted("우리의 선택은...") +
          (top.length === 1
            ? pick(
                top[0],
                top[0].index,
                "1위",
                top[0].label + " (" + top[0].count + "표)",
              )
            : '<div class="winner ties">' +
              top.map((o) => card(o, o.index)).join("") +
              "</div>") +
          '<section class="result-ranks"><h2>다른 후보 순위</h2>' +
          muted("다음 기회에") +
          rankList(
            ranked
              .filter((o) => o.rank > 1)
              .map((o) => ({ ...o, detail: "(" + o.count + "표)" })),
          ) +
          "</section>" +
          notes
        : intro +
          linkbox() +
          (votes.length
            ? notes +
              '<section class="result-ranks"><h2>지금까지 투표 (' +
              votes.length +
              "명)</h2>" +
              rankList(ranked) +
              "</section>"
            : "")) +
      footer(
        '<div class="split">' +
          action(
            ended ? "결과 공유하기" : "공유하기",
            ended ? "copy-results" : "copy",
            "",
            "secondary",
          ) +
          action("새 고민", "start") +
          "</div>",
        ended && !poll.demo
          ? action("투표 링크 복사", "copy", "", "text-button")
          : "",
      )
    );
  }
  function inbox() {
    return (
      header("쪽지함", { back: "stats" }) +
      muted("친구들의 픽을 확인하세요!") +
      '<div class="notes">' +
      votes
        .map((entry) => {
          const index = poll.options.findIndex((o) => o.id === entry.option_id);
          const option = poll.options[index];
          return (
            '<article class="' +
            color(option ?? {}, Math.max(index, 0)) +
            '">' +
            (entry.note ? "<p>" + esc(entry.note) + "</p>" : "") +
            "<footer><span>" +
            esc(entry.voter_name || "익명") +
            "</span><span>" +
            esc(option?.label ?? "") +
            "</span></footer></article>"
          );
        })
        .join("") +
      "</div>" +
      footer(action("공유하기", "copy", "", "secondary"))
    );
  }
  const authRedirect = () => location.origin + location.pathname;
  function authForm() {
    const isSignup = authMode === "signup";
    const isReset = authMode === "reset";
    const isRecovery = authMode === "recovery";
    const isLogin = authMode === "login";
    const title = isSignup
      ? "회원가입"
      : isReset
        ? "비밀번호 찾기"
        : isRecovery
          ? "새 비밀번호 설정"
          : "로그인";
    const submit = isReset
      ? "재설정 이메일 보내기"
      : isRecovery
        ? "비밀번호 변경"
        : title;
    return (
      header(title, {
        back: isLogin ? "home" : isRecovery ? null : "auth-login",
      }) +
      (isSignup
        ? muted(
            "아이디와 비밀번호를 정하면 바로 시작할 수 있어요. 아이디 계정은 이메일로 비밀번호를 찾을 수 없으니 비밀번호를 기억해 주세요.",
          )
        : isReset
          ? muted(
              "이메일 계정만 재설정할 수 있어요. 가입한 이메일로 링크를 보내드려요.",
            )
          : "") +
      (authMessage
        ? '<p class="auth-message" role="status">' + esc(authMessage) + "</p>"
        : "") +
      '<form class="auth-form">' +
      (isRecovery
        ? ""
        : '<label class="field">' +
          (isSignup ? "아이디" : isReset ? "이메일" : "아이디 또는 이메일") +
          '<input name="email" type="' +
          (isReset ? "email" : "text") +
          '" value="' +
          esc(authEmail) +
          '" autocomplete="username"' +
          (isReset ? ' inputmode="email"' : "") +
          (isSignup
            ? ' placeholder="영문 소문자·숫자·밑줄 3~24자" minlength="3" maxlength="24"'
            : "") +
          ' autocapitalize="off" spellcheck="false" required></label>') +
      (isReset
        ? ""
        : '<label class="field">' +
          (isRecovery ? "새 비밀번호" : "비밀번호") +
          '<input name="password" type="password" autocomplete="' +
          (isLogin ? "current-password" : "new-password") +
          '"' +
          (isLogin ? "" : ' minlength="8" placeholder="8자 이상"') +
          " required></label>") +
      (isRecovery
        ? '<label class="field">새 비밀번호 확인<input name="passwordConfirm" type="password" autocomplete="new-password" minlength="8" required></label>'
        : "") +
      '<button class="button" type="submit"' +
      (authReady ? "" : " disabled") +
      ">" +
      submit +
      "</button></form>" +
      (isLogin
        ? '<div class="auth-links">' +
          action("회원가입", "auth-signup", "", "text-button") +
          action("비밀번호 찾기", "auth-reset", "", "text-button") +
          "</div>" +
          action(
            "Google로 계속하기",
            "login",
            authReady ? "" : "disabled",
            "secondary",
          )
        : isRecovery
          ? action("취소하고 로그아웃", "logout", "", "text-button")
          : "")
    );
  }
  function account() {
    if (!user || authMode === "recovery") return authForm();
    return (
      header("마이페이지", { back: "home" }) +
      muted(
        user.email?.endsWith(usernameDomain)
          ? user.email.slice(0, -usernameDomain.length)
          : user.email,
      ) +
      '<div class="account-actions">' +
      action("내 선택 기록", "history") +
      action("내가 만든 투표", "my-polls", "", "secondary") +
      action("로그아웃", "logout", "", "secondary") +
      "</div>"
    );
  }
  function openAuth(mode, message = "") {
    authEmail =
      $.querySelector(".auth-form [name=email]")?.value.trim() ?? authEmail;
    if (
      (mode === "signup" && authEmail.includes("@")) ||
      (mode === "reset" && !authEmail.includes("@"))
    )
      authEmail = "";
    authMode = mode;
    authMessage = message;
    go("account");
  }
  function showAuthError(error, mode) {
    const message = {
      invalid_credentials: "아이디·이메일 또는 비밀번호를 확인해 주세요.",
      email_not_confirmed: "먼저 가입 확인 이메일의 링크를 열어 주세요.",
      weak_password: "더 안전한 비밀번호를 사용해 주세요.",
      over_email_send_rate_limit:
        "이메일 전송 횟수를 초과했어요. 잠시 후 다시 시도해 주세요.",
      same_password: "이전과 다른 새 비밀번호를 입력해 주세요.",
      validation_failed: "이메일 주소 또는 입력한 내용을 확인해 주세요.",
    }[error.code];
    const fallback =
      mode === "login"
        ? "로그인하지 못했어요. 잠시 후 다시 시도해 주세요."
        : mode === "recovery"
          ? "비밀번호를 변경하지 못했어요. 재설정 링크를 다시 요청해 주세요."
          : "이메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요.";
    toast(message ?? fallback);
  }
  $.addEventListener("submit", async (event) => {
    const form = event.target;
    if (!form.matches(".auth-form")) return;
    event.preventDefault();
    if (!authReady || pending) return;
    const fields = new FormData(form);
    const mode = authMode;
    const email = String(fields.get("email") ?? "").trim();
    const password = String(fields.get("password") ?? "");
    if (mode === "recovery" && password !== fields.get("passwordConfirm")) {
      return toast("두 비밀번호가 일치하는지 확인해 주세요.");
    }
    authEmail = email;
    pending = true;
    const submit = form.querySelector("button[type=submit]");
    submit.disabled = true;
    status.hidden = true;
    try {
      if (mode === "login") {
        const accountEmail = email.includes("@")
          ? email
          : email.toLowerCase() + usernameDomain;
        const { error } = await supa.auth.signInWithPassword({
          email: accountEmail,
          password,
        });
        if (error) return showAuthError(error, mode);
      } else if (mode === "signup") {
        const username = email.toLowerCase();
        if (!usernamePattern.test(username))
          return toast(
            "아이디는 영문 소문자·숫자·밑줄로 3~24자를 입력해 주세요.",
          );
        if (
          password.length < 8 ||
          new TextEncoder().encode(password).length > 72
        )
          return toast("비밀번호를 8자 이상, 72바이트 이하로 입력해 주세요.");
        const { data, error } = await supa.functions.invoke("pickdrop-signup", {
          headers: { Authorization: "Bearer " + signupGatewayKey },
          body: { username, password },
        });
        if (!data?.created || error) {
          const problem = await error?.context?.json?.().catch(() => null);
          return toast(
            {
              username_taken: "이미 사용 중인 아이디예요.",
              weak_password: "더 안전한 비밀번호를 사용해 주세요.",
              rate_limited: "가입 요청이 많아요. 잠시 후 다시 시도해 주세요.",
            }[problem?.error] ??
              "가입을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.",
          );
        }
        const login = await supa.auth.signInWithPassword({
          email: username + usernameDomain,
          password,
        });
        if (login.error)
          openAuth(
            "login",
            "가입했어요. 방금 만든 아이디와 비밀번호로 로그인해 주세요.",
          );
      } else if (mode === "reset") {
        const { error } = await supa.auth.resetPasswordForEmail(email, {
          redirectTo: authRedirect(),
        });
        if (error) return showAuthError(error, mode);
        openAuth("login", "가입된 주소라면 비밀번호 재설정 이메일이 도착해요.");
      } else if (mode === "recovery" && user) {
        const { error } = await supa.auth.updateUser({ password });
        if (error) return showAuthError(error, mode);
        openAuth("login");
        toast("비밀번호를 변경했어요.", "success");
      }
    } catch {
      toast("요청을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      pending = false;
      submit.disabled = false;
    }
  });
  const pollDeadlineFormat = new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const pollsPageSize = 20;

  function pollsPage() {
    const rows = ownedPolls
      .map((item) => {
        const ended = new Date(item.expires_at) <= new Date();
        return action(
          '<span class="poll-row"><strong>' +
            esc(item.topic) +
            "</strong><small>" +
            esc(pollDeadlineFormat.format(new Date(item.expires_at))) +
            " 마감</small></span>" +
            '<span class="poll-state' +
            (ended ? " ended" : "") +
            '">' +
            (ended ? "마감" : "진행 중") +
            "</span>",
          "open-poll",
          'data-id="' + esc(item.id) + '"',
          "secondary poll-list-item",
        );
      })
      .join("");
    return (
      header("내가 만든 투표", { back: "account" }) +
      (rows ? '<div class="poll-list">' + rows + "</div>" : "") +
      (pollsLoading
        ? '<p class="muted" role="status">투표를 불러오는 중이에요…</p>'
        : pollsError
          ? muted("투표 목록을 불러오지 못했어요.") +
            action(
              "다시 시도",
              ownedPolls.length ? "more-polls" : "my-polls",
              "",
              "secondary",
            )
          : !rows
            ? muted("아직 만든 투표가 없어요.")
            : morePolls
              ? action("더 보기", "more-polls", "", "secondary more-polls")
              : "") +
      footer(action("새 투표 만들기", "friend"))
    );
  }

  async function loadOwnedPolls(append = false) {
    const owner = user?.id;
    if (!owner) return go("account");
    if (!append) {
      ownedPolls = [];
      morePolls = false;
    }
    pollsLoading = true;
    pollsError = false;
    if (append) render();
    else go("polls");
    let query = supa
      .from("polls")
      .select("id,topic,created_at,expires_at")
      .eq("owner_id", owner)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
    const cursor = append ? ownedPolls.at(-1) : null;
    if (cursor)
      query = query.or(
        "created_at.lt." +
          cursor.created_at +
          ",and(created_at.eq." +
          cursor.created_at +
          ",id.lt." +
          cursor.id +
          ")",
      );
    const { data, error } = await query.limit(pollsPageSize + 1);
    if (user?.id !== owner || view !== "polls") return;
    pollsLoading = false;
    pollsError = Boolean(error);
    if (!error) {
      ownedPolls = [...ownedPolls, ...data.slice(0, pollsPageSize)];
      morePolls = data.length > pollsPageSize;
    }
    render();
  }

  async function openOwnedPoll(key) {
    const owner = user?.id;
    if (!owner || !uuid.test(key)) return;
    const { data, error } = await supa
      .from("polls")
      .select("id,topic,options,expires_at")
      .eq("id", key)
      .eq("owner_id", owner)
      .maybeSingle();
    if (user?.id !== owner || view !== "polls") return;
    if (error) return toast("투표를 열지 못했어요. 다시 시도해 주세요.");
    if (!data) {
      ownedPolls = ownedPolls.filter((item) => item.id !== key);
      render();
      return toast("이 투표를 찾을 수 없어요.");
    }
    poll = { ...data, demo: false };
    await statsLoad();
  }

  function historypage() {
    return (
      header("내 선택 기록", { back: "home" }) +
      (historyError
        ? muted("기록을 불러오지 못했어요.") +
          action("다시 불러오기", "reloadhistory", "", "secondary")
        : "") +
      (records.length
        ? '<div class="history-list">' +
          records
            .map((record, index) =>
              action(
                "<span>" +
                  esc(record.title) +
                  "</span><small>" +
                  esc(winnerLabel(record)) +
                  "</small>",
                "openhistory",
                'data-i="' + index + '"',
                "secondary",
              ),
            )
            .join("") +
          "</div>"
        : muted("아직 기록이 없어요.")) +
      footer(action("새 고민", "start"))
    );
  }
  function render() {
    $.className = "page " + view;
    $.innerHTML = {
      home,
      result,
      setup,
      share,
      vote: publicvote,
      stats,
      notes: inbox,
      account,
      polls: pollsPage,
      history: historypage,
      wizard: () => [one, two, four][step - 1](),
    }[view]();
  }
  async function done() {
    const pair = draft.cat === "pair";
    const sum = draft.criteria.reduce(
      (total, criterion) => total + (draft.weights[criterion] ?? 3),
      0,
    );
    const ranking = draft.options
      .map((option, index) => {
        const weighted = draft.criteria.reduce((total, criterion) => {
          const value = pair
            ? index === 0
              ? 6 - draft.comparisons[criterion]
              : draft.comparisons[criterion]
            : draft.ratings[option.id + "|" + criterion];
          return total + value * (draft.weights[criterion] ?? 3);
        }, 0);
        return {
          ...option,
          weighted,
          score: Math.round((weighted / (sum * 5)) * 100),
        };
      })
      .sort((a, b) => b.weighted - a.weighted);
    decision = {
      id: id(),
      title: draft.title.trim() || PRESETS[draft.cat].label,
      category: draft.cat,
      criteria: [...draft.criteria],
      weights: { ...draft.weights },
      options: draft.options.map((option) => ({ ...option })),
      ratings: { ...draft.ratings },
      comparisons: { ...draft.comparisons },
      ranking,
      created_at: new Date().toISOString(),
    };
    rememberGuest(decision);
    go("result", "inLeft");
    if (user) await saveDecision(decision);
  }
  async function createPoll() {
    const expires_at = new Date(
      Date.now() + Number(deadline) * 3600e3,
    ).toISOString();
    const body = {
      topic: draft.title.trim(),
      options: draft.options.map((option) => ({
        id: option.id,
        label: option.name,
        color: option.color,
        ...(validPhoto(option.photo) ? { photo: option.photo } : {}),
      })),
      owner_winner: null,
      show_my_result: false,
      expires_at,
    };
    if (user) {
      const { data, error } = await supa
        .from("polls")
        .insert({ ...body, owner_id: user.id })
        .select()
        .single();
      if (error)
        return toast("투표 링크를 만들지 못했어요. 다시 시도해 주세요.");
      poll = { ...data, demo: false };
    } else {
      poll = { ...body, id: id(), demo: true };
      save("polls", { ...read("polls", {}), [poll.id]: poll });
    }
    go("share");
  }
  async function fetchBallot(poll, clientKey) {
    if (!uuid.test(clientKey ?? "")) return { data: null, error: null };
    if (poll.demo) {
      const entries = read("votes", {})[poll.id] ?? [];
      return {
        data: entries.find((entry) => entry.client_key === clientKey) ?? null,
        error: null,
      };
    }
    return supa.rpc("pickdrop_vote_receipt", {
      p_poll_id: poll.id,
      p_client_key: clientKey,
    });
  }

  async function openpoll(key) {
    view = "vote";
    current = null;
    ballot = null;
    editingVote = false;
    vote = "";
    note = "";
    voter = "";
    pollError = false;
    loading = true;
    render();
    const demo = uuid.test(key) ? read("polls", {})[key] : null;
    const result =
      demo || !uuid.test(key)
        ? { data: demo, error: null }
        : await supa.rpc("pickdrop_public_poll", { p_poll_id: key });
    const receipt = result.data
      ? await fetchBallot(result.data, read("vote_key_" + key, null))
      : { data: null, error: null };
    if (
      view !== "vote" ||
      new URL(location.href).searchParams.get("poll") !== key
    )
      return;
    current = result.data;
    pollError = Boolean(result.error || receipt.error);
    ballot = receipt.data;
    loading = false;
    render();
  }
  async function cast() {
    if (!vote || !current) return toast("선택지를 골라 주세요.");
    const activePoll = current;
    const updating = editingVote;
    const key = "vote_key_" + activePoll.id;
    const savedKey = read(key, null);
    if (updating && !uuid.test(savedKey ?? ""))
      return toast("기존 투표를 확인할 수 없어요.");
    const clientKey = uuid.test(savedKey ?? "") ? savedKey : id();
    save(key, clientKey);
    const receipt = {
      option_id: vote,
      note: note.trim() || null,
      voter_name: voter.trim() || null,
    };
    const payload = {
      p_poll_id: activePoll.id,
      p_option_id: receipt.option_id,
      p_note: receipt.note,
      p_voter_name: receipt.voter_name,
      p_client_key: clientKey,
    };
    let confirmed = receipt;
    if (activePoll.demo) {
      if (new Date(activePoll.expires_at) <= new Date())
        return toast("마감된 투표예요.");
      const all = read("votes", {});
      const entries = all[activePoll.id] ?? [];
      const index = entries.findIndex(
        (entry) => entry.client_key === clientKey,
      );
      const entry = {
        ...receipt,
        client_key: clientKey,
        poll_id: activePoll.id,
      };
      if (index >= 0) entries[index] = entry;
      else if (updating) return toast("기존 투표를 확인할 수 없어요.");
      else entries.push(entry);
      all[activePoll.id] = entries;
      save("votes", all);
    } else {
      const { data, error } = await supa.rpc(
        updating ? "pickdrop_vote_receipt" : "pickdrop_cast_vote",
        payload,
      );
      if (error && !updating && error.code === "23505") {
        const existing = await fetchBallot(activePoll, clientKey);
        if (existing.error || !existing.data)
          return toast("기존 투표를 확인할 수 없어요. 다시 시도해 주세요.");
        confirmed = existing.data;
      } else if (error) {
        if (error.message === "Poll is closed")
          return toast("마감된 투표예요.");
        return toast(
          updating
            ? "수정을 저장하지 못했어요. 다시 시도해 주세요."
            : "투표를 기록하지 못했어요. 다시 시도해 주세요.",
        );
      } else if (updating) {
        if (!data) return toast("기존 투표를 확인할 수 없어요.");
        confirmed = data;
      } else {
        const updated = await fetchBallot(activePoll, clientKey);
        confirmed = updated.data ?? receipt;
      }
    }
    save("voted_" + activePoll.id, confirmed.option_id);
    if (view !== "vote" || current?.id !== activePoll.id) return;
    ballot = confirmed;
    editingVote = false;
    go("vote", updating ? undefined : "inLeft");
    if (updating) toast("투표 기록을 수정했어요", "success");
  }
  async function statsLoad() {
    if (!poll) return;
    if (!poll.demo && !user) {
      go("account");
      return;
    }
    const before = votes.length;
    const sourceView = view;
    if (poll.demo) votes = read("votes", {})[poll.id] || [];
    else {
      const owner = user.id;
      const selected = poll.id;
      const { data, error } = await supa
        .from("votes")
        .select("option_id,note,voter_name,created_at")
        .eq("poll_id", selected);
      if (user?.id !== owner || poll?.id !== selected || view !== sourceView)
        return;
      if (error)
        return toast("투표 결과를 불러오지 못했어요. 다시 시도해 주세요.");
      votes = data || [];
    }
    const previous = view;
    go(
      "stats",
      previous === "share"
        ? "inLeft"
        : previous === "notes"
          ? "inRight"
          : previous === "stats" && !before && votes.length
            ? "smart"
            : undefined,
    );
    if (
      previous !== "stats" &&
      !votes.length &&
      new Date(poll.expires_at) > new Date()
    ) {
      const key = poll.id;
      statsRefresh = setTimeout(() => {
        if (view === "stats" && poll?.id === key && !pending) void statsLoad();
      }, 1800);
    }
  }
  const dialog = document.querySelector("dialog");
  let editor = null;
  const photoSheet = document.getElementById("photo-sheet");
  photoSheet.addEventListener("change", async (event) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    photoSheet.close();
    try {
      await uploadPhoto(file);
    } finally {
      input.value = "";
    }
  });
  photoSheet.addEventListener("click", (event) => {
    if (event.target === photoSheet) photoSheet.close();
  });
  function edit(kind, index, suggestion = "") {
    const entry = kind === "candidate" ? draft.options[index] : null;
    editor = {
      kind,
      index,
      name:
        kind === "criterion"
          ? (draft.criteria[index] ?? suggestion)
          : (entry?.name ?? ""),
      photo: entry?.photo ?? "",
      weight: draft.weights[draft.criteria[index]] ?? 0,
    };
    paintEditor();
    if (!dialog.open) openOverlay(dialog, kind === "criterion" ? 300 : 200);
  }
  function paintEditor() {
    const isCriterion = editor.kind === "criterion";
    const existing = isCriterion
      ? editor.index < draft.criteria.length
      : Boolean(draft.options[editor.index]?.name);
    const title =
      (isCriterion ? "기준 " : "후보 ") + (existing ? "수정" : "추가");
    const photoLabel = editor.photoLoading
      ? "사진을 불러오는 중…"
      : editor.photo
        ? "사진 바꾸기"
        : "사진 추가하기 (선택)";
    const content = isCriterion
      ? "<fieldset><legend>" +
        (existing ? "중요도 (수정 가능)" : "중요도") +
        "</legend>" +
        scale(editor.weight, "weight") +
        "</fieldset>"
      : action(
          photoLabel + icon("IconNext"),
          "choose-photo",
          editor.photoLoading ? "disabled" : "",
          "photo-input",
        ) +
        (editor.photo
          ? '<img class="upload-preview" src="' +
            editor.photo +
            '" alt="추가할 후보 사진">'
          : "");
    dialog.innerHTML =
      '<div class="modal-header"><h2>' +
      title +
      "</h2>" +
      action(
        icon("IconClose"),
        "close-dialog",
        'aria-label="닫기"',
        "icon-button",
      ) +
      "</div>" +
      '<div class="modal-body">' +
      (isCriterion && existing
        ? '<label class="field">기준 이름 (수정 불가)<input readonly value="' +
          esc(editor.name) +
          '"></label>'
        : input(
            isCriterion ? "기준 이름" : "후보 이름",
            "editor-name",
            editor.name,
            "이름을 적어주세요!",
            isCriterion ? 24 : 35,
          )) +
      content +
      '<div class="modal-actions">' +
      (existing && !isCriterion && draft.cat !== "pair"
        ? action("후보 삭제", "remove-candidate", "", "text-button")
        : "") +
      action(
        existing ? "수정하기" : "추가하기",
        "save-dialog",
        editor.name.trim() &&
          !editor.photoLoading &&
          (!isCriterion || editor.weight)
          ? ""
          : "disabled",
      ) +
      "</div></div>";
  }
  function commitEditor() {
    const { kind, index } = editor;
    const name = editor.name.trim();
    if (!name || editor.photoLoading) return;
    if (editor.kind === "criterion") {
      const old = draft.criteria[editor.index];
      if (!editor.weight) return;
      if (old !== name && draft.criteria.includes(name))
        return toast("이미 추가한 기준이에요.");
      draft.criteria[editor.index] = name;
      if (old && old !== name) delete draft.weights[old];
      draft.weights[name] = editor.weight;
    } else {
      const previous = draft.options[editor.index];
      draft.options[editor.index] = {
        id: previous?.id ?? id(),
        name,
        photo: editor.photo,
        color:
          draft.cat === "pair"
            ? editor.index === 0
              ? "pink"
              : "blue"
            : (previous?.color ?? palettes[editor.index % palettes.length]),
      };
    }
    dialog.close();
    render();
    const target =
      kind === "criterion"
        ? $.querySelector(".preset-detail")
        : $.querySelectorAll('[data-act="candidate"]')[
            view === "setup" && draft.options.length < 4 ? index + 1 : index
          ];
    animate(
      target,
      [{ opacity: 0 }, { opacity: 1 }],
      view === "setup" ? 150 : 200,
    );
  }
  async function uploadPhoto(file) {
    const editing = editor;
    if (!editing || !dialog.open || editing.photoLoading) return;
    editing.photoLoading = true;
    paintEditor();
    const url = URL.createObjectURL(file);
    let errorMessage = "";
    try {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = url;
      });
      const fit = Math.min(
        1,
        480 / Math.max(image.naturalWidth, image.naturalHeight),
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * fit));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * fit));
      const context = canvas.getContext("2d", { alpha: false });
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const photo = canvas.toDataURL("image/jpeg", 0.82);
      if (!validPhoto(photo)) throw new Error("Photo encoding failed");
      editing.photo = photo;
    } catch {
      errorMessage = "사진을 열 수 없어요. JPEG 또는 PNG 사진을 골라 주세요.";
    } finally {
      URL.revokeObjectURL(url);
      editing.photoLoading = false;
      if (editor === editing && dialog.open) {
        paintEditor();
        if (errorMessage) toast(errorMessage);
      }
    }
  }
  dialog.addEventListener("close", () => {
    document.body.append(status);
    status.hidden = true;
    dialog.classList.remove("photo-viewer");
    dialog.setAttribute("aria-label", "입력 팝업");
    editor = null;
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  document.addEventListener("input", (e) => {
    const key = e.target.dataset.in;
    if (key === "title") {
      draft.title = e.target.value;
      if (view === "setup") {
        const button = $.querySelector(
          '[data-act="createpoll"],[data-act="loginpoll"]',
        );
        button.disabled = !pollReady();
        const preview = $.querySelector(".text-button[data-act=createpoll]");
        if (preview) preview.hidden = !pollReady();
      }
    }
    if (key === "note") note = e.target.value;
    if (key === "voter") voter = e.target.value;
    if (key === "editor-name" && editor) {
      editor.name = e.target.value;
      dialog.querySelector('[data-act="save-dialog"]').disabled =
        !editor.name.trim() ||
        editor.photoLoading ||
        (editor.kind === "criterion" && !editor.weight);
    }
  });
  function resetScore() {
    criterionIndex = 0;
    optionIndex = 0;
    draft.ratings = {};
    draft.comparisons = {};
  }
  function startCompare() {
    const tied = tie(decision);
    if (tied.length > 2 && !compareIds.length) {
      dialog.innerHTML =
        '<div class="modal-header"><h2>비교할 후보 두 개</h2>' +
        action(
          icon("IconClose"),
          "close-dialog",
          'aria-label="닫기"',
          "icon-button",
        ) +
        '</div><div class="modal-body">' +
        tied
          .map(
            (option) =>
              '<label class="compare-choice"><input type="checkbox" name="compare" value="' +
              esc(option.id) +
              '">' +
              esc(option.name) +
              "</label>",
          )
          .join("") +
        action("비교하기", "confirm-compare") +
        "</div>";
      dialog.showModal();
      return;
    }
    draft = fresh();
    draft.title = decision.title;
    draft.cat = "pair";
    draft.criteria = [...decision.criteria];
    draft.weights = { ...decision.weights };
    draft.options = (
      compareIds.length ? tied.filter((o) => compareIds.includes(o.id)) : tied
    )
      .slice(0, 2)
      .map((option, index) => ({ ...option, color: index ? "blue" : "pink" }));
    compareIds = [];
    step = 2;
    go("wizard");
  }
  document.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-act]");
    if (!t || t.disabled || pending) return;
    const a = t.dataset.act;
    const index = Number(t.dataset.i);
    pending = true;
    status.hidden = true;
    try {
      if (a === "home") {
        window.history.replaceState(null, "", location.pathname);
        go("home");
      } else if (a === "start" || a === "friend") {
        draft = fresh();
        deadline = "";
        step = 1;
        resetScore();
        go(
          a === "friend" ? "setup" : "wizard",
          a === "friend" ? "inLeft" : "smart",
        );
      } else if (a === "cat" && draft.cat !== t.dataset.val) {
        draft.cat = t.dataset.val;
        draft.criteria = PRESETS[draft.cat].criteria.slice(
          0,
          draft.cat === "pair" ? 2 : 3,
        );
        draft.weights = Object.fromEntries(
          draft.criteria.map((criterion) => [criterion, 3]),
        );
        draft.options =
          draft.cat === "pair"
            ? [0, 1].map((i) => ({
                ...draft.options[i],
                id: draft.options[i]?.id ?? id(),
                name: draft.options[i]?.name ?? "",
                color: i ? "blue" : "pink",
              }))
            : draft.options.filter((option) => option.name);
        changePreset();
      } else if (a === "criteria-remove") {
        const [removed] = draft.criteria.splice(index, 1);
        delete draft.weights[removed];
        render();
      } else if (a === "criterion") {
        edit(
          "criterion",
          Number.isInteger(index) ? index : draft.criteria.length,
          t.dataset.suggestion,
        );
      } else if (a === "candidate") edit("candidate", index);
      else if (a === "close-dialog") dialog.close();
      else if (a === "choose-photo") openOverlay(photoSheet, 250);
      else if (a === "close-photo-sheet") photoSheet.close();
      else if (a === "save-dialog" && editor) commitEditor();
      else if (a === "remove-candidate" && editor) {
        draft.options.splice(editor.index, 1);
        dialog.close();
        render();
      } else if (a === "weight" && editor) {
        editor.weight = Number(t.dataset.n);
        changeColors(
          '#page [data-n], dialog [data-act="weight"]',
          paintEditor,
          200,
        );
      } else if (a === "back") {
        if (step === 3 && optionIndex > 0) optionIndex--;
        else if (step === 3 && criterionIndex > 0) {
          criterionIndex--;
          optionIndex = draft.cat === "pair" ? 0 : draft.options.length - 1;
        } else step--;
        go("wizard");
      } else if (a === "next") {
        const pair = draft.cat === "pair";
        let transition = "inLeft";
        if (step === 1) {
          if (!draft.cat || !draft.criteria.length)
            return toast("양식과 비교 기준을 골라 주세요.");
          step = 2;
        } else if (step === 2) {
          if (!optionsReady()) return toast("후보를 두 개 이상 등록해 주세요.");
          step = 3;
          resetScore();
          if (pair) transition = "dissolve";
        } else {
          const selected = pair
            ? draft.comparisons[draft.criteria[criterionIndex]]
            : draft.ratings[scoreKey()];
          if (!selected) return;
          if (!pair && optionIndex + 1 < draft.options.length) return;
          if (criterionIndex + 1 >= draft.criteria.length) return await done();
          criterionIndex++;
          optionIndex = 0;
        }
        go("wizard", transition);
      } else if (a === "score") {
        const rating = Number(t.dataset.n);
        const pair = draft.cat === "pair";
        if (pair) draft.comparisons[draft.criteria[criterionIndex]] = rating;
        else draft.ratings[scoreKey()] = rating;
        changeColors(
          '.scale [data-act="score"], .bottom [data-act="next"]',
          render,
          pair ? 300 : 200,
        );
        clearTimeout(scoreAdvance);
        if (!pair && optionIndex + 1 < draft.options.length) {
          scoreAdvance = setTimeout(() => {
            if (view !== "wizard" || step !== 3) return;
            optionIndex++;
            render();
            animate(
              $.querySelector(".score-cards"),
              [
                { transform: "translateX(176px)" },
                { transform: "translateX(0)" },
              ],
              400,
              "ease-in-out",
            );
          }, 600);
        }
      } else if (a === "rescore") {
        draft = {
          ...fresh(),
          title: decision.title,
          cat: decision.category,
          options: decision.options.map((o) => ({ ...o })),
          criteria: [...decision.criteria],
          weights: { ...decision.weights },
        };
        step = 3;
        resetScore();
        go("wizard", "smart");
      } else if (a === "compare-tie") startCompare();
      else if (a === "confirm-compare") {
        const selected = [
          ...dialog.querySelectorAll('[name="compare"]:checked'),
        ].map((input) => input.value);
        if (selected.length !== 2) return toast("후보를 두 개 골라 주세요.");
        compareIds = selected;
        dialog.close();
        startCompare();
      } else if (a === "makepoll") {
        draft = {
          ...fresh(),
          title: decision.title,
          options: decision.options.map((o) => ({ ...o })),
        };
        deadline = "";
        go("setup", "inLeft");
      } else if (a === "setup-back") go(view === "share" ? "setup" : "home");
      else if (a === "deadline") {
        deadline = t.dataset.val;
        changeColors('.chips [data-act="deadline"]', render, 200);
      } else if (a === "loginpoll" && pollReady()) {
        sessionStorage.setItem(
          "pd_resume",
          JSON.stringify({ view: "setup", draft, deadline }),
        );
        go("account");
      } else if (a === "createpoll" && pollReady()) await createPoll();
      else if (a === "copy" || a === "copy-results") {
        const resultCopy = a === "copy-results";
        const summary = resultCopy
          ? [
              "PICKDROP · " + poll.topic,
              votes.length ? votes.length + "명 참여" : "받은 투표가 없어요",
              ...pollRanks(poll, tally(votes))
                .filter((option) => option.count)
                .map(
                  (option) =>
                    option.rank +
                    "위 " +
                    option.label +
                    " (" +
                    option.count +
                    "표)",
                ),
            ].join("\n")
          : pollLink(poll.id).href;
        try {
          await navigator.clipboard.writeText(summary);
          toast(
            resultCopy
              ? "투표 결과가 복사되었어요"
              : "투표 링크가 복사되었어요",
            "success",
            t.classList.contains("icon-button") ? "slide" : "fade",
          );
        } catch {
          const link = $.querySelector("input[readonly]");
          if (!resultCopy && link) {
            link.select();
            toast("선택된 링크를 복사해 주세요.");
          } else toast("복사하지 못했어요. 다시 시도해 주세요.");
        }
      } else if (a === "visit") {
        const url = pollLink(poll.id);
        window.history.pushState(null, "", url);
        await openpoll(poll.id);
      } else if (a === "retryvote")
        await openpoll(new URL(location.href).searchParams.get("poll"));
      else if (a === "edit-vote" && ballot && current) {
        if (new Date(current.expires_at) <= new Date()) {
          render();
          return toast("마감된 투표예요.");
        }
        editingVote = true;
        vote = ballot.option_id;
        note = ballot.note ?? "";
        voter = ballot.voter_name ?? "";
        go("vote");
      } else if (a === "cancel-vote") {
        editingVote = false;
        go("vote");
      } else if (a === "voteselect") {
        const strip = $.querySelector(".guest-options");
        const position = strip.scrollLeft;
        vote = current.options[index].id;
        changeColors('.guest-card [data-act="voteselect"]', render, 150);
        $.querySelector(".guest-options").scrollLeft = position;
      } else if (a === "photo") {
        const option = current.options[index];
        if (!validPhoto(option?.photo)) return;
        dialog.classList.add("photo-viewer");
        dialog.setAttribute("aria-label", option.label + " 사진");
        dialog.innerHTML =
          '<div class="photo-viewer-controls">' +
          action(
            icon("PhotoClose"),
            "close-dialog",
            'aria-label="닫기"',
            "icon-button",
          ) +
          '</div><img class="expanded-photo" src="' +
          option.photo +
          '" alt="' +
          esc(option.label) +
          '">';
        dialog.showModal();
      } else if (a === "cast") await cast();
      else if (a === "stats") await statsLoad();
      else if (a === "notes") go("notes", "inLeft");
      else if (a === "my-polls") await loadOwnedPolls();
      else if (a === "more-polls") await loadOwnedPolls(true);
      else if (a === "open-poll") await openOwnedPoll(t.dataset.id);
      else if (a === "history") go("history");
      else if (a === "reloadhistory" && user) await loadHistory(user.id);
      else if (a === "openhistory") {
        decision = records[index];
        go("result");
      } else if (a === "account") openAuth("login");
      else if (a === "auth-login") openAuth("login");
      else if (a === "auth-signup") openAuth("signup");
      else if (a === "auth-reset") openAuth("reset");
      else if (a === "login") {
        const { error } = await supa.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: authRedirect() },
        });
        if (error)
          toast("Google 로그인을 시작하지 못했어요. 다시 시도해 주세요.");
      } else if (a === "logout") {
        const { error } = await supa.auth.signOut();
        if (error) return toast("로그아웃하지 못했어요. 다시 시도해 주세요.");
        authMode = "login";
        authMessage = "";
        authEmail = "";
        go("home");
      } else if (a === "save") {
        if (!user) {
          sessionStorage.setItem(
            "pd_resume",
            JSON.stringify({ view: "result", decision }),
          );
          go("account");
        } else if (await saveDecision(decision))
          toast("결과를 저장했어요.", "success");
      }
    } catch (err) {
      console.error(err);
      toast("문제가 발생했어요. 다시 시도해 주세요.");
    } finally {
      pending = false;
    }
  });
  supa.auth.onAuthStateChange((event, session) => {
    const old = user?.id;
    user = session?.user ?? null;
    if (event === "PASSWORD_RECOVERY" && user) {
      authReady = true;
      records = [];
      authEmail = "";
      openAuth("recovery");
      setTimeout(() => {
        if (user?.id === session.user.id) void loadHistory(session.user.id);
      }, 0);
      return;
    }
    if (!authReady || old !== user?.id) {
      authReady = true;
      records = user ? [] : read("history", []);
      if (old) {
        ownedPolls = [];
        morePolls = false;
        pollsError = false;
        pollsLoading = false;
        decision = null;
        poll = null;
        if (!["home", "vote"].includes(view)) go("home");
      }
      if (user) {
        const resume = sessionStorage.getItem("pd_resume");
        sessionStorage.removeItem("pd_resume");
        if (resume && view !== "vote") {
          const saved = JSON.parse(resume);
          decision = saved.decision;
          deadline = saved.deadline ?? deadline;
          if (saved.draft) draft = saved.draft;
          go(saved.view);
        }
        // Supabase auth callbacks must release the auth lock before making data requests.
        setTimeout(() => {
          if (user?.id === session.user.id) void loadHistory(session.user.id);
        }, 0);
      }
      if (view === "home") {
        const control = $.querySelector(".home-account [data-act=account]");
        if (control) {
          control.disabled = false;
          control.textContent = user ? "마이페이지" : "로그인";
        }
      }
      if (view === "account" || view === "history" || view === "setup")
        render();
    }
  });
  function route() {
    status.hidden = true;
    const key = new URL(location.href).searchParams.get("poll");
    if (key) void openpoll(key);
    else go("home");
  }
  window.addEventListener("popstate", route);
  const oauthError =
    new URLSearchParams(location.hash.slice(1)).get("error_description") ??
    new URLSearchParams(location.search).get("error_description");
  route();
  if (oauthError)
    toast("인증 링크를 열 수 없어요. 로그인 화면에서 다시 시도해 주세요.");
})();
