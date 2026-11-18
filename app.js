(() => {
  "use strict";
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
  const go = (v) => {
    view = v;
    render();
    window.scrollTo(0, 0);
  };
  const status = document.getElementById("status");
  let toastTimer;
  const toast = (message, kind = "error") => {
    (dialog.open ? dialog : document.body).append(status);
    status.className = kind;
    status.querySelector("span").textContent = message;
    status.hidden = false;
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
    if (view === "home" || view === "history") render();
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
        ({ rank, label, name }) =>
          "<li><span>" + rank + "위</span>" + esc(label ?? name) + "</li>",
      )
      .join("") +
    "</ol>";
  const pick = (option, index, caption = "") =>
    '<div class="winner"><div class="pick-card">' +
    card(option, index) +
    '<span class="stamp">Pick!</span></div>' +
    '<div class="winner-name"><small>PICKDROP</small>' +
    (caption ? "<small>" + caption + "</small>" : "") +
    "<strong>" +
    esc(option.name ?? option.label) +
    "</strong></div></div>";
  const optionsReady = () =>
    draft.options.length >= 2 &&
    draft.options.every((option) => option.name.trim());
  const pollReady = () =>
    Boolean(draft.title.trim() && optionsReady() && deadline);
  const descriptor = () =>
    [PRESETS[draft.cat]?.label, draft.title].filter(Boolean).join(" · ");

  function home() {
    const logo = [1, 2, 3, 4, 5]
      .map((n) => '<img src="/assets/imgColor' + n + '.svg" alt="">')
      .join("");
    return (
      '<div class="home"><div class="logo-stack" aria-hidden="true">' +
      logo +
      '</div><img class="wordmark" src="/assets/imgPickdrop.svg" alt="PICKDROP">' +
      '<div class="home-actions">' +
      action(
        icon("IconPerson") + "나 혼자 결정하기",
        "start",
        "",
        "home-button",
      ) +
      action(icon("Group") + "친구에게 물어보기", "friend", "", "home-button") +
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
      footer(action("다음", "next", selected ? "" : "disabled"))
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
          : pick(chosen, index(chosen), "1위")) +
      (!pair
        ? '<section class="result-ranks"><h2>다른 후보 순위</h2>' +
          muted("다음 기회에") +
          rankList(ranks.map((option, i) => ({ ...option, rank: i + 2 }))) +
          "</section>"
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
      const localRanks = current.demo
        ? pollRanks(current, read("votes", {})[current.id] ?? [])
        : [];
      return (
        header("투표 완료!", { progress: 100 }) +
        (selected
          ? muted("내가 고른 후보") +
            pick(selected, current.options.indexOf(selected))
          : muted("의견을 전달했어요.")) +
        (localRanks.length
          ? '<section class="result-ranks"><h2>전체 후보 순위</h2>' +
            rankList(localRanks) +
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
  function pollRanks(item, entries) {
    let previous = -1,
      rank = 0;
    return item.options
      .map((option, i) => ({
        ...option,
        index: i,
        count: entries.filter((entry) => entry.option_id === option.id).length,
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
    const ranked = pollRanks(poll, votes);
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
      header(ended ? "투표 종료!" : "아직 진행 중이에요") +
      (ended && top.length
        ? muted("우리의 선택은...") +
          (top.length === 1
            ? pick(top[0], top[0].index, "1위")
            : '<div class="winner ties">' +
              top.map((o) => card(o, o.index)).join("") +
              "</div>") +
          '<section class="result-ranks"><h2>다른 후보 순위</h2>' +
          muted("다음 기회에") +
          rankList(ranked.filter((o) => o.rank > 1)) +
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
  function account() {
    return (
      header("마이페이지", { back: "home" }) +
      (user
        ? muted(user.email) +
          '<div class="account-actions">' +
          action("내 선택 기록", "history") +
          action("최근에 만든 투표", "recentpoll", "", "secondary") +
          action("로그아웃", "logout", "", "secondary") +
          "</div>"
        : muted(
            "Google 계정으로 로그인하면 선택 기록을 저장하고 다른 기기에서도 이어볼 수 있어요.",
          ) +
          footer(
            action("Google로 계속하기", "login", authReady ? "" : "disabled"),
          ))
    );
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
    go("result");
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
      }
    }
    save("voted_" + activePoll.id, confirmed.option_id);
    if (view !== "vote" || current?.id !== activePoll.id) return;
    ballot = confirmed;
    editingVote = false;
    render();
    window.scrollTo(0, 0);
    if (updating) toast("투표 기록을 수정했어요", "success");
  }
  async function statsLoad() {
    if (!poll) return;
    if (!poll.demo && !user) {
      go("account");
      return;
    }
    if (poll.demo) votes = read("votes", {})[poll.id] || [];
    else {
      const { data, error } = await supa
        .from("votes")
        .select("option_id,note,voter_name,created_at")
        .eq("poll_id", poll.id);
      if (error) return toast(error.message);
      votes = data || [];
    }
    go("stats");
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
    if (!dialog.open) dialog.showModal();
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
        go(a === "friend" ? "setup" : "wizard");
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
        render();
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
      else if (a === "choose-photo") photoSheet.showModal();
      else if (a === "close-photo-sheet") photoSheet.close();
      else if (a === "save-dialog" && editor) commitEditor();
      else if (a === "remove-candidate" && editor) {
        draft.options.splice(editor.index, 1);
        dialog.close();
        render();
      } else if (a === "weight" && editor) {
        editor.weight = Number(t.dataset.n);
        paintEditor();
      } else if (a === "back") {
        if (step === 3 && optionIndex > 0) optionIndex--;
        else if (step === 3 && criterionIndex > 0) {
          criterionIndex--;
          optionIndex = draft.cat === "pair" ? 0 : draft.options.length - 1;
        } else step--;
        go("wizard");
      } else if (a === "next") {
        if (step === 1) {
          if (!draft.cat || !draft.criteria.length)
            return toast("양식과 비교 기준을 골라 주세요.");
          step = 2;
        } else if (step === 2) {
          if (!optionsReady()) return toast("후보를 두 개 이상 등록해 주세요.");
          step = 3;
          resetScore();
        } else {
          const pair = draft.cat === "pair";
          const selected = pair
            ? draft.comparisons[draft.criteria[criterionIndex]]
            : draft.ratings[scoreKey()];
          if (!selected) return;
          if (!pair && optionIndex + 1 < draft.options.length) optionIndex++;
          else if (criterionIndex + 1 < draft.criteria.length) {
            criterionIndex++;
            optionIndex = 0;
          } else return await done();
        }
        go("wizard");
      } else if (a === "score") {
        const rating = Number(t.dataset.n);
        if (draft.cat === "pair")
          draft.comparisons[draft.criteria[criterionIndex]] = rating;
        else draft.ratings[scoreKey()] = rating;
        render();
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
        go("wizard");
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
        go("setup");
      } else if (a === "setup-back") go(view === "share" ? "setup" : "home");
      else if (a === "deadline") {
        deadline = t.dataset.val;
        render();
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
              ...pollRanks(poll, votes)
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
        render();
        $.querySelector(".guest-options").scrollLeft = position;
      } else if (a === "photo") {
        const option = current.options[index];
        if (!validPhoto(option?.photo)) return;
        dialog.innerHTML =
          '<div class="modal-header"><h2>' +
          esc(option.label) +
          "</h2>" +
          action(
            icon("IconClose"),
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
      else if (a === "notes") go("notes");
      else if (a === "recentpoll" && user) {
        const owner = user.id;
        const { data, error } = await supa
          .from("polls")
          .select("*")
          .eq("owner_id", owner)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (user?.id !== owner) return;
        if (error) return toast("최근 투표를 불러오지 못했어요.");
        if (!data) return toast("아직 만든 투표가 없어요.");
        poll = { ...data, demo: false };
        await statsLoad();
      } else if (a === "history") go("history");
      else if (a === "reloadhistory" && user) await loadHistory(user.id);
      else if (a === "openhistory") {
        decision = records[index];
        go("result");
      } else if (a === "account") go("account");
      else if (a === "login") {
        const { error } = await supa.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: location.origin + location.pathname },
        });
        if (error)
          toast("Google 로그인을 시작하지 못했어요. 다시 시도해 주세요.");
      } else if (a === "logout") {
        const { error } = await supa.auth.signOut();
        if (error) return toast("로그아웃하지 못했어요. 다시 시도해 주세요.");
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
    if (!authReady || old !== user?.id) {
      authReady = true;
      records = user ? [] : read("history", []);
      if (old) {
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
      if (
        view === "home" ||
        view === "account" ||
        view === "history" ||
        view === "setup"
      )
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
    toast("Google 로그인을 완료하지 못했어요. 다시 시도해 주세요.");
})();
