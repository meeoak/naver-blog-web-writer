const $ = (id) => document.getElementById(id);

const state = {
  photos: [],
  titleCandidates: [],
  naverPost: "",
  blogspotPost: "",
  tags: [],
  voicePresets: loadVoicePresets(),
};

const aiSmells = [
  ["만족스러운 경험이었습니다", "좋았어"],
  ["만족스러운 경험", "괜찮았어"],
  ["인상적이었습니다", "기억에 남았어"],
  ["추천드립니다", "괜찮을 것 같아"],
  ["도움이 되었으면 합니다", ""],
  ["이 글은", ""],
  ["검색으로 얻기 어려운", ""],
  ["꼭 방문해야 하는", "한 번쯤 가볼 만한"],
  ["최고의 맛집", "다시 갈 만한 곳"],
  ["전반적으로", "내 기준으로는"],
];

const adRules = [
  {
    category: "여행/숙소/항공권",
    triggers: ["여행", "자카르타", "인도네시아", "Kota", "Jakarta", "몰", "위치"],
    ads: ["항공권", "호텔", "숙소 예약", "여행 앱"],
  },
  {
    category: "로밍/eSIM/유심",
    triggers: ["해외", "여행", "자카르타", "인도네시아", "주재원"],
    ads: ["eSIM", "로밍", "유심", "해외 데이터"],
  },
  {
    category: "해외결제 카드/환전",
    triggers: ["해외생활", "주재원", "여행", "인도네시아"],
    ads: ["트래블카드", "환전", "해외결제 카드"],
  },
  {
    category: "맛집/배달/예약",
    triggers: ["맛집", "식당", "메뉴", "사테", "우당", "자헤", "음식", "restaurant"],
    ads: ["레스토랑 예약", "배달 앱", "맛집 플랫폼"],
  },
  {
    category: "언어/번역/생활 서비스",
    triggers: ["인니어", "메뉴판", "주재원", "현지", "생활"],
    ads: ["번역 앱", "인도네시아어 학습", "현지 생활 서비스"],
  },
];

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  renderVoicePresets();
  generateAll();
});

function bindEvents() {
  $("generateBtn").addEventListener("click", generateAll);
  $("refreshReportBtn").addEventListener("click", refreshFromEditor);
  $("dietTagsBtn").addEventListener("click", dietTagsFromEditor);
  $("photoInput").addEventListener("change", handlePhotos);
  $("saveVoiceBtn").addEventListener("click", saveVoicePreset);
  $("resetBtn").addEventListener("click", resetInputs);
  $("renderThumbBtn").addEventListener("click", drawThumbnail);
  $("downloadThumbBtn").addEventListener("click", downloadThumbnail);
  $("copyPostBtn").addEventListener("click", () => copyText($("postEditor").value));
  $("copyBlogspotBtn").addEventListener("click", () => copyText($("blogspotEditor").value));
  $("downloadPostBtn").addEventListener("click", () => downloadText("naver_post.md", $("postEditor").value));
  $("downloadBlogspotBtn").addEventListener("click", () => downloadText("blogspot_post.md", $("blogspotEditor").value));
  $("fixAiBtn").addEventListener("click", fixAiSmell);
  $("tagEditor").addEventListener("input", () => {
    state.tags = parseCommaOrSpaceTags($("tagEditor").value);
    refreshReports();
  });
  $("postEditor").addEventListener("input", debounce(refreshReports, 250));
  $("brandInput").addEventListener("input", drawThumbnail);
  $("accentInput").addEventListener("input", drawThumbnail);
  $("thumbTitleInput").addEventListener("input", drawThumbnail);
  $("thumbRibbonInput").addEventListener("input", drawThumbnail);

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => activateTab(tab.dataset.tab));
  });

  document.querySelectorAll("[data-insert]").forEach((btn) => {
    btn.addEventListener("click", () => insertSnippet(btn.dataset.insert));
  });
}

function activateTab(name) {
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("is-active", tab.dataset.tab === name));
  document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.remove("is-active"));
  $(`${name}Tab`).classList.add("is-active");
  if (name === "thumbnail") drawThumbnail();
  if (name === "report") refreshReports();
}

function getInput() {
  return {
    topic: $("topicInput").value.trim(),
    place: $("placeInput").value.trim(),
    date: $("dateInput").value.trim(),
    situation: $("situationInput").value.trim(),
    experience: lines($("experienceInput").value),
    menus: parseMenus($("menuInput").value),
    keywordsKo: splitList($("keywordKoInput").value),
    keywordsGoogle: splitList($("keywordGoogleInput").value),
    thumbTitle: $("thumbTitleInput").value.trim(),
    thumbRibbon: $("thumbRibbonInput").value.trim(),
    brand: $("brandInput").value.trim() || "Ara in Indonesia",
    voice: $("voiceInput").value.trim(),
  };
}

function lines(text) {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function splitList(text) {
  return text.split(/[,#\n]/).map((item) => item.trim()).filter(Boolean);
}

function parseMenus(text) {
  return lines(text).map((line) => {
    const [rawName, ...rest] = line.split("|");
    const nameText = rawName.trim();
    const match = nameText.match(/^(.+?)\((.+?)\)$/);
    return {
      name: match ? match[1].trim() : nameText,
      local: match ? match[2].trim() : "",
      note: rest.join("|").trim(),
    };
  }).filter((menu) => menu.name);
}

function handlePhotos(event) {
  const files = Array.from(event.target.files || []);
  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      state.photos.push({
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
        name: file.name,
        dataUrl: reader.result,
        caption: autoCaption(file.name, state.photos.length),
        note: "",
        role: autoRole(file.name, state.photos.length),
      });
      renderPhotos();
      drawThumbnail();
      refreshReports();
    };
    reader.readAsDataURL(file);
  });
  event.target.value = "";
}

function autoCaption(filename, index) {
  const lower = filename.toLowerCase();
  if (lower.includes("menu")) return "메뉴판";
  if (lower.includes("sate") || lower.includes("사테")) return "사테";
  if (lower.includes("udang") || lower.includes("새우")) return "우당 바카르";
  if (lower.includes("drink") || lower.includes("jahe")) return "자헤 마두";
  if (index === 0) return "입구와 분위기";
  return `사진 ${index + 1}`;
}

function autoRole(filename, index) {
  const lower = filename.toLowerCase();
  if (index === 0) return "thumbnail";
  if (lower.includes("menu")) return "menu";
  if (lower.includes("sate") || lower.includes("udang") || lower.includes("food")) return "food";
  return "body";
}

function renderPhotos() {
  const list = $("photoList");
  if (!state.photos.length) {
    list.innerHTML = `<p class="metric-row">사진을 넣으면 썸네일과 본문 배치에 반영돼요.</p>`;
    return;
  }
  list.innerHTML = state.photos.map((photo) => `
    <div class="photo-item" data-id="${photo.id}">
      <img src="${photo.dataUrl}" alt="${escapeHtml(photo.caption)}">
      <div class="photo-fields">
        <div class="mini-grid">
          <input data-photo-field="caption" value="${escapeAttr(photo.caption)}" aria-label="사진 설명">
          <select data-photo-field="role" aria-label="사진 역할">
            ${roleOptions(photo.role)}
          </select>
        </div>
        <input data-photo-field="note" value="${escapeAttr(photo.note)}" placeholder="이 사진에 대한 경험 메모">
      </div>
    </div>
  `).join("");

  list.querySelectorAll("[data-photo-field]").forEach((field) => {
    field.addEventListener("input", () => {
      const item = field.closest(".photo-item");
      const photo = state.photos.find((entry) => entry.id === item.dataset.id);
      photo[field.dataset.photoField] = field.value;
      refreshReports();
      if (field.dataset.photoField === "role" || field.dataset.photoField === "caption") drawThumbnail();
    });
  });
}

function roleOptions(current) {
  const roles = [
    ["thumbnail", "썸네일"],
    ["exterior", "외관/입구"],
    ["interior", "분위기"],
    ["menu", "메뉴판"],
    ["food", "음식"],
    ["drink", "음료"],
    ["map", "지도/위치"],
    ["body", "기타"],
  ];
  return roles.map(([value, label]) => `<option value="${value}" ${value === current ? "selected" : ""}>${label}</option>`).join("");
}

function generateAll() {
  const input = getInput();
  state.titleCandidates = makeTitleCandidates(input);
  state.tags = makeTags(input);
  state.naverPost = makeNaverPost(input, state.tags);
  state.blogspotPost = makeBlogspotPost(input, state.tags);
  $("postEditor").value = state.naverPost;
  $("blogspotEditor").value = state.blogspotPost;
  $("tagEditor").value = state.tags.join(" ");
  renderTitleCandidates();
  drawThumbnail();
  refreshReports();
}

function makeTitleCandidates(input) {
  const place = input.place || input.topic || "네이버 블로그 후기";
  const ko = input.keywordsKo[0] || "네이버 블로그 후기";
  return [
    { type: "검색형", text: `${place} 후기｜${ko} 추천 메뉴와 방문 팁` },
    { type: "경험형", text: `퇴근길에 다시 찾은 ${shortPlace(place)}` },
    { type: "메뉴형", text: `${shortPlace(place)} 메뉴 후기｜${menuNames(input).join("·") || "추천 메뉴"}` },
    { type: "주재원형", text: `${shortPlace(place)}｜자카르타 주재원 맛집으로 괜찮을까` },
    { type: "구글형", text: `${place} Review｜Kokas Jakarta 맛집` },
  ];
}

function shortPlace(place) {
  return place.replace("Kota Kasablanka", "Kokas").trim();
}

function menuNames(input) {
  return input.menus.map((menu) => menu.name).filter(Boolean).slice(0, 3);
}

function makeNaverPost(input, tags) {
  const title = state.titleCandidates[0]?.text || input.topic;
  const place = input.place || input.topic;
  const photoPlan = makePhotoPlan(input);
  const checkPoints = makeCheckPoints(input);
  const menuText = menuSection(input);
  const voice = input.voice ? `\n${input.voice}` : "";
  const tagLine = tags.join(" ");

  return [
    title,
    "",
    "다시 가도 좋았던 이유",
    ...checkPoints.map((item) => `· ${item}`),
    "",
    "방문한 날의 기록",
    [input.date, input.situation].filter(Boolean).join(", "),
    voice.trim(),
    "",
    `${shortPlace(place)}는 이런 곳이야`,
    `${place}는 내 기준으로 편하게 들르기 좋은 곳이야. 너무 어렵게 느껴지는 현지 음식점이라기보다, 처음 가는 사람도 비교적 무난하게 먹기 좋은 쪽에 가까웠어.`,
    "",
    "사진으로 본 분위기",
    ...photoPlan.slice(0, 6).flatMap((photo) => [`[사진 ${photo.index}: ${photo.caption}]`, photo.note].filter(Boolean)),
    "",
    menuText,
    "",
    "예약과 방문 팁",
    "점심시간이나 저녁 피크 시간에는 사람이 몰릴 수 있어서, 여럿이 간다면 미리 확인하고 가는 편이 마음 편할 것 같아.",
    "",
    "방문 전 자주 묻는 질문",
    "Q. 한국인 입맛에 맞을까?",
    "A. 내 기준으로는 꽤 무난했어. 향신료가 아예 없는 건 아니지만, 구운 메뉴나 소스가 있는 메뉴는 부담 없이 먹기 좋았어.",
    "",
    "Q. 많이 매울까?",
    "A. 기본 메뉴 자체가 엄청 매운 느낌은 아니었어. 삼발을 많이 곁들이면 매콤해질 수 있으니까, 매운 걸 잘 못 먹는다면 조금씩 찍어 먹는 게 좋아.",
    "",
    "Q. 다시 갈 만한 곳일까?",
    "A. 응, 나는 다시 갈 것 같아. 특별한 날보다 평범한 날 밥 먹으러 가기 좋은 곳에 가까웠어.",
    "",
    "결론은,, 다시 갈 만한 곳",
    `${place}는 내 기준으로 다시 갈 만한 곳이야. 엄청 화려하게 특별하다기보다, 실패 확률이 낮고 편하게 먹기 좋은 곳이라는 점이 마음에 들었어.`,
    "",
    tagLine,
  ].filter((line) => line !== undefined).join("\n");
}

function makeBlogspotPost(input, tags) {
  const place = input.place || input.topic;
  const title = `${place} Review｜Kokas Jakarta 맛집`;
  const english = `${place} is an Indonesian restaurant in Kokas mall, Jakarta, good for ${input.menus.map((menu) => menu.local || menu.name).filter(Boolean).slice(0, 3).join(", ")}.`;
  return [
    title,
    "",
    "Search description",
    `${place} 후기. 코타카사블랑카 Kokas 안에서 먹은 메뉴와 한국인 입맛 기준 방문 팁.`,
    "",
    "Intro",
    [input.date, input.situation].filter(Boolean).join(", "),
    "",
    "Quick Summary",
    ...makeCheckPoints(input).map((item) => `- ${item}`),
    "",
    "Menu Review",
    ...input.menus.flatMap((menu) => [`### ${menu.name}${menu.local ? ` (${menu.local})` : ""}`, menu.note || "내 기준으로 무난하게 먹기 좋았어.", ""]),
    "FAQ",
    "Q. Is it good for Korean visitors?",
    "A. 내 기준으로는 처음 인도네시아 음식을 먹는 한국인도 비교적 편하게 먹기 좋은 편이야.",
    "",
    english,
    "",
    tags.join(" "),
  ].join("\n");
}

function makeCheckPoints(input) {
  const items = [];
  input.experience.forEach((item) => items.push(cleanSentence(item)));
  if (input.menus.length) items.push(`이번에 먹은 ${menuNames(input).join(", ")}`);
  if (input.keywordsKo.some((item) => item.includes("주재원"))) items.push("주재원이나 자카르타 생활 중 들르기 좋은 위치");
  return unique(items).slice(0, 6);
}

function cleanSentence(text) {
  return text.replace(/[.。]$/g, "").trim();
}

function menuSection(input) {
  if (!input.menus.length) return "";
  const intro = `이날은 ${input.menus.map((menu) => `${menu.name}${menu.local ? `(${menu.local})` : ""}`).join(", ")}를 먹었어.`;
  const sections = input.menus.flatMap((menu) => [
    "",
    `${menu.name}${menu.local ? `(${menu.local})` : ""}`,
    menu.note || `${menu.name}는 내 기준으로 꽤 무난하게 먹기 좋았어.`,
  ]);
  return ["방문해서 먹은 메뉴", "", intro, ...sections].join("\n");
}

function makeTags(input) {
  const base = [
    ...input.keywordsKo,
    ...input.keywordsGoogle,
    input.place,
    ...input.menus.flatMap((menu) => [menu.name, menu.local]),
    "자카르타일상",
  ];
  return dietTags(base.map(toTag), 18);
}

function toTag(text) {
  return text ? `#${String(text).replace(/\s+/g, "")}` : "";
}

function dietTags(tags, limit = 18) {
  const scored = unique(tags.filter(Boolean)).map((tag) => ({
    tag,
    score: tagScore(tag),
  }));
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((item) => item.tag);
}

function tagScore(tag) {
  let score = 1;
  if (/맛집|Pesta|Kokas|Kota|Kasablanka/i.test(tag)) score += 4;
  if (/사테|우당|자헤|Sate|Udang|Jahe/i.test(tag)) score += 3;
  if (/주재원|여행|인도네시아|자카르타/i.test(tag)) score += 2;
  if (/Restaurant|Food|Mall/i.test(tag)) score += 1;
  return score;
}

function makePhotoPlan(input) {
  return state.photos.map((photo, index) => ({
    index: index + 1,
    caption: photo.caption || `사진 ${index + 1}`,
    role: photo.role,
    note: photo.note || photoPlacementNote(photo, input),
    alt: `${input.place || input.topic} ${photo.caption || photo.role}`,
  }));
}

function photoPlacementNote(photo) {
  if (photo.role === "thumbnail") return "첫 화면과 썸네일에 쓰기 좋은 사진.";
  if (photo.role === "interior") return "분위기 설명 파트에 넣기 좋은 사진.";
  if (photo.role === "food") return "메뉴 후기 파트에 넣기 좋은 사진.";
  if (photo.role === "map") return "위치와 이동 팁 파트에 넣기 좋은 사진.";
  return "본문 흐름에 맞춰 넣기 좋은 사진.";
}

function renderTitleCandidates() {
  $("titleCandidates").innerHTML = state.titleCandidates.map((item) => `
    <button class="title-card" type="button" data-title="${escapeAttr(item.text)}">
      <strong>${escapeHtml(item.type)}</strong>
      ${escapeHtml(item.text)}
    </button>
  `).join("");
  $("titleCandidates").querySelectorAll(".title-card").forEach((button) => {
    button.addEventListener("click", () => applyTitle(button.dataset.title));
  });
}

function applyTitle(title) {
  const lines = $("postEditor").value.split(/\r?\n/);
  lines[0] = title;
  $("postEditor").value = lines.join("\n");
  refreshReports();
}

function refreshFromEditor() {
  refreshReports();
  drawThumbnail();
}

function refreshReports() {
  const text = $("postEditor").value;
  const tags = parseCommaOrSpaceTags($("tagEditor").value || state.tags.join(" "));
  renderCounts(text);
  renderKeywordReport(text, tags);
  renderAdReport(text);
  renderAiReport(text);
  renderChecklist(text, tags);
  renderPhotoPlanReport();
}

function renderCounts(text) {
  const withoutSpaces = text.replace(/\s/g, "").length;
  const withSpaces = text.length;
  const paragraphs = lines(text).length;
  const status = withoutSpaces >= 2500 ? "좋음" : withoutSpaces >= 1500 ? "보통" : "짧음";
  const cls = withoutSpaces >= 2500 ? "status-good" : withoutSpaces >= 1500 ? "status-warn" : "status-bad";
  $("countReport").innerHTML = `
    <div class="metric-row">공백 포함: <strong>${withSpaces.toLocaleString()}</strong>자</div>
    <div class="metric-row">공백 제외: <strong>${withoutSpaces.toLocaleString()}</strong>자</div>
    <div class="metric-row">문단 수: <strong>${paragraphs}</strong>개</div>
    <div class="metric-row">밀도 판단: <span class="${cls}">${status}</span></div>
  `;
}

function renderKeywordReport(text, tags) {
  const input = getInput();
  const explicit = [...input.keywordsKo, ...input.keywordsGoogle, ...tags.map((tag) => tag.replace("#", ""))];
  const found = keywordForecast(text, explicit).slice(0, 12);
  $("keywordReport").innerHTML = `<ul class="report-list">${found.map((item) => `<li>${escapeHtml(item.keyword)} <span class="status-good">${item.intent}</span></li>`).join("")}</ul>`;
}

function keywordForecast(text, explicit) {
  const counts = new Map();
  explicit.filter(Boolean).forEach((keyword) => bump(counts, keyword, 2));
  const regexes = [
    /[가-힣A-Za-z]+맛집/g,
    /[가-힣A-Za-z]+여행/g,
    /[가-힣A-Za-z]+주재원/g,
    /\b[A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+){0,3}\b/g,
  ];
  regexes.forEach((regex) => {
    [...text.matchAll(regex)].forEach((match) => bump(counts, match[0], 1));
  });
  return [...counts.entries()]
    .filter(([keyword]) => keyword.length > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([keyword]) => ({ keyword, intent: keywordIntent(keyword) }));
}

function keywordIntent(keyword) {
  if (/맛집|Restaurant/i.test(keyword)) return "장소 후보";
  if (/주재원/.test(keyword)) return "생활 정보";
  if (/여행/.test(keyword)) return "여행 일정";
  if (/Sate|Udang|Jahe|사테|우당|자헤/i.test(keyword)) return "메뉴 확인";
  return "장소명 검색";
}

function renderAdReport(text) {
  const lower = text.toLowerCase();
  const results = adRules.map((rule) => {
    const matched = rule.triggers.filter((trigger) => lower.includes(trigger.toLowerCase()));
    return { ...rule, matched };
  }).filter((rule) => rule.matched.length);
  $("adReport").innerHTML = results.length
    ? `<ul class="report-list">${results.map((item) => `<li><strong>${item.category}</strong> ${item.matched.length >= 3 ? "높음" : "보통"}<br>${item.ads.join(", ")}</li>`).join("")}</ul>`
    : `<p class="metric-row">광고 예측 신호가 아직 약해요.</p>`;
}

function renderAiReport(text) {
  const found = aiSmells.filter(([bad]) => text.includes(bad));
  $("aiReport").innerHTML = found.length
    ? `<ul class="report-list">${found.map(([bad, good]) => `<li>${escapeHtml(bad)} → ${escapeHtml(good || "삭제")}</li>`).join("")}</ul>`
    : `<p class="metric-row status-good">감지된 표현 없음</p>`;
}

function renderChecklist(text, tags) {
  const checks = [
    ["제목에 장소명 포함", text.split(/\r?\n/)[0]?.includes(getInput().place.split(" ")[0] || "")],
    ["첫 문단에 방문 상황 포함", Boolean(getInput().situation && text.includes(getInput().situation.slice(0, 8)))],
    ["사진 위치 표시 있음", text.includes("[사진") || state.photos.length === 0],
    ["태그 18개 이하", tags.length <= 18],
    ["FAQ 포함", text.includes("Q.") && text.includes("A.")],
    ["AI 느낌 표현 없음", !aiSmells.some(([bad]) => text.includes(bad))],
  ];
  $("checklistReport").innerHTML = checks.map(([label, pass]) => `
    <div class="check-row"><span class="${pass ? "status-good" : "status-warn"}">${pass ? "완료" : "확인"}</span> ${label}</div>
  `).join("");
}

function renderPhotoPlanReport() {
  const input = getInput();
  const plan = makePhotoPlan(input);
  $("photoPlanReport").innerHTML = plan.length
    ? `<ul class="report-list">${plan.map((photo) => `<li>사진 ${photo.index}: ${escapeHtml(photo.caption)} / ${escapeHtml(photo.role)}<br>${escapeHtml(photo.note)}<br>alt: ${escapeHtml(photo.alt)}</li>`).join("")}</ul>`
    : `<p class="metric-row">사진을 올리면 자동 배치 계획이 생겨요.</p>`;
}

function dietTagsFromEditor() {
  const input = getInput();
  const current = parseCommaOrSpaceTags($("tagEditor").value);
  const next = dietTags([...current, ...makeTags(input)], 18);
  state.tags = next;
  $("tagEditor").value = next.join(" ");
  const text = $("postEditor").value.replace(/\n#[^\n#]+(?:\s+#[^\n#]+)*\s*$/m, "").trim();
  $("postEditor").value = `${text}\n\n${next.join(" ")}`;
  refreshReports();
}

function parseCommaOrSpaceTags(text) {
  return unique(String(text).split(/[\s,]+/).map((item) => item.trim()).filter(Boolean).map((item) => item.startsWith("#") ? item : `#${item}`));
}

function fixAiSmell() {
  let text = $("postEditor").value;
  aiSmells.forEach(([bad, good]) => {
    text = text.split(bad).join(good);
  });
  $("postEditor").value = text.replace(/[ \t]+\n/g, "\n").replace(/\n{4,}/g, "\n\n\n");
  refreshReports();
}

function insertSnippet(type) {
  const editor = $("postEditor");
  const snippets = {
    h2: "\n\n새 단락 제목\n",
    h3: "\n\n메뉴명\n이 메뉴는 내 기준으로...\n",
    photo: "\n\n[사진: 설명]\n사진 설명을 여기에 써줘.\n",
    faq: "\n\nQ. 궁금한 점?\nA. 내 기준으로는...\n",
  };
  insertAtCursor(editor, snippets[type] || "");
  refreshReports();
}

function insertAtCursor(textarea, text) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  textarea.value = textarea.value.slice(0, start) + text + textarea.value.slice(end);
  textarea.focus();
  textarea.selectionStart = textarea.selectionEnd = start + text.length;
}

function saveVoicePreset() {
  const value = $("voiceInput").value.trim();
  if (!value) return;
  state.voicePresets = unique([value, ...state.voicePresets]).slice(0, 8);
  localStorage.setItem("naverBlogVoicePresets", JSON.stringify(state.voicePresets));
  renderVoicePresets();
}

function loadVoicePresets() {
  try {
    return JSON.parse(localStorage.getItem("naverBlogVoicePresets") || "[]");
  } catch {
    return [];
  }
}

function renderVoicePresets() {
  $("voicePresetList").innerHTML = state.voicePresets.map((preset) => `
    <button class="chip" type="button" data-preset="${escapeAttr(preset)}">${escapeHtml(preset.slice(0, 28))}${preset.length > 28 ? "..." : ""}</button>
  `).join("");
  $("voicePresetList").querySelectorAll(".chip").forEach((button) => {
    button.addEventListener("click", () => {
      $("voiceInput").value = button.dataset.preset;
    });
  });
}

function drawThumbnail() {
  const canvas = $("thumbnailCanvas");
  const ctx = canvas.getContext("2d");
  const input = getInput();
  const photo = state.photos.find((item) => item.role === "thumbnail") || state.photos[0];
  const accent = $("accentInput").value || "#d86b79";
  if (photo) {
    const img = new Image();
    img.onload = () => {
      coverImage(ctx, img, canvas.width, canvas.height);
      drawThumbnailOverlay(ctx, canvas, input, accent);
    };
    img.src = photo.dataUrl;
  } else {
    drawFallbackBackground(ctx, canvas);
    drawThumbnailOverlay(ctx, canvas, input, accent);
  }
}

function coverImage(ctx, img, width, height) {
  const ratio = Math.max(width / img.width, height / img.height);
  const drawWidth = img.width * ratio;
  const drawHeight = img.height * ratio;
  ctx.drawImage(img, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

function drawFallbackBackground(ctx, canvas) {
  const w = canvas.width;
  const h = canvas.height;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#23180f");
  grad.addColorStop(0.6, "#4b2f1f");
  grad.addColorStop(1, "#82502d");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#7b4a28";
  ctx.fillRect(0, 455, w, 265);
  drawPlate(ctx, 770, 518, 430, 220, "#7a3e22");
  drawPlate(ctx, 390, 585, 460, 220, "#8c431f");
  ctx.fillStyle = "#f6eedc";
  ctx.beginPath();
  ctx.ellipse(570, 430, 90, 70, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 9; i += 1) {
    ctx.strokeStyle = "#c9954d";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(730 + i * 32, 552);
    ctx.lineTo(1010 + i * 18, 446);
    ctx.stroke();
  }
  for (let i = 0; i < 9; i += 1) {
    ctx.fillStyle = i % 2 ? "#d1aa5b" : "#805436";
    ctx.beginPath();
    ctx.arc(230 + i * 115, 66 + (i % 3) * 25, 18, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlate(ctx, x, y, w, h, fill) {
  ctx.fillStyle = "#d6c5a8";
  ctx.beginPath();
  ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, w / 2 - 45, h / 2 - 28, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawThumbnailOverlay(ctx, canvas, input, accent) {
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = "rgba(0, 0, 0, 0.38)";
  ctx.fillRect(0, 0, w, h);
  const radial = ctx.createRadialGradient(780, 360, 80, 780, 360, 680);
  radial.addColorStop(0, "rgba(0,0,0,0)");
  radial.addColorStop(1, "rgba(0,0,0,0.28)");
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, w, h);

  drawBrandPill(ctx, input.brand || "Ara in Indonesia");
  const [top, bottom] = splitTitle(input.thumbTitle || shortPlace(input.place || input.topic));
  drawShadowText(ctx, top, 56, 154, "76px Georgia", "#fff8ef", "#111");
  if (bottom) drawShadowText(ctx, bottom, 56, 300, "138px Georgia", accent, "#111");
  drawRibbon(ctx, input.thumbRibbon || "내 기준 솔직 후기", accent, bottom ? 482 : 354);
}

function drawBrandPill(ctx, label) {
  ctx.save();
  ctx.font = "700 23px Arial";
  const width = Math.max(242, ctx.measureText(label).width + 92);
  roundRect(ctx, 44, 43, width, 52, 26, "#13244a", true);
  roundRect(ctx, 50, 50, width, 52, 26, "rgba(0,0,0,0.24)", true);
  roundRect(ctx, 44, 43, width, 52, 26, "#13244a", true);
  ctx.fillStyle = "#e76d82";
  ctx.font = "28px Georgia";
  ctx.fillText("♥", 70, 78);
  ctx.fillStyle = "#fff";
  ctx.font = "700 23px Arial";
  ctx.fillText(label, 110, 77);
  ctx.restore();
}

function drawShadowText(ctx, text, x, y, font, color, shadow) {
  ctx.save();
  ctx.font = `700 ${font}`;
  ctx.lineJoin = "round";
  ctx.strokeStyle = shadow;
  ctx.lineWidth = 5;
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillText(text, x + 5, y + 7);
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawRibbon(ctx, text, accent, y) {
  ctx.save();
  let fontSize = 44;
  ctx.font = `700 italic ${fontSize}px Georgia`;
  while (ctx.measureText(text).width > 570 && fontSize > 30) {
    fontSize -= 2;
    ctx.font = `700 italic ${fontSize}px Georgia`;
  }
  const textWidth = ctx.measureText(text).width;
  const x = 60;
  const width = Math.max(545, Math.min(textWidth + 150, 730));
  const points = [
    [x + 8, y + 10],
    [x + width - 16, y],
    [x + width, y + 58],
    [x + 18, y + 66],
    [x, y + 32],
  ];
  polygon(ctx, points.map(([px, py]) => [px + 5, py + 7]), "rgba(0,0,0,0.32)");
  polygon(ctx, points, "#14264b");
  ctx.fillStyle = "#fff8ef";
  ctx.fillText(text, x + 36, y + 45);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(x + 36, y + 58);
  ctx.lineTo(x + Math.min(textWidth + 35, width - 72), y + 53);
  ctx.stroke();
  drawFlower(ctx, x + Math.min(textWidth + 88, width - 52), y + 35);
  ctx.restore();
}

function splitTitle(title) {
  const parts = title.trim().split(/\s+/);
  if (parts.length >= 3) return [parts.slice(0, -1).join(" "), parts.at(-1)];
  if (parts.length === 2) return [parts[0], parts[1]];
  return [title, ""];
}

function drawFlower(ctx, x, y) {
  ctx.fillStyle = "#f2a244";
  for (let i = 0; i < 8; i += 1) {
    const angle = (Math.PI * 2 * i) / 8;
    ctx.beginPath();
    ctx.arc(x + Math.cos(angle) * 12, y + Math.sin(angle) * 12, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#f8d36d";
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();
}

function polygon(ctx, points, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fill();
}

function roundRect(ctx, x, y, w, h, r, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

function downloadThumbnail() {
  const link = document.createElement("a");
  link.download = "naver-thumbnail.png";
  link.href = $("thumbnailCanvas").toDataURL("image/png");
  link.click();
}

function resetInputs() {
  if (!confirm("입력과 결과를 초기화할까요?")) return;
  state.photos = [];
  renderPhotos();
  generateAll();
}

function copyText(text) {
  navigator.clipboard.writeText(text);
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  link.download = filename;
  link.href = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
}

function unique(items) {
  const seen = new Set();
  const result = [];
  items.forEach((item) => {
    const key = String(item).trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(String(item).trim());
  });
  return result;
}

function bump(map, key, amount) {
  const clean = String(key).trim();
  if (!clean) return;
  map.set(clean, (map.get(clean) || 0) + amount);
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function escapeAttr(text) {
  return escapeHtml(text).replace(/\n/g, " ");
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

