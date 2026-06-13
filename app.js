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
  renderPhotos();
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
  $("convertBlogspotBtn").addEventListener("click", convertCurrentNaverToBlogspot);
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
  if (!files.length) {
    updatePhotoStatus("선택된 사진이 없어요.");
    return;
  }

  let loaded = 0;
  updatePhotoStatus(`${files.length}장 불러오는 중...`);
  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      state.photos.push({
        id: makeId(),
        name: file.name,
        dataUrl: reader.result,
        caption: autoCaption(file.name, state.photos.length),
        note: "",
        role: autoRole(file.name, state.photos.length),
      });
      loaded += 1;
      renderPhotos();
      drawThumbnail();
      refreshReports();
      updatePhotoStatus(`${loaded}장 추가됨. 필요하면 사진 설명과 역할을 바꿔줘.`);
    };
    reader.onerror = () => {
      loaded += 1;
      updatePhotoStatus(`${file.name} 파일을 읽지 못했어. JPG, PNG, WEBP 사진으로 다시 넣어봐.`);
    };
    reader.readAsDataURL(file);
  });
  event.target.value = "";
}

function makeId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
  return String(Date.now() + Math.random());
}

function updatePhotoStatus(message) {
  const status = $("photoStatus");
  if (status) status.textContent = message;
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
    updatePhotoStatus("아직 추가된 사진이 없어요.");
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
  state.blogspotPost = makeBlogspotPost(input, state.tags, state.naverPost);
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

function firstExperience(input, patterns) {
  return input.experience.find((item) => patterns.some((pattern) => pattern.test(item))) || "";
}

function hasExperience(input, patterns) {
  return Boolean(firstExperience(input, patterns));
}

function softSentence(text) {
  let clean = cleanSentence(text);
  clean = clean
    .replace(/했습니다$/g, "했어")
    .replace(/했다$/g, "했어")
    .replace(/했다는?$/g, "했어")
    .replace(/좋았다$/g, "좋았어")
    .replace(/괜찮았다$/g, "괜찮았어")
    .replace(/맞았다$/g, "맞았어")
    .replace(/있음$/g, "있어")
    .replace(/좋음$/g, "좋아")
    .replace(/무난함$/g, "무난해")
    .replace(/기억에 남음$/g, "기억에 남았어")
    .replace(/편함$/g, "편해")
    .replace(/먹음$/g, "먹었어");
  if (!/[.!?。]$/.test(clean)) clean += ".";
  return clean;
}

function makeOpeningSection(input) {
  const place = input.place || input.topic;
  const short = shortPlace(place);
  const linesOut = [];
  if (input.date || input.situation) {
    linesOut.push(`${input.date || "이날"}, ${input.situation ? softSentence(input.situation) : `${short}에 다녀왔어.`}`);
  }

  if (/퇴근|저녁|점심|주말|대기/.test(`${input.situation} ${input.experience.join(" ")}`)) {
    linesOut.push("사실 여기는 식사 시간대에는 대기가 생길 수 있어서, 가고 싶다고 바로 들어가기 쉬운 곳은 아니야.");
    linesOut.push("그런데 이날은 운 좋게 자리가 있어서 오래 기다리지 않고 앉을 수 있었어.");
  }

  if (input.voice) linesOut.push(input.voice);

  const favorite = firstExperience(input, [/좋아하는|자주|다시|또|갈 때마다|기억/]);
  if (favorite) {
    linesOut.push(`여긴 내 기준으로 ${softSentence(favorite).replace(/^여긴\s*/, "")}`);
  } else {
    linesOut.push(`여긴 나한테 관광지 맛집이라기보다, ${short}에서 밥 먹을 곳을 찾을 때 자연스럽게 떠오르는 식당에 가까워.`);
  }

  if (hasExperience(input, [/한국인|입맛|무난|처음/])) {
    linesOut.push("한국인 입맛 기준으로도 꽤 무난한 편이고, 인도네시아 음식 특유의 소스 맛은 충분히 느낄 수 있어서 처음 오는 사람을 데려가기에도 괜찮아.");
  }

  const casa = firstExperience(input, [/Casa|Residence|가까/]);
  if (casa) {
    linesOut.push(`${place}는 코타카사블랑카 안에 있는 지점이고, ${softSentence(casa).replace(/^여긴\s*/, "")}`);
  } else {
    linesOut.push(`${place}는 코타카사블랑카 안에 있는 지점이야. 현지에서는 Kota Kasablanka를 Kokas(코카스)라고도 많이 불러서, Pesta Kebun Kokas를 찾는 사람도 같은 지점으로 보면 돼.`);
  }

  return ["방문한 날의 기록", ...linesOut];
}

function makePlaceSection(input) {
  const place = input.place || input.topic;
  const short = shortPlace(place);
  return [
    `${short}는 이런 곳이야`,
    `${short}는 코타카사블랑카 안에서 인도네시아 음식을 편하게 먹기 좋은 식당이야. 분위기는 따뜻하고, 메뉴도 한국인 입맛에 너무 어렵지 않은 편이라 처음 오는 사람을 데려가기에도 괜찮아.`,
    "· 몰 안에 있어서 퇴근길이나 약속 전후로 들르기 편해",
    "· 음식이 대체로 무난해서 실패 확률이 낮아",
    "· 분위기가 따뜻해서 다시 가도 기분 좋은 곳이야",
    "코타카사블랑카 안에서 만난 Pesta Kebun은 입구부터 눈에 잘 들어오는 편이야. 밖에서 봐도 내부 분위기가 따뜻해 보여서 그냥 지나치기 어렵더라.",
    "나는 이런 식당이 좋아. 엄청 특별한 날을 위해 마음먹고 가는 곳이라기보다, 평범한 날 밥 한 끼를 기분 좋게 만들어주는 쪽에 가까워서 더 자주 생각나는 곳.",
  ];
}

function makeAtmosphereSection(input) {
  const photoPlan = makePhotoPlan(input);
  const interiorPhotos = photoPlan.filter((photo) => ["thumbnail", "exterior", "interior", "body"].includes(photo.role)).slice(0, 8);
  const linesOut = [
    "분위기가 먼저 예쁜 곳",
    `${shortPlace(input.place || input.topic)}는 음식도 맛있지만, 나는 여기 분위기가 참 좋아.`,
    "몰 안에 있는 식당인데도 안으로 들어가면 느낌이 확 달라져. 조명도 따뜻하고, 나무톤 인테리어와 꽃 장식, 빈티지한 소품들이 섞여 있어서 그냥 앉아만 있어도 기분이 좋아져.",
    "뭔가 인도네시아 감성인데, 과하게 로컬스럽거나 촌스럽지 않고 예쁘게 잘 풀어낸 느낌이야. 사진 찍기도 좋고, 친구 데려오기도 괜찮은 곳.",
    "특히 노란 조명이 전체적으로 따뜻하게 깔려 있어서 음식도 더 맛있어 보이고, 사진도 꽤 잘 나와.",
    "인테리어는 곳곳에 꽃, 그림, 패브릭, 빈티지한 소품이 섞여 있는데 전체적으로 과하지 않게 잘 어울려. 현지 식당 분위기를 느끼고 싶은 사람한테도 괜찮고, 사진 남기고 싶은 사람한테도 괜찮은 곳.",
    "손님이 꽤 있어도 공간이 너무 차갑게 느껴지지 않는 점도 좋았어. 자리에 앉아서 메뉴 기다리는 시간까지 괜히 기분 좋아지는 분위기랄까.",
  ];

  if (interiorPhotos.length) {
    linesOut.push("");
    interiorPhotos.forEach((photo) => {
      linesOut.push(`[사진 ${photo.index}: ${photo.caption}]`);
      linesOut.push(photo.note || `${photo.caption}도 글 중간에 넣으면 분위기 설명이 훨씬 자연스러워져.`);
    });
  } else {
    [
      "입구와 간판",
      "따뜻한 조명과 나무톤 인테리어",
      "바 쪽 분위기",
      "벽면 소품과 꽃 장식",
      "테이블에 음식이 놓인 순간",
    ].forEach((caption, index) => {
      linesOut.push(`[사진 자리 ${index + 1}: ${caption}]`);
      linesOut.push(`${caption} 사진을 넣으면 글이 훨씬 실제 방문 후기처럼 살아나. 특히 분위기 사진은 메뉴 사진 사이에 넣으면 읽는 흐름이 덜 딱딱해져.`);
    });
  }

  linesOut.push("몰 안 식당이라 접근성이 좋은 것도 장점이야. 비 오는 날이나 너무 더운 날에도 이동이 편하고, 쇼핑하거나 볼일 본 뒤에 바로 식사하기 좋아.");
  return linesOut;
}

function menuIntro(input) {
  if (!input.menus.length) return [];
  const menuList = input.menus.map((menu) => `${menu.name}${menu.local ? `(${menu.local})` : ""}`).join(", ");
  return [
    "방문해서 먹은 메뉴",
    `이날은 ${menuList}를 먹었어.`,
    "메뉴가 막 특별한 건 아닌데, 내가 좋아하는 조합으로 골랐고 결과적으로 밥이랑 같이 먹기 좋은 흐름이었어.",
    menuGlossary(input.menus),
    "나는 이날 소스가 있는 메뉴 위주로 주문했는데, 결과적으로 밥이랑 먹기 좋은 조합이었어. 사테는 고소한 땅콩소스, 우당 바카르는 단짠 양념, 자헤 마두는 마지막에 입을 정리해주는 따뜻한 음료라서 흐름이 괜찮았어.",
    "처음 방문하는 사람이라면 메뉴를 너무 많이 고민하기보다, 사테처럼 익숙한 메뉴 하나와 해산물이나 닭고기 메뉴 하나를 같이 시키면 무난할 것 같아. 인도네시아 음식이 처음이면 삼발은 조금씩 곁들여보는 게 좋아.",
  ].filter(Boolean);
}

function menuGlossary(menus) {
  const text = menus.map((menu) => `${menu.name} ${menu.local}`).join(" ").toLowerCase();
  const terms = [];
  if (/sate|사테/.test(text)) terms.push("Sate는 꼬치요리");
  if (/udang|우당/.test(text)) terms.push("Udang은 새우");
  if (/bakar|바카르/.test(text)) terms.push("Bakar는 굽다");
  if (/jahe|자헤/.test(text)) terms.push("Jahe는 생강");
  if (/madu|마두/.test(text)) terms.push("Madu는 꿀");
  if (/nasi|밥/.test(text)) terms.push("Nasi는 밥");
  if (!terms.length) return "";
  return `인니어 메뉴 이름이 낯설 수 있는데, ${terms.join(", ")}라는 뜻이야. 단어 뜻을 조금 알면 메뉴판 보는 게 훨씬 쉬워져.`;
}

function makeMenuReview(menu, input) {
  const label = `${menu.name}${menu.local ? `(${menu.local})` : ""}`;
  const note = menu.note ? softSentence(menu.note) : `${menu.name}는 내 기준으로 무난하게 먹기 좋았어.`;
  const key = `${menu.name} ${menu.local}`.toLowerCase();
  const linesOut = [label];

  if (/sate|사테/.test(key)) {
    linesOut.push("먼저 사테. 사테는 한국 사람도 부담 없이 먹기 좋은 인도네시아 음식인 것 같아.");
    linesOut.push("꼬치구이라 익숙한데, 땅콩소스가 올라가면 확실히 인도네시아 맛이 나.");
    linesOut.push(note);
    linesOut.push("한 입 먹으면 고소한 소스 맛이 먼저 오고, 뒤에 살짝 구운 향이 올라와. 라임을 조금 짜서 먹으면 더 깔끔해지고.");
    linesOut.push("이건 흰밥이랑 같이 먹어야 더 맛있어. 소스가 진한 편이라 밥 위에 살짝 올려 먹어도 맛이 잘 살아나거든.");
    linesOut.push("한국에서 꼬치구이를 좋아하는 사람이라면 사테도 크게 낯설지 않을 것 같아. 다만 우리가 흔히 먹는 소금구이나 데리야끼 꼬치와는 다르게, 땅콩소스가 들어가면서 더 부드럽고 묵직한 맛이 나는 게 차이점이야.");
    linesOut.push("사테는 인도네시아에서 정말 흔하게 볼 수 있는 메뉴인데, 식당마다 소스 농도나 단맛, 고기 굽기 정도가 조금씩 달라. Pesta Kebun 사테는 내 기준으로 고소한 맛이 먼저 느껴지는 편이었어.");
    linesOut.push("다만 소스가 진한 편이라 계속 먹으면 살짝 무겁게 느껴질 수도 있어. 그럴 때 라임을 조금 곁들이면 훨씬 깔끔해지고, 다른 메뉴랑 번갈아 먹기도 좋아.");
    linesOut.push("[사진 자리: 사테]");
    linesOut.push("소스가 듬뿍 올라간 사테 사진은 메뉴 설명 바로 아래에 넣으면 좋아. 보기만 해도 진한 맛이 느껴져서 글의 설득력이 확 살아나.");
    return linesOut;
  }

  if (/udang|우당|새우/.test(key)) {
    linesOut.push("이날 제일 기억에 남았던 건 우당 바카르였어.");
    linesOut.push("우당은 새우, 바카르는 굽는다는 뜻이야. 그러니까 쉽게 말하면 구운 새우.");
    linesOut.push(note);
    linesOut.push("새우가 큼직하고 양념이 잘 발라져 있으면, 그냥 먹어도 맛있고 밥이랑 먹으면 더 좋아.");
    linesOut.push("삼발을 많이 찍기보다는 조금만 곁들이는 게 내 입맛에는 더 잘 맞았어. 새우 양념 자체가 맛있으면 그 맛을 그대로 느끼는 쪽이 더 좋더라.");
    linesOut.push("사테랑 우당 바카르를 같이 놓고 먹으면 밥 한 그릇은 금방이야.");
    linesOut.push("우당 바카르는 이름만 보면 낯설 수 있지만 결국 구운 새우라서 한국 사람에게도 꽤 익숙한 메뉴야. 양념이 너무 세지만 않으면 실패 확률이 낮은 편이라 처음 방문하는 사람에게도 추천하기 좋아.");
    linesOut.push("겉은 살짝 그을린 느낌이 있고 안쪽은 탱글한 상태면 제일 맛있어. 여기에 튀긴 샬롯이 올라가면 식감이 더 살아나서 한입 먹을 때 더 만족스럽더라.");
    linesOut.push("[사진 자리: 우당 바카르]");
    linesOut.push("우당 바카르는 메인 사진으로 쓰기 좋아. 새우, 라임, 삼발이 한 번에 보이면 이 식당에서 뭘 먹었는지가 바로 전달돼.");
    return linesOut;
  }

  if (/jahe|자헤|madu|마두|생강|꿀/.test(key)) {
    linesOut.push("음료는 자헤 마두로 골랐어.");
    linesOut.push("자헤는 생강, 마두는 꿀이야. 쉽게 말하면 진한 생강꿀차 같은 따뜻한 음료.");
    linesOut.push(note);
    linesOut.push("처음 마시면 생강 맛이 살짝 알싸하게 올라오고, 뒤에 꿀 단맛이 부드럽게 남아.");
    linesOut.push("자카르타는 날씨가 더워서 보통 차가운 음료를 많이 마시게 되는데, 가끔은 이렇게 따뜻한 음료가 더 잘 맞는 날이 있어. 양념 진한 음식을 먹을 때는 마무리로 꽤 괜찮았어.");
    linesOut.push("한국에도 생강차가 있어서 그런지, 나는 이 음료가 낯설면서도 익숙했어. 생강 향이 확 올라오긴 하지만 꿀이 들어가서 끝맛은 부드러운 편이야.");
    linesOut.push("생강 향에 약한 사람이라도 음식이랑 같이 천천히 마시면 크게 부담스럽지는 않을 것 같아. 오히려 기름지거나 양념 진한 메뉴를 먹은 뒤에는 속이 조금 편해지는 느낌도 있었어.");
    linesOut.push("[사진 자리: 자헤 마두]");
    linesOut.push("따뜻한 음료 사진은 글 후반부에 넣으면 좋아. 음식 후기에서 음료로 넘어가는 흐름이 자연스러워져.");
    return linesOut;
  }

  linesOut.push(note);
  linesOut.push("이 메뉴는 처음 보는 이름이어도 막 어렵게 느껴지는 쪽은 아니었어. 향이 부담스럽지 않고, 밥이나 다른 메뉴와 같이 먹기 괜찮은 편이야.");
  linesOut.push("다음에 같은 곳을 다시 간다면 이 메뉴를 기준으로 다른 메뉴를 하나 더 붙여서 시켜볼 것 같아.");
  return linesOut;
}

function makeTipsSection(input) {
  const place = input.place || input.topic;
  return [
    "예약과 방문 팁",
    "여기는 가능하면 피크 시간대에는 미리 확인하고 가는 게 좋을 것 같아.",
    `${shortPlace(place)} 지점은 몰 안에 있어서 손님이 꽤 있는 편이야.`,
    "점심시간이나 주말, 저녁 피크 시간에는 그냥 가면 대기할 가능성이 있어.",
    "친구랑 가거나 가족이랑 갈 거면 미리 예약하거나 자리 확인을 해두는 게 마음 편할 듯해.",
    "특히 코타카사블랑카는 퇴근 시간 이후나 주말에 사람이 몰리는 편이라, 인기 있는 식당은 자리 기다림이 생길 수 있어.",
    "나처럼 기다리는 걸 힘들어하는 사람이라면 애매한 시간대를 노리는 것도 방법이야. 식사 피크를 살짝 피하면 같은 식당도 훨씬 편하게 느껴지더라.",
    "그리고 몰 안에 있는 식당이라 이동 동선은 편하지만, 주차장이나 그랩 픽업 위치는 시간대에 따라 복잡할 수 있어. 약속이 있다면 이동 시간을 조금 여유 있게 잡는 게 좋아.",
  ];
}

function makeFaqSection(input) {
  const place = input.place || input.topic;
  return [
    "방문 전 자주 묻는 질문",
    "검색해서 이 글을 보는 사람이라면 아마 이런 부분이 제일 궁금할 것 같아서, 내가 느낀 기준으로 짧게 정리해볼게.",
    "Q. 예약은 해야 할까?",
    "A. 평일 애매한 시간에는 바로 앉을 수도 있지만, 저녁 피크 시간이나 주말에는 예약하거나 미리 자리 확인하는 게 좋아 보여.",
    "Q. 한국인 입맛에 맞을까?",
    "A. 나는 꽤 무난하다고 느꼈어. 향신료가 아예 없는 건 아니지만, 사테나 우당 바카르처럼 구운 메뉴와 소스 메뉴는 한국 사람도 부담 없이 먹기 좋은 편이야.",
    "Q. 많이 매울까?",
    "A. 기본 메뉴 자체가 엄청 매운 느낌은 아니었어. 다만 삼발을 많이 곁들이면 매콤해질 수 있으니까, 매운 걸 잘 못 먹는다면 조금씩 찍어 먹는 걸 추천해. 외국인이면 직원이 매운 정도를 물어볼 때도 있어서, 맵지 않게 또는 조금만 맵게 조절해달라고 말하면 더 편해.",
    "Q. 사진 찍기 좋은 곳일까?",
    "A. 응, 조명과 인테리어가 예뻐서 사진 찍기 좋아. 음식 사진도 잘 나오고, 내부 소품이나 벽 장식도 찍을 만한 포인트가 많아.",
    "Q. 혼자 가도 괜찮을까?",
    "A. 혼자 식사도 가능해 보였지만, 분위기는 친구나 가족이랑 같이 와서 여러 메뉴를 나눠 먹는 쪽이 더 잘 맞는 것 같아. 그래도 퇴근길에 혼자 들러서 간단히 먹기에도 부담스럽지는 않았어.",
    "Q. 주차나 이동은 편할까?",
    `A. ${shortPlace(place)}가 몰 안에 있어서 그랩이나 택시로 이동하기는 편했어. 차를 가져간다면 몰 주차 기준을 확인하면 되고, 약속 장소로 잡기에도 무난한 위치였어.`,
    "Q. 어떤 메뉴부터 시키면 좋을까?",
    "A. 처음이라면 사테처럼 익숙한 메뉴 하나, 우당 바카르처럼 밥이랑 먹기 좋은 메인 하나, 그리고 자헤 마두나 다른 음료 하나를 같이 시키면 흐름이 좋아. 너무 낯선 메뉴만 고르는 것보다 익숙한 메뉴와 현지 느낌 나는 메뉴를 섞는 쪽이 실패 확률이 낮아.",
  ];
}

function makeLocationSection(input) {
  const place = input.place || input.topic;
  const query = encodeURIComponent(place);
  return [
    "위치와 이동 팁",
    `Google Maps 검색 링크:\nhttps://www.google.com/maps/search/?api=1&query=${query}`,
    `${shortPlace(place)}는 몰 안에 있어서 택시나 그랩으로 이동하기도 편하고, 몰 안에서 약속 잡은 날 식사 장소로 넣기에도 괜찮아.`,
    "자카르타는 이동 시간이 길어질 때가 많아서, 몰 안에서 식사까지 해결할 수 있는 곳은 확실히 편하더라.",
  ];
}

function makeConclusionSection(input) {
  const place = input.place || input.topic;
  const topMenu = input.menus.find((menu) => /우당|udang|기억|제일|만족/i.test(`${menu.name} ${menu.local} ${menu.note}`)) || input.menus[0];
  const menuLine = input.menus.length
    ? `이날 먹은 메뉴 중에서는 ${topMenu.name}가 제일 기억에 남았고, ${menuNames(input).filter((name) => name !== topMenu.name).join(", ") || "다른 메뉴들"}도 무난하게 좋았어.`
    : "이날 먹은 메뉴들은 전체적으로 무난하게 좋았어.";
  return [
    "결론은,, 다시 갈 만한 곳",
    `역시 ${shortPlace(place)}는 맛있어.`,
    menuLine,
    "여긴 나한테 관광지 맛집이라기보다는, 인도네시아에서 지내면서 “맛있는 거 먹고 싶다” 싶을 때 생각나는 식당이야.",
    "분위기도 예쁘고, 음식도 맛있고, 인도네시아 음식의 매력을 편하게 느낄 수 있는 곳.",
    "자카르타 코타카사블랑카 맛집을 찾는 사람이라면 한 번쯤 후보에 넣어도 좋을 것 같아. 특히 인도네시아 음식이 처음인 한국인 친구를 데려간다면, 너무 어렵지 않으면서도 현지 음식 느낌은 충분히 낼 수 있어서 괜찮은 선택이 될 듯.",
    "나는 아마 다음에도 코타카사블랑카에서 뭘 먹을지 고민하다가 또 여기 생각날 것 같아. 이런 식당은 막 특별한 날보다, 평범한 퇴근길에 더 고마운 곳이니까.",
  ];
}

function englishSeoLine(input) {
  const place = input.place || input.topic;
  const menuText = input.menus.map((menu) => menu.local || menu.name).filter(Boolean).slice(0, 4).join(", ");
  return `${place} is an Indonesian restaurant in Kokas mall, Jakarta${menuText ? `, good for ${menuText}` : ""}.`;
}

function makeNaverPost(input, tags) {
  const title = state.titleCandidates[0]?.text || input.topic;
  const place = input.place || input.topic;
  const checkPoints = makeCheckPoints(input);
  const menuText = menuSection(input);
  const tagLine = tags.join(" ");

  return [
    title,
    "",
    "다시 가도 좋았던 이유",
    ...checkPoints.map((item) => `· ${item}`),
    "",
    ...makeOpeningSection(input),
    "",
    ...makePlaceSection(input),
    "",
    ...makeAtmosphereSection(input),
    "",
    menuText,
    "",
    ...makeTipsSection(input),
    "",
    ...makeFaqSection(input),
    "",
    ...makeLocationSection(input),
    "",
    ...makeConclusionSection(input),
    "",
    englishSeoLine(input),
    "",
    tagLine,
  ].filter((line) => line !== undefined).join("\n");
}

function makeBlogspotPost(input, tags, naverPost = "") {
  naverPost = naverPost || makeNaverPost(input, tags);
  return convertNaverPostToBlogspot(input, tags, naverPost);
}

function convertCurrentNaverToBlogspot() {
  const input = getInput();
  const tags = parseCommaOrSpaceTags($("tagEditor").value || state.tags.join(" "));
  const naverPost = $("postEditor").value.trim() || makeNaverPost(input, tags);
  state.blogspotPost = convertNaverPostToBlogspot(input, tags, naverPost);
  $("blogspotEditor").value = state.blogspotPost;
  activateTab("blogspot");
}

function convertNaverPostToBlogspot(input, tags, naverPost) {
  const title = makeBlogspotTitle(input);
  const description = makeBlogspotSearchDescription(input);
  const labels = makeBlogspotLabels(input, tags);
  const slug = makeBlogspotSlug(input);
  const body = naverToBlogspotPlain(naverPost, input);
  return [
    "제목",
    title,
    "",
    "검색 설명",
    description,
    "",
    "고유주소",
    slug,
    "",
    "라벨",
    labels.join(", "),
    "",
    "본문",
    body,
  ].join("\n");
}

function makeBlogspotTitle(input) {
  const place = input.place || input.topic;
  const menus = input.menus.map((menu) => menu.local || menu.name).filter(Boolean).slice(0, 3).join(", ");
  return `${place} Review: Kokas Jakarta 맛집${menus ? ` with ${menus}` : ""}`;
}

function makeBlogspotSearchDescription(input) {
  const place = input.place || input.topic;
  const menus = menuNames(input).join(", ") || "추천 메뉴";
  return `${place} 후기. Kokas mall Jakarta에서 먹은 ${menus}, 한국인 입맛 기준 분위기, 예약 팁, 위치 정보를 정리한 블로그스팟용 리뷰.`;
}

function makeBlogspotSlug(input) {
  const place = input.place || input.topic || "blog-post";
  const localMenus = input.menus.map((menu) => menu.local).filter(Boolean).slice(0, 2).join(" ");
  const source = `${place} ${localMenus} review kokas jakarta`;
  return slugify(source).slice(0, 80).replace(/-$/g, "");
}

function makeBlogspotLabels(input, tags) {
  const preferred = [
    "Jakarta Restaurant",
    "Jakarta Food",
    "Indonesian Food",
    "Kokas",
    "Kota Kasablanka",
    "Pesta Kebun",
    ...input.menus.map((menu) => menu.local || menu.name),
    ...tags.map((tag) => tag.replace("#", "")),
  ];
  return unique(preferred.map((item) => cleanLabel(item)).filter(Boolean)).slice(0, 14);
}

function cleanLabel(text) {
  return String(text || "")
    .replace(/^#/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(text) {
  return String(text || "")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function naverToBlogspotHtml(naverPost, input) {
  const title = naverPost.split(/\r?\n/).find(Boolean) || makeBlogspotTitle(input);
  const bodyLines = stripNaverPostForBlogspot(naverPost, title);
  const html = [
    `<p><strong>${escapeHtml(englishSeoLine(input))}</strong></p>`,
    `<p>${escapeHtml(makeBlogspotSearchDescription(input))}</p>`,
    "",
    "<h2>Quick Summary</h2>",
    "<ul>",
    ...makeCheckPoints(input).map((item) => `<li>${escapeHtml(item)}</li>`),
    "</ul>",
    "",
    "<h2>Table of Contents</h2>",
    "<ul>",
    ...blogspotTocItems(input).map((item) => `<li>${escapeHtml(item)}</li>`),
    "</ul>",
    "",
    ...convertLinesToHtml(bodyLines, input),
  ];
  return html.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function naverToBlogspotPlain(naverPost, input) {
  const title = naverPost.split(/\r?\n/).find(Boolean) || makeBlogspotTitle(input);
  const bodyLines = stripNaverPostForBlogspot(naverPost, title);
  const plain = [
    englishSeoLine(input),
    makeBlogspotSearchDescription(input),
    "",
    "Quick Summary",
    ...makeCheckPoints(input).map((item) => `- ${item}`),
    "",
    "Table of Contents",
    ...blogspotTocItems(input).map((item) => `- ${item}`),
    "",
    ...convertLinesToPlain(bodyLines, input),
  ];
  return plain.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function stripNaverPostForBlogspot(naverPost, title) {
  return naverPost
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line, index) => {
      if (!line) return true;
      if (index === 0 && line === title) return false;
      if (/^#[^\s#]+(?:\s+#[^\s#]+)+$/.test(line)) return false;
      if (/^[A-Za-z].+ is an .+\.$/.test(line)) return false;
      return true;
    });
}

function blogspotTocItems(input) {
  return [
    "Why I went back",
    "Atmosphere at Pesta Kebun Kokas",
    `${menuNames(input).join(", ") || "Menu"} review`,
    "Reservation and visit tips",
    "FAQ for Korean visitors",
    "Location in Kota Kasablanka",
  ];
}

function convertLinesToHtml(rawLines, input) {
  const html = [];
  let listOpen = false;

  const closeList = () => {
    if (listOpen) {
      html.push("</ul>");
      listOpen = false;
    }
  };

  rawLines.forEach((line) => {
    if (!line) {
      closeList();
      html.push("");
      return;
    }

    if (line.startsWith("· ")) {
      if (!listOpen) {
        html.push("<ul>");
        listOpen = true;
      }
      html.push(`<li>${escapeHtml(line.replace(/^·\s*/, ""))}</li>`);
      return;
    }

    closeList();

    if (isBlogspotH2(line)) {
      html.push(`<h2>${escapeHtml(blogspotHeading(line))}</h2>`);
      return;
    }

    if (isMenuHeading(line, input)) {
      html.push(`<h3>${escapeHtml(line)}</h3>`);
      return;
    }

    if (/^Q\./.test(line)) {
      html.push(`<h3>${escapeHtml(line)}</h3>`);
      return;
    }

    if (/^https?:\/\//.test(line)) {
      html.push(`<p><a href="${escapeAttr(line)}" target="_blank" rel="noopener">${escapeHtml(line)}</a></p>`);
      return;
    }

    if (/^\[사진/.test(line)) {
      html.push(`<p><em>${escapeHtml(line)}</em></p>`);
      return;
    }

    html.push(`<p>${escapeHtml(line)}</p>`);
  });

  closeList();
  return html;
}

function convertLinesToPlain(rawLines, input) {
  return rawLines.map((line) => {
    if (!line) return "";
    if (line.startsWith("· ")) return `- ${line.replace(/^·\s*/, "")}`;
    if (isBlogspotH2(line)) return blogspotHeading(line);
    if (isMenuHeading(line, input)) return line;
    if (/^\[사진/.test(line)) return line;
    return line;
  });
}

function isBlogspotH2(line) {
  return line.endsWith("는 이런 곳이야") || [
    "다시 가도 좋았던 이유",
    "방문한 날의 기록",
    "분위기가 먼저 예쁜 곳",
    "방문해서 먹은 메뉴",
    "예약과 방문 팁",
    "방문 전 자주 묻는 질문",
    "위치와 이동 팁",
    "결론은,, 다시 갈 만한 곳",
  ].includes(line);
}

function blogspotHeading(line) {
  if (line.endsWith("는 이런 곳이야")) return `What ${line.replace("는 이런 곳이야", "")} is like`;
  const map = {
    "다시 가도 좋았던 이유": "Why I went back to Pesta Kebun Kokas",
    "방문한 날의 기록": "Visit note",
    "Pesta Kebun Kokas는 이런 곳이야": "What Pesta Kebun Kokas is like",
    "분위기가 먼저 예쁜 곳": "Atmosphere at Pesta Kebun Kokas",
    "방문해서 먹은 메뉴": "Menu review",
    "예약과 방문 팁": "Reservation and visit tips",
    "방문 전 자주 묻는 질문": "FAQ before visiting",
    "위치와 이동 팁": "Location and transport tips",
    "결론은,, 다시 갈 만한 곳": "Final thoughts",
  };
  return map[line] || line;
}

function isMenuHeading(line, input) {
  return input.menus.some((menu) => {
    const label = `${menu.name}${menu.local ? `(${menu.local})` : ""}`;
    return line === label;
  });
}

function makeCheckPoints(input) {
  const items = [];
  const place = input.place || input.topic;
  items.push(`${shortPlace(place)}에서 들르기 편한 위치`);
  if (hasExperience(input, [/맛있|무난|입맛|좋아/])) items.push("갈 때마다 무난하게 맛있는 인도네시아 음식");
  input.experience.slice(0, 3).forEach((item) => items.push(softSentence(item).replace(/[.。]$/g, "")));
  if (input.menus.length) items.push(`이번에 먹은 ${menuNames(input).join(", ")}`);
  if (hasExperience(input, [/대기|예약|피크|주말/]) || /대기|예약|피크|주말/.test(input.situation)) items.push("대기가 생길 수 있는 시간대와 예약 팁");
  items.push("다시 가도 좋은 따뜻한 분위기");
  return unique(items).slice(0, 7);
}

function cleanSentence(text) {
  return text.replace(/[.。]$/g, "").trim();
}

function menuSection(input) {
  if (!input.menus.length) return "";
  const sections = input.menus.flatMap((menu) => [
    "",
    ...makeMenuReview(menu, input),
  ]);
  return [...menuIntro(input), ...sections].join("\n");
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
  const status = withoutSpaces >= 4500 ? "최종 원고급" : withoutSpaces >= 2500 ? "보강 필요" : "짧음";
  const cls = withoutSpaces >= 4500 ? "status-good" : withoutSpaces >= 2500 ? "status-warn" : "status-bad";
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
  const withoutSpaces = text.replace(/\s/g, "").length;
  const checks = [
    ["제목에 장소명 포함", text.split(/\r?\n/)[0]?.includes(getInput().place.split(" ")[0] || "")],
    ["첫 문단에 방문 상황 포함", Boolean(getInput().situation && text.includes(getInput().situation.slice(0, 8)))],
    ["최종 문서급 글자수", withoutSpaces >= 4500],
    ["메뉴별 긴 후기 포함", (text.match(/\(.+?\)/g) || []).length >= 3 && text.includes("방문해서 먹은 메뉴")],
    ["예약/위치/FAQ 포함", text.includes("예약과 방문 팁") && text.includes("위치와 이동 팁") && text.includes("방문 전 자주 묻는 질문")],
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
