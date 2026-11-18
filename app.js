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
    food: ["음식 자판기", ["맛", "가격", "거리", "양"]],
    shopping: ["쇼핑 자판기", ["가격", "활용도", "디자인", "품질"]],
    leisure: ["여가 자판기", ["비용", "피로도", "재미", "시간"]],
    custom: ["직접 만들기", ["만족도", "실용성", "가격", "편의성"]],
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
    showResult = false,
    friendFlow = false,
    view = "home",
    step = 1,
    draft,
    decision = null,
    poll = null,
    current = null,
    vote = "",
    note = "",
    voter = "",
    votes = [],
    deadline = "today",
    records = read("history", []),
    loading = false;
  const fresh = () => ({
    title: "",
    cat: "shopping",
    criteria: ["가격", "활용도", "디자인"],
    options: [
      { id: id(), name: "" },
      { id: id(), name: "" },
    ],
    ratings: {},
  });
  draft = read("draft", fresh());
  const btn = (name, act = "next", kind = "") =>
    '<button class="btn ' +
    kind +
    '" data-act="' +
    act +
    '">' +
    name +
    "</button>";
  const stephead = (name, n) =>
    '<div class="stepTop"><h1>' +
    name +
    "</h1><span>" +
    n +
    '/5</span></div><div class="progress"><div style="width:' +
    n * 20 +
    '%"></div></div>';
  const go = (v) => {
    view = v;
    render();
    window.scrollTo(0, 0);
  };
  const mark = (v) => {
    draft = v;
    save("draft", draft);
    render();
  };
  const status = document.getElementById("status");
  const toast = (message) => {
    status.textContent = message;
  };
  const pollLink = (key) => {
    const url = new URL(location.pathname, location.origin);
    url.searchParams.set("poll", key);
    return url;
  };
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const optionRow = (label, selected = false, key = null) =>
    `<${key === null ? "div" : "button"} class="voteopt ${selected ? "active" : ""}" ${key === null ? "" : `data-act="voteselect" data-id="${esc(key)}" aria-pressed="${selected}"`}><b>${esc(label)}</b><span aria-hidden="true">${selected ? "✓" : ""}</span></${key === null ? "div" : "button"}>`;
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

  function home() {
    return (
      '<span class="heroTag">HEY, DECIDE!</span><h1 class="hero">고민은 넣고,<br>선택은 뽑고.</h1><p class="sub">결정이 어려울 땐 자판기를 돌려봐요.<br>내 기준으로 비교하고 친구 의견도 받아보세요.</p><div class="machine"><div class="machineTop"><b>PICK MACHINE</b><span>01 / SELECT</span></div><div class="machineGrid"><button class="product" data-act="start"><small>01</small><strong>나 혼자<br>결정</strong><small>MY CHOICE ↗</small></button><button class="product" data-act="friend"><small>02</small><strong>친구에게<br>묻기</strong><small>ASK FRIENDS ↗</small></button></div><div class="slot"></div></div><button class="tile" data-act="start">개인 선택 <span class="arrow">↗</span></button><button class="tile" data-act="friend">친구 의견 받기 <span class="arrow">↗</span></button><div class="subhead">최근 고민</div>' +
      (records.length
        ? records
            .slice(0, 3)
            .map(
              (r, i) =>
                '<button class="tile" data-act="openhistory" data-i="' +
                i +
                '">' +
                esc(r.title) +
                "<small>" +
                esc(winnerLabel(r)) +
                "</small></button>",
            )
            .join("")
        : '<div class="notice">아직 뽑은 고민이 없어요.</div>') +
      '<button class="link" data-act="history">전체 기록 보기 →</button>'
    );
  }
  function one() {
    const labels = {
      food: "음식",
      shopping: "쇼핑",
      leisure: "여가",
      custom: "직접",
    };
    const title =
      '<label class="field" for="decision-title">무엇을 고민하나요?</label>' +
      '<input id="decision-title" class="input" data-in="title" maxlength="100" placeholder="예: 옷 세 벌 중 뭘 살까?" value="' +
      esc(draft.title) +
      '">';
    if (friendFlow)
      return (
        '<div class="stepTop"><h1>친구에게 물어보기</h1><span>1/2</span></div>' +
        title +
        foot()
      );
    const presets = Object.entries(PRESETS)
      .map(([key, [name, criteria]]) => {
        const selected = draft.cat === key;
        return (
          '<div class="preset' +
          (selected ? " active" : "") +
          '">' +
          '<button class="presetButton" aria-pressed="' +
          selected +
          '" data-act="cat" data-val="' +
          key +
          '">' +
          "<span>" +
          labels[key] +
          "</span><strong>" +
          name +
          "</strong>" +
          (selected ? "" : "<small>" + criteria.join(" · ") + "</small>") +
          "</button>" +
          (selected
            ? '<div class="presetCriteria"><p>비교할 기준 (눌러서 빼기 · 최대 4개)</p><div class="chips">' +
              criteria
                .map((criterion) => {
                  const active = draft.criteria.includes(criterion);
                  return (
                    '<button class="chip ' +
                    (active ? "selected" : "") +
                    '" aria-pressed="' +
                    active +
                    '" data-act="crit" data-val="' +
                    esc(criterion) +
                    '">' +
                    esc(criterion) +
                    (active ? " ×" : " +") +
                    "</button>"
                  );
                })
                .join("") +
              "</div></div>"
            : "") +
          "</div>"
        );
      })
      .join("");
    return (
      stephead("새 고민", 1) +
      title +
      '<h2 class="presetHeading">어떤 자판기인가요?</h2>' +
      presets +
      foot()
    );
  }
  function two() {
    return (
      (friendFlow
        ? '<div class="stepTop"><h1>후보 넣기</h1><span>2/2</span></div>'
        : stephead("자판기에 후보 넣기", 2)) +
      '<p class="sub">' +
      esc(draft.title) +
      ' · 후보를 2~4개 넣어 주세요.</p><div class="options">' +
      draft.options
        .map(
          (o, i) =>
            '<div class="opt"><input data-in="option" data-id="' +
            o.id +
            '" maxlength="35" placeholder="후보 A' +
            (i + 1) +
            '" value="' +
            esc(o.name) +
            '"/><div class="pic">□</div>' +
            (draft.options.length > 2
              ? '<button data-act="remove" data-id="' + o.id + '">×</button>'
              : "") +
            "</div>",
        )
        .join("") +
      (draft.options.length < 4
        ? '<button class="btn secondary" data-act="add">+ 후보 넣기</button>'
        : "") +
      "</div>" +
      foot()
    );
  }
  function three() {
    return (
      stephead("중요한 순서", 3) +
      '<h2>나에게 중요한 기준은?</h2><p class="sub">순서가 높을수록 점수에 크게 반영돼요.</p>' +
      draft.criteria
        .map(
          (c, i) =>
            '<div class="row"><b>' +
            (i + 1) +
            "</b><strong>" +
            esc(c) +
            "</strong><small>×" +
            (draft.criteria.length - i) +
            '</small><button class="round" data-act="move" data-i="' +
            i +
            '" data-d="-1">↑</button><button class="round" data-act="move" data-i="' +
            i +
            '" data-d="1">↓</button></div>',
        )
        .join("") +
      foot()
    );
  }
  function four() {
    return (
      stephead("점수 매기기", 4) +
      '<h2>후보별 1~5점</h2><p class="sub">5점이 가장 좋아요.</p>' +
      draft.options
        .map(
          (o, i) =>
            '<div class="rating"><small>후보 A' +
            (i + 1) +
            "</small><h3>" +
            esc(o.name) +
            "</h3>" +
            draft.criteria
              .map(
                (c, j) =>
                  "<label>" +
                  esc(c) +
                  " · ×" +
                  (draft.criteria.length - j) +
                  '</label><div class="score">' +
                  [1, 2, 3, 4, 5]
                    .map(
                      (n) =>
                        '<button class="' +
                        ((draft.ratings[o.id + "|" + c] || 3) === n
                          ? "on"
                          : "") +
                        '" data-act="score" data-id="' +
                        o.id +
                        '" data-c="' +
                        esc(c) +
                        '" data-n="' +
                        n +
                        '">' +
                        n +
                        "</button>",
                    )
                    .join("") +
                  "</div>",
              )
              .join("") +
            "</div>",
        )
        .join("") +
      foot("결과 뽑기")
    );
  }
  function result() {
    if (!decision) return '<div class="empty">결과가 없어요.</div>';
    const r = decision;
    const tied = tie(r);
    if (tied.length > 1 && !r.chosenId)
      return (
        stephead("결과가 나왔어요", 5) +
        '<div class="winner tie"><small>출구</small><strong>동점이에요!</strong><div class="tieCards">' +
        tied
          .map(
            (option) =>
              "<article><b>" +
              esc(option.name) +
              "</b><p>" +
              option.score +
              "점</p></article>",
          )
          .join("") +
        "</div></div>" +
        '<h2>어떻게 정할까요?</h2><button class="tile" data-act="priority">가장 중요한 기준으로 정하기 ›</button><button class="tile" data-act="makepoll">친구에게 물어보기 ›</button>' +
        "<p>내가 직접 고르기</p>" +
        tied
          .map(
            (option) =>
              '<button class="tile" data-act="pickwinner" data-id="' +
              esc(option.id) +
              '">' +
              esc(option.name) +
              " ›</button>",
          )
          .join("") +
        btn("계정에 결과 저장", "save", "secondary")
      );
    const first = winner(r);
    return (
      stephead("결과가 나왔어요", 5) +
      '<div class="winner"><small>출구 · 선택 결과</small><div><small>1위 · 기준을 가장 잘 만족했어요</small><h2>' +
      esc(first.name) +
      "</h2><b>" +
      first.score +
      "점</b></div></div>" +
      r.ranking
        .filter((o) => o.id !== first.id)
        .map(
          (o, i) =>
            '<div class="rank"><span>' +
            (i + 2) +
            "위 · " +
            esc(o.name) +
            "</span><b>" +
            o.score +
            "점</b></div>",
        )
        .join("") +
      '<div class="subhead">기준별 점수</div><div style="overflow-x:auto"><table style="width:100%;font-size:12px;border-collapse:collapse" border="1" cellpadding="8"><tr><th>기준</th>' +
      r.options.map((o) => "<th>" + esc(o.name) + "</th>").join("") +
      "</tr>" +
      r.criteria
        .map(
          (c, i) =>
            "<tr><td>" +
            esc(c) +
            " ×" +
            (r.criteria.length - i) +
            "</td>" +
            r.options
              .map(
                (o) =>
                  "<td>" + Number(r.ratings[o.id + "|" + c] || 3) + "</td>",
              )
              .join("") +
            "</tr>",
        )
        .join("") +
      '</table></div><div class="footer">' +
      btn("다시 뽑기", "start", "secondary") +
      btn("이걸로 결정!", "choose") +
      "</div>" +
      btn("계정에 결과 저장", "save", "secondary") +
      '<button class="tile" data-act="makepoll">친구에게도 물어보기 ↗</button>'
    );
  }
  function setup() {
    return (
      '<div class="stepTop"><h1>친구에게 물어보기</h1><small>나</small></div><p class="sub">이렇게 보내줘요.</p><div class="dark"><b>' +
      esc(decision?.title || "고민") +
      "</b>" +
      decision.options.map((o) => optionRow(o.name)).join("") +
      '</div><div class="subhead">투표 설정</div>' +
      (winner(decision)
        ? '<label class="toggle">내 점수 결과도 보여주기<input type="checkbox" role="switch" data-in="showresult" ' +
          (showResult ? "checked" : "") +
          '></label><p class="hint">끄면 친구에게 내 결과가 표시되지 않아요.</p>'
        : "") +
      '<div class="subhead">투표 마감</div><div class="chips">' +
      [
        ["hour", "1시간"],
        ["today", "오늘까지"],
        ["tomorrow", "내일까지"],
      ]
        .map(
          ([k, v]) =>
            '<button class="chip ' +
            (deadline === k ? "selected" : "") +
            '" data-act="deadline" data-val="' +
            k +
            '">' +
            v +
            "</button>",
        )
        .join("") +
      '</div><div class="notice">' +
      (user
        ? "로그인 상태입니다. 실제로 친구에게 공유되는 투표를 생성할 수 있어요."
        : "실제 공유 투표 생성은 Google 로그인이 필요해요. Google 로그인 후 링크를 공유할 수 있어요.") +
      "</div>" +
      (user
        ? btn("투표 링크 만들기", "createpoll")
        : btn("Google 로그인하고 링크 만들기", "loginpoll") +
          btn("이 기기에서 미리 보기", "createpoll", "secondary"))
    );
  }
  function share() {
    const url = pollLink(poll.id);
    return (
      '<div class="empty"><div style="font-size:45px">✉</div><h2>투표가 준비됐어요!</h2><p>' +
      esc(poll.topic) +
      '</p><p class="hint">' +
      (poll.demo
        ? "이 링크는 데모용이며 다른 기기에서는 동작하지 않습니다."
        : "친구에게 링크를 보내주세요. 비회원도 투표할 수 있어요.") +
      '</p></div><input class="input" readonly value="' +
      esc(url.href) +
      '">' +
      btn("공유 링크 복사하기", "copy") +
      '<div class="footer">' +
      btn("투표 화면", "visit", "secondary") +
      btn("투표 현황", "stats") +
      "</div>"
    );
  }
  function publicvote() {
    if (loading) return '<div class="empty">투표를 불러오는 중...</div>';
    if (pollError)
      return (
        '<div class="empty"><h2>투표를 불러오지 못했어요.</h2>' +
        btn("다시 시도", "retryvote") +
        "</div>"
      );
    if (!current)
      return '<div class="empty"><h2>투표를 찾을 수 없습니다.</h2><button class="btn" data-act="home">홈으로</button></div>';
    if (read("voted_" + current.id, false))
      return '<div class="empty"><h2>투표 완료!</h2><p>의견을 전달했어요.</p></div>';
    if (new Date(current.expires_at) <= new Date())
      return '<div class="empty">마감된 투표예요.</div>';
    return (
      '<div class="guestVote"><div class="stepTop"><h1>친구의 고민</h1><small>친구</small></div><h2 style="margin-top:28px">' +
      esc(current.topic) +
      '</h2><p class="sub">하나를 골라 버튼을 눌러주세요 · 로그인 없어요</p><div class="dark">' +
      current.options
        .map((o) => optionRow(o.label, vote === o.id, o.id))
        .join("") +
      "</div>" +
      (current.show_my_result && current.owner_winner
        ? '<p class="notice">친구의 선택 · ' +
          esc(current.owner_winner) +
          "</p>"
        : "") +
      '<label class="field" for="vote-note">한마디 (선택)</label><textarea id="vote-note" rows="2" data-in="note" class="input" maxlength="200" placeholder="의견을 남겨주세요">' +
      esc(note) +
      '</textarea><label class="field" for="vote-name">이름 (선택) <small>비워두면 익명</small></label><input id="vote-name" data-in="voter" class="input" maxlength="30" placeholder="이름" value="' +
      esc(voter) +
      '"/><div class="footer">' +
      btn("투표하기", "cast") +
      "</div></div>"
    );
  }
  function stats() {
    return (
      '<div class="stepTop"><h1>친구 투표 결과</h1><small>' +
      votes.length +
      "표</small></div><h2>" +
      esc(poll.topic) +
      "</h2>" +
      poll.options
        .map((o) => {
          const c = votes.filter((v) => v.option_id === o.id).length,
            p = votes.length ? Math.round((c / votes.length) * 100) : 0;
          return (
            '<div class="row" style="display:block"><b>' +
            esc(o.label) +
            '</b><span style="float:right">' +
            c +
            "표 · " +
            p +
            '%</span><div class="bar"><span style="width:' +
            p +
            '%"></span></div></div>'
          );
        })
        .join("") +
      "<h3>친구가 남긴 의견</h3>" +
      votes
        .filter((v) => v.note)
        .map(
          (v) =>
            '<div class="msg"><b>' +
            esc(v.voter_name || "익명") +
            "</b><p>" +
            esc(v.note) +
            "</p></div>",
        )
        .join("") +
      btn("새로고침", "stats", "secondary") +
      btn("홈으로", "home")
    );
  }
  function account() {
    return (
      "<h1>마이페이지</h1>" +
      (user
        ? '<div class="notice">로그인한 계정: ' +
          esc(user.email) +
          "</div>" +
          btn("내 선택 기록", "history") +
          btn("최근에 만든 투표", "recentpoll", "secondary") +
          btn("로그아웃", "logout", "secondary")
        : '<p class="sub">Google 계정으로 로그인하면 결과를 안전하게 저장하고 다른 기기에서도 이어볼 수 있어요.</p>' +
          btn("Google로 계속하기", "login"))
    );
  }
  function historypage() {
    return (
      "<h1>내 선택 기록</h1>" +
      (historyError
        ? '<p class="notice">기록을 불러오지 못했어요.</p>' +
          btn("다시 불러오기", "reloadhistory", "secondary")
        : "") +
      (!records.length
        ? '<p class="sub">아직 기록이 없어요.</p>'
        : records
            .map(
              (r, i) =>
                '<button class="tile" data-act="openhistory" data-i="' +
                i +
                '"><span>' +
                esc(r.title) +
                "</span><small>" +
                esc(winnerLabel(r)) +
                "</small></button>",
            )
            .join("")) +
      btn("새 고민 시작", "start")
    );
  }
  function foot(name = "다음") {
    return (
      '<div class="footer">' +
      btn("이전", "back", "secondary") +
      btn(name, "next") +
      "</div>"
    );
  }
  function render() {
    document
      .querySelector(".shell")
      .classList.toggle("guest-page", view === "vote");
    document.getElementById("authbutton").disabled = !authReady;
    document.getElementById("authbutton").textContent = user
      ? "MY PAGE ↗"
      : "로그인 ↗";
    $.innerHTML =
      view === "home"
        ? home()
        : view === "wizard"
          ? [one, two, three, four][step - 1]()
          : view === "result"
            ? result()
            : view === "setup"
              ? setup()
              : view === "share"
                ? share()
                : view === "vote"
                  ? publicvote()
                  : view === "stats"
                    ? stats()
                    : view === "account"
                      ? account()
                      : historypage();
  }
  const done = async () => {
    const weights = draft.criteria.length;
    const sum = (weights * (weights + 1)) / 2;
    const ranking = draft.options
      .map((o) => {
        const weighted = draft.criteria.reduce(
          (s, c, j) => s + (draft.ratings[o.id + "|" + c] || 3) * (weights - j),
          0,
        );
        return {
          ...o,
          name: o.name.trim(),
          weighted,
          score: Math.round((weighted / (sum * 5)) * 100),
        };
      })
      .sort((a, b) => b.score - a.score);
    decision = {
      id: id(),
      title: draft.title.trim(),
      category: draft.cat,
      criteria: [...draft.criteria],
      options: draft.options.map((x) => ({ ...x, name: x.name.trim() })),
      ratings: { ...draft.ratings },
      ranking,
      created_at: new Date().toISOString(),
    };
    rememberGuest(decision);
    go("result");
    if (user) await saveDecision(decision);
  };
  async function createPoll() {
    let expiry = new Date();
    if (deadline === "hour") expiry = new Date(expiry.getTime() + 3600e3);
    else
      expiry = new Date(
        expiry.getFullYear(),
        expiry.getMonth(),
        expiry.getDate() + (deadline === "tomorrow" ? 2 : 1),
      );
    const body = {
      topic: decision.title,
      options: decision.options.map((o) => ({ id: o.id, label: o.name })),
      owner_winner: showResult ? (winner(decision)?.name ?? null) : null,
      show_my_result: showResult,
      expires_at: expiry.toISOString(),
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
      let polls = read("polls", {});
      polls[poll.id] = poll;
      save("polls", polls);
    }
    go("share");
  }
  async function openpoll(key) {
    view = "vote";
    current = null;
    vote = "";
    note = "";
    voter = "";
    pollError = false;
    loading = true;
    render();
    const demo = uuid.test(key) ? read("polls", {})[key] : null;
    if (demo) current = demo;
    else if (uuid.test(key)) {
      const { data, error } = await supa.rpc("pickdrop_public_poll", {
        p_poll_id: key,
      });
      if (new URL(location.href).searchParams.get("poll") !== key) return;
      current = data;
      pollError = Boolean(error);
    }
    loading = false;
    if (view === "vote") render();
  }
  async function cast() {
    if (!vote || !current) return toast("선택지를 골라 주세요.");
    const key = "vote_key_" + current.id;
    const clientKey = read(key, null) ?? id();
    save(key, clientKey);
    const data = {
      poll_id: current.id,
      option_id: vote,
      note: note.trim() || null,
      voter_name: voter.trim() || null,
      client_key: clientKey,
    };
    if (current.demo) {
      const all = read("votes", {});
      all[current.id] = [...(all[current.id] || []), data];
      save("votes", all);
    } else {
      const { error } = await supa.rpc("pickdrop_cast_vote", {
        p_poll_id: data.poll_id,
        p_option_id: data.option_id,
        p_note: data.note,
        p_voter_name: data.voter_name,
        p_client_key: data.client_key,
      });
      if (error && error.code !== "23505")
        return toast(
          error.message === "Poll is closed"
            ? "마감된 투표예요."
            : "투표를 기록하지 못했어요. 다시 시도해 주세요.",
        );
    }
    save("voted_" + data.poll_id, true);
    render();
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
  $.addEventListener("input", (e) => {
    const n = e.target.dataset.in;
    if (n === "showresult") showResult = e.target.checked;
    if (n === "title") draft.title = e.target.value;
    if (n === "option")
      draft.options.find((o) => o.id === e.target.dataset.id).name =
        e.target.value;
    if (n === "note") note = e.target.value;
    if (n === "voter") voter = e.target.value;
    if (n === "title" || n === "option") save("draft", draft);
  });
  document.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-act]");
    if (!t) return;
    const a = t.dataset.act;
    if (pending) return;
    pending = true;
    t.disabled = true;
    status.textContent = "";
    try {
      if (a === "loginpoll") {
        sessionStorage.setItem(
          "pd_resume",
          JSON.stringify({ view: "setup", decision, deadline, showResult }),
        );
        go("account");
      } else if (a === "home") {
        window.history.replaceState(null, "", location.pathname);
        go("home");
      } else if (a === "start" || a === "friend") {
        friendFlow = a === "friend";
        draft = fresh();
        save("draft", draft);
        step = 1;
        go("wizard");
      } else if (a === "cat") {
        if (draft.cat === t.dataset.val) return;
        draft.cat = t.dataset.val;
        draft.criteria = PRESETS[draft.cat][1].slice(0, 3);
        mark(draft);
      } else if (a === "crit") {
        const c = t.dataset.val;
        if (draft.criteria.includes(c)) {
          if (draft.criteria.length === 1)
            return toast("기준이 하나 이상 필요해요");
          draft.criteria = draft.criteria.filter((x) => x !== c);
        } else draft.criteria.push(c);
        mark(draft);
      } else if (a === "add") {
        if (draft.options.length < 4)
          draft.options.push({ id: id(), name: "" });
        mark(draft);
      } else if (a === "remove") {
        draft.options = draft.options.filter((o) => o.id !== t.dataset.id);
        mark(draft);
      } else if (a === "move") {
        const i = +t.dataset.i,
          j = i + +t.dataset.d;
        if (j >= 0 && j < draft.criteria.length)
          [draft.criteria[i], draft.criteria[j]] = [
            draft.criteria[j],
            draft.criteria[i],
          ];
        mark(draft);
      } else if (a === "score") {
        draft.ratings[t.dataset.id + "|" + t.dataset.c] = +t.dataset.n;
        mark(draft);
      } else if (a === "back") {
        if (step > 1) {
          step--;
          render();
        } else go("home");
      } else if (a === "next") {
        if (step === 1 && !draft.title.trim())
          return toast("고민 제목을 입력해 주세요");
        if (step === 2 && draft.options.some((o) => !o.name.trim()))
          return toast("후보 이름을 입력해 주세요");
        if (step === 2 && friendFlow) {
          decision = {
            id: id(),
            title: draft.title.trim(),
            options: draft.options.map((o) => ({ ...o, name: o.name.trim() })),
            ranking: [],
            criteria: [],
            ratings: {},
          };
          showResult = false;
          go("setup");
        } else if (step === 4) await done();
        else {
          step++;
          render();
          window.scrollTo(0, 0);
        }
      } else if (a === "choose") {
        if (user) {
          if (await saveDecision(decision)) toast("결정을 저장했어요.");
        } else {
          rememberGuest(decision);
          toast("이 기기에 결정을 저장했어요.");
        }
      } else if (a === "pickwinner" || a === "priority") {
        const tied = tie(decision);
        const selected =
          a === "pickwinner"
            ? tied.find((option) => option.id === t.dataset.id)
            : [...tied].sort((left, right) => {
                for (const criterion of decision.criteria) {
                  const comparison =
                    (decision.ratings[right.id + "|" + criterion] ?? 3) -
                    (decision.ratings[left.id + "|" + criterion] ?? 3);
                  if (comparison) return comparison;
                }
                return 0;
              })[0];
        if (
          a === "priority" &&
          tied.every((option) =>
            decision.criteria.every(
              (criterion) =>
                (decision.ratings[option.id + "|" + criterion] ?? 3) ===
                (decision.ratings[selected.id + "|" + criterion] ?? 3),
            ),
          )
        )
          return toast("모든 기준에서도 동점이에요. 후보를 직접 골라 주세요.");
        if (selected) {
          decision = { ...decision, chosenId: selected.id };
          rememberGuest(decision);
          render();
          if (user) await saveDecision(decision);
        }
      } else if (a === "makepoll") {
        showResult = false;
        go("setup");
      } else if (a === "reloadhistory" && user) await loadHistory(user.id);
      else if (a === "retryvote")
        await openpoll(new URL(location.href).searchParams.get("poll"));
      else if (a === "deadline") {
        deadline = t.dataset.val;
        render();
      } else if (a === "createpoll") await createPoll();
      else if (a === "copy") {
        const url = pollLink(poll.id);
        try {
          await navigator.clipboard.writeText(url.href);
          toast("링크를 복사했어요.");
        } catch {
          const input = $.querySelector("input[readonly]");
          input?.select();
          toast("선택된 링크를 복사해 주세요.");
        }
      } else if (a === "visit") {
        const u = pollLink(poll.id);
        window.history.pushState(null, "", u);
        await openpoll(poll.id);
      } else if (a === "voteselect") {
        vote = t.dataset.id;
        render();
      } else if (a === "cast") await cast();
      else if (a === "stats") await statsLoad();
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
        go("share");
      } else if (a === "history") go("history");
      else if (a === "openhistory") {
        decision = records[+t.dataset.i];
        go("result");
      } else if (a === "account") go("account");
      else if (a === "login") {
        const { error } = await supa.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: location.origin + location.pathname },
        });
        if (error)
          toast(
            error.message.includes("provider is not enabled")
              ? "현재 Google 로그인을 사용할 수 없어요."
              : "Google 로그인을 시작하지 못했어요. 다시 시도해 주세요.",
          );
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
          return go("account");
        }
        if (await saveDecision(decision)) toast("결과를 저장했어요.");
      }
    } catch (err) {
      console.error(err);
      toast("문제가 발생했어요. 다시 시도해 주세요.");
    } finally {
      pending = false;
      t.disabled = false;
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
          showResult = saved.showResult ?? false;
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
    status.textContent = "";
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
