const $ = (id) => document.getElementById(id);

const state = {
  photos: [],
  titleCandidates: [],
  naverPost: "",
  blogspotPost: "",
  tags: [],
  aiSearchReport: [],
  aiSearchSources: [],
  voicePresets: loadVoicePresets(),
  isPolished: false,
  thumbnailRenderId: 0,
  aiThumbnailDataUrl: "",
  thumbnailCandidates: [],
  selectedThumbnailCandidate: -1,
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
  loadOpenAISettings();
  loadThumbnailSettings();
  loadVoiceSettings();
  bindEvents();
  renderVoicePresets();
  renderPhotos();
  generateAll();
});

function bindEvents() {
  $("refreshReportBtn").addEventListener("click", refreshFromEditor);
  $("dietTagsBtn").addEventListener("click", dietTagsFromEditor);
  $("photoInput").addEventListener("change", handlePhotos);
  $("autoMatchPhotosBtn").addEventListener("click", autoMatchPhotosFromButton);
  $("photoDensityInput").addEventListener("change", generateAll);
  $("photoCaptionModeInput").addEventListener("change", generateAll);
  $("bulkPhotoSizeInput").addEventListener("change", applyBulkPhotoSize);
  $("aiGenerateBtn").addEventListener("click", generateWithOpenAI);
  if ($("copyCodexPromptBtn")) $("copyCodexPromptBtn").addEventListener("click", copyCodexPrompt);
  $("clearOpenAIKeyBtn").addEventListener("click", clearOpenAIKey);
  ["openaiKeyInput", "aiModelInput", "aiInstructionInput"].forEach((id) => {
    $(id).addEventListener("input", saveOpenAISettings);
  });
  $("saveVoiceBtn").addEventListener("click", saveVoicePreset);
  $("voiceInput").addEventListener("input", debounce(saveActiveVoice, 250));
  $("resetBtn").addEventListener("click", resetInputs);
  $("renderThumbBtn").addEventListener("click", drawThumbnail);
  $("downloadThumbBtn").addEventListener("click", downloadThumbnail);
  $("generateAiThumbBtn").addEventListener("click", generateAIThumbnailImage);
  $("clearAiThumbBtn").addEventListener("click", clearAIThumbnailImage);
  $("thumbnailCandidateList").addEventListener("click", handleThumbnailCandidateClick);
  $("copyPostBtn").addEventListener("click", () => {
    syncPreviewEditsIfNeeded({ silent: true });
    copyText($("postEditor").value);
  });
  $("copyStyledPostBtn").addEventListener("click", copyStyledPost);
  $("exportGoogleDocsBtn").addEventListener("click", exportToGoogleDocs);
  if ($("copyBlogspotBtn")) $("copyBlogspotBtn").addEventListener("click", () => copyText($("blogspotEditor").value));
  $("downloadPostBtn").addEventListener("click", () => {
    syncPreviewEditsIfNeeded({ silent: true });
    downloadText("naver_post.md", $("postEditor").value);
  });
  if ($("downloadBlogspotBtn")) $("downloadBlogspotBtn").addEventListener("click", () => downloadText("blogspot_post.md", $("blogspotEditor").value));
  if ($("convertBlogspotBtn")) $("convertBlogspotBtn").addEventListener("click", convertCurrentNaverToBlogspot);
  $("aiSearchReviewBtn").addEventListener("click", runAIWebReview);
  if ($("polishPostBtn")) $("polishPostBtn").addEventListener("click", polishPostLayout);
  $("toggleEditorBtn").addEventListener("click", toggleDirectPreviewEdit);
  $("savePreviewEditBtn").addEventListener("click", () => savePreviewEdits());
  $("fixAiBtn").addEventListener("click", fixAiSmell);
  $("tagEditor").addEventListener("input", () => {
    state.tags = parseCommaOrSpaceTags($("tagEditor").value);
    refreshReports();
  });
  $("postEditor").addEventListener("input", debounce(refreshReports, 250));
  $("postPreview").addEventListener("click", handlePreviewPhotoMove);
  $("postPreview").addEventListener("input", markPreviewDirty);
  $("brandInput").addEventListener("input", drawThumbnail);
  $("accentInput").addEventListener("input", drawThumbnail);
  $("thumbTitleInput").addEventListener("input", drawThumbnail);
  $("thumbRibbonInput").addEventListener("input", drawThumbnail);
  ["thumbnailImageModelInput", "thumbnailPromptInput"].forEach((id) => {
    $(id).addEventListener("input", saveThumbnailSettings);
  });

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => activateTab(tab.dataset.tab));
  });

  document.querySelectorAll("[data-insert]").forEach((btn) => {
    btn.addEventListener("click", () => insertSnippet(btn.dataset.insert));
  });

  document.querySelectorAll("[data-open-tab]").forEach((btn) => {
    btn.addEventListener("click", () => activateTab(btn.dataset.openTab));
  });
}

function loadOpenAISettings() {
  const key = localStorage.getItem("naverBlogOpenAIKey") || "";
  const model = localStorage.getItem("naverBlogOpenAIModel") || "gpt-5.5";
  const instruction = localStorage.getItem("naverBlogOpenAIInstruction") || "";
  if ($("openaiKeyInput")) $("openaiKeyInput").value = key;
  if ($("aiModelInput")) $("aiModelInput").value = model;
  if (instruction && $("aiInstructionInput")) $("aiInstructionInput").value = instruction;
  if (key && !isOpenAIKeyLike(key)) {
    localStorage.removeItem("naverBlogOpenAIKey");
    if ($("openaiKeyInput")) $("openaiKeyInput").value = "";
  }
}

function loadThumbnailSettings() {
  const imageModel = localStorage.getItem("naverBlogThumbnailImageModel") || "";
  const prompt = localStorage.getItem("naverBlogThumbnailPrompt") || "";
  if (imageModel && $("thumbnailImageModelInput")) $("thumbnailImageModelInput").value = imageModel;
  if (prompt && $("thumbnailPromptInput")) $("thumbnailPromptInput").value = prompt;
}

function saveOpenAISettings() {
  const key = normalizeOpenAIKey($("openaiKeyInput").value);
  if (key) localStorage.setItem("naverBlogOpenAIKey", key);
  else localStorage.removeItem("naverBlogOpenAIKey");
  localStorage.setItem("naverBlogOpenAIModel", $("aiModelInput").value.trim() || "gpt-5.5");
  localStorage.setItem("naverBlogOpenAIInstruction", $("aiInstructionInput").value.trim());
}

function saveThumbnailSettings() {
  localStorage.setItem("naverBlogThumbnailImageModel", $("thumbnailImageModelInput").value.trim() || "gpt-image-1");
  localStorage.setItem("naverBlogThumbnailPrompt", $("thumbnailPromptInput").value.trim());
}

function clearOpenAIKey() {
  $("openaiKeyInput").value = "";
  localStorage.removeItem("naverBlogOpenAIKey");
  setAiStatus("저장된 API 키를 지웠어. platform.openai.com에서 새 키를 넣어줘.", false);
}

function normalizeOpenAIKey(value) {
  return String(value || "").trim().replace(/^Bearer\s+/i, "");
}

function isOpenAIKeyLike(value) {
  const key = normalizeOpenAIKey(value);
  return /^sk-[A-Za-z0-9_-]{20,}$/.test(key) || /^sk-proj-[A-Za-z0-9_-]{20,}$/.test(key);
}

function activateTab(name) {
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("is-active", tab.dataset.tab === name));
  document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.remove("is-active"));
  const panel = $(`${name}Tab`);
  if (!panel) return;
  panel.classList.add("is-active");
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
    brand: $("brandInput").value.trim() || "Ara Cinta Indonesia",
    voice: $("voiceInput").value.trim(),
    photoDensity: $("photoDensityInput").value || "all",
    photoCaptionMode: $("photoCaptionModeInput").value || "safe",
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
  state.aiThumbnailDataUrl = "";
  state.thumbnailCandidates = [];
  state.selectedThumbnailCandidate = -1;
  renderThumbnailCandidates();
  updatePhotoStatus(`${files.length}장 불러오는 중...`);
  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      const photo = {
        id: makeId(),
        name: file.name,
        dataUrl: reader.result,
        width: 0,
        height: 0,
        aspectRatio: 1,
        caption: autoCaption(file.name, state.photos.length),
        note: "",
        role: autoRole(file.name, state.photos.length),
        size: $("bulkPhotoSizeInput").value || "full",
        target: "auto",
        autoMatched: false,
        userEdited: false,
      };
      state.photos.push(photo);
      loaded += 1;
      autoMatchPhotos(getInput(), false);
      renderPhotos();
      drawThumbnail();
      refreshReports();
      updatePhotoStatus(`${loaded}장 추가됨. 사진 분석 중이야. 기본값은 직접 제외한 사진만 빼고 모두 원고에 반영돼.`);
      analyzePhotoVisual(photo).then(() => {
        autoMatchPhotos(getInput(), false);
        renderPhotos();
        drawThumbnail();
        refreshReports();
      });
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

function applyBulkPhotoSize() {
  const size = $("bulkPhotoSizeInput").value || "full";
  state.photos.forEach((photo) => {
    photo.size = size;
  });
  renderPhotos();
  refreshReports();
  updatePhotoStatus(`${state.photos.length}장 사진 크기를 ${photoSizeLabel(size)}로 맞췄어.`);
}

function photoSizeLabel(size) {
  const labels = {
    auto: "자동 크기",
    small: "작게",
    medium: "보통",
    large: "크게",
    full: "제일 크게",
  };
  return labels[size] || "제일 크게";
}

function autoCaption(filename, index) {
  const lower = filename.toLowerCase();
  if (lower.includes("menu")) return "메뉴판";
  if (lower.includes("sate") || lower.includes("사테")) return "사테";
  if (lower.includes("udang") || lower.includes("새우")) return "우당 바카르";
  if (/jahe|madu|자헤|마두|생강|꿀/.test(lower)) return "자헤 마두";
  if (/drink|beverage|음료|차/.test(lower)) return "음료";
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

function autoMatchPhotosFromButton() {
  autoMatchPhotos(getInput(), true);
  renderPhotos();
  generateAll();
  updatePhotoStatus(`${state.photos.length}장을 원고에 넣을 수 있게 사진 설명과 위치를 다시 정리했어.`);
}

function autoMatchPhotos(input, force = false) {
  if (!state.photos.length) return;
  const atmosphereLabels = ["입구와 전체 분위기", "따뜻한 내부 분위기", "테이블 분위기", "바 쪽 분위기", "소품과 조명"];
  let atmosphereIndex = 0;

  state.photos.forEach((photo, index) => {
    if (photo.userEdited && !force) return;

    const role = inferPhotoRole(photo, index, state.photos.length, input);
    const targetMenu = menuForPhotoTarget(photo, input);
    const target = photo.target || "auto";
    let caption = photo.caption;
    let note = photo.note;
    let nextRole = role;

    if (target === "exclude") {
      nextRole = "exclude";
      caption = isGenericPhotoCaption(photo.caption) ? `사진 ${index + 1}` : photo.caption;
      note = photo.note || "";
    } else if (target === "atmosphere") {
      nextRole = "interior";
      caption = isGenericPhotoCaption(photo.caption) ? atmosphereLabels[Math.min(atmosphereIndex, atmosphereLabels.length - 1)] : photo.caption;
      note = photoNarrativeNote(nextRole, caption, null, input);
      atmosphereIndex += 1;
    } else if (target === "menu-intro") {
      nextRole = "food";
      caption = isGenericPhotoCaption(photo.caption) ? "같이 주문한 메뉴들" : photo.caption;
      note = photoNarrativeNote(nextRole, caption, null, input);
    } else if (targetMenu) {
      nextRole = /jahe|자헤|madu|마두|생강|꿀|drink|음료/i.test(`${targetMenu.name} ${targetMenu.local}`) ? "drink" : "food";
      caption = `${targetMenu.name}${targetMenu.local ? `(${targetMenu.local})` : ""}`;
      note = photoNarrativeNote(nextRole, caption, targetMenu, input);
    } else if (role === "thumbnail") {
      caption = atmosphereLabels[0];
      note = photoNarrativeNote(role, caption, null, input);
    } else if (role === "interior" || role === "exterior") {
      caption = atmosphereLabels[Math.min(atmosphereIndex, atmosphereLabels.length - 1)];
      note = photoNarrativeNote(role, caption, null, input);
      atmosphereIndex += 1;
    } else if (role === "menu") {
      caption = "메뉴판";
      note = photoNarrativeNote(role, caption, null, input);
    } else if (role === "drink") {
      const menu = matchedMenuForPhoto(photo, input);
      caption = menu ? `${menu.name}${menu.local ? `(${menu.local})` : ""}` : "음료";
      note = photoNarrativeNote(role, caption, menu, input);
    } else if (role === "food") {
      const menu = matchedMenuForPhoto(photo, input);
      caption = menu ? `${menu.name}${menu.local ? `(${menu.local})` : ""}` : foodCaptionFromPhoto(photo);
      note = photoNarrativeNote(role, caption, menu, input);
    } else {
      caption = isGenericPhotoCaption(photo.caption) ? `사진 ${index + 1}` : photo.caption;
      note = photoNarrativeNote(role, caption, null, input);
    }

    if ((force && isGenericPhotoCaption(photo.caption)) || isGenericPhotoCaption(photo.caption) || photo.autoMatched) photo.caption = caption;
    if (target !== "auto" || (force && photo.role === "body") || photo.role === "body" || photo.autoMatched) photo.role = nextRole;
    if (!photo.userEdited && (!photo.note || isGenericPhotoNote(photo.note) || photo.autoMatched)) photo.note = "";
    photo.autoMatched = true;
  });
}

function inferPhotoRole(photo, index, total, input) {
  if (photo.userEdited && photo.role && photo.role !== "body") return photo.role;
  const fileText = `${photo.name || ""}`.toLowerCase();
  const userText = `${photo.caption || ""} ${photo.note || ""}`.toLowerCase();
  const text = photo.userEdited ? `${fileText} ${userText}` : fileText;
  if (/menu|메뉴판/.test(text)) return "menu";
  if (/jahe|madu|drink|beverage|음료|자헤|마두|생강|꿀|tea|차/.test(text)) return "drink";
  if (/sate|satay|udang|bakar|shrimp|food|dish|plate|사테|우당|새우|음식|요리|밥/.test(text)) return "food";
  if (/entrance|exterior|outside|입구|외관|간판/.test(text)) return "exterior";
  if (/interior|inside|table|seat|bar|내부|분위기|자리|조명|소품/.test(text)) return index === 0 ? "thumbnail" : "interior";
  if (photo.analysis?.visualRole === "drink") return "drink";
  if (photo.analysis?.visualMenu === "mixed") return "food";
  if (photo.analysis?.visualRole) {
    if (photo.analysis.visualRole === "food") return "food";
    return index === 0 ? "thumbnail" : photo.analysis.visualRole;
  }
  if (!photo.autoMatched && photo.role && photo.role !== "body") return photo.role;
  if (index === 0) return "thumbnail";
  if (index < Math.min(4, total)) return "interior";
  if (input.menus.length) return "food";
  return "interior";
}

function matchedMenuForPhoto(photo, input) {
  const targetMenu = menuForPhotoTarget(photo, input);
  if (targetMenu) return targetMenu;
  return input.menus.find((menu) => photoMatchesMenu(photo, menu));
}

function matchedMenuByVisualKey(key, input) {
  return input.menus.find((menu) => menuMatchesVisualKey(menu, key));
}

function menuForPhotoTarget(photo, input) {
  const target = photo?.target || "auto";
  if (!target.startsWith("menu:")) return null;
  const index = Number(target.split(":")[1]);
  return Number.isInteger(index) ? input.menus[index] || null : null;
}

function foodCaptionFromPhoto(photo) {
  if (photo.analysis?.visualMenu === "mixed") return "같이 주문한 메뉴들";
  return "테이블에 놓인 음식";
}

function isGenericPhotoCaption(caption) {
  return !caption || /^사진\s*\d+$/i.test(caption) || ["입구와 분위기", "대표 분위기", "입구와 전체 분위기", "따뜻한 내부 분위기", "내부 분위기", "테이블 분위기", "바 쪽 분위기", "소품과 조명", "음식 사진", "테이블에 놓인 음식", "같이 주문한 메뉴들", "음료", "한국인 입맛"].includes(caption);
}

function isGenericPhotoNote(note) {
  return !note || /^역할이\s/.test(note) || /사진 설명/.test(note) || /보조 사진/.test(note) || /넣기 좋은 사진/.test(note) || /썸네일에 쓰기 좋은 사진/.test(note);
}

function analyzePhotoVisual(photo) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      photo.width = img.naturalWidth || img.width || 0;
      photo.height = img.naturalHeight || img.height || 0;
      photo.aspectRatio = photo.width && photo.height ? photo.width / photo.height : 1;
      try {
        const canvas = document.createElement("canvas");
        const size = 48;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx || typeof ctx.getImageData !== "function") {
          resolve();
          return;
        }
        ctx.drawImage(img, 0, 0, size, size);
        const imageData = ctx.getImageData(0, 0, size, size);
        if (!imageData || !imageData.data) {
          resolve();
          return;
        }
        photo.analysis = summarizePhotoPixels(imageData.data, size);
      } catch (error) {
        photo.analysis = null;
      }
      resolve();
    };
    img.onerror = () => resolve();
    img.src = photo.dataUrl;
  });
}

function summarizePhotoPixels(data, size) {
  let total = 0;
  let center = 0;
  let brightCenter = 0;
  let warmOrGreenCenter = 0;
  let orangeCenter = 0;
  let brownCenter = 0;
  let drinkToneCenter = 0;
  let darkAll = 0;
  let brightnessAll = 0;
  let brightnessSqAll = 0;
  let saturationAll = 0;
  let saturationCenter = 0;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const brightness = (r + g + b) / 3;
      const saturation = max ? (max - min) / max : 0;
      const isCenter = x > size * 0.22 && x < size * 0.78 && y > size * 0.22 && y < size * 0.78;
      total += 1;
      brightnessAll += brightness;
      brightnessSqAll += brightness * brightness;
      saturationAll += saturation;
      if (brightness < 72) darkAll += 1;
      if (isCenter) {
        center += 1;
        saturationCenter += saturation;
        if (brightness > 135) brightCenter += 1;
        if ((r > 120 && g > 70 && b < 120) || (g > r * 0.9 && g > b * 1.08)) warmOrGreenCenter += 1;
        if (r > 145 && g > 70 && g < 145 && b < 95 && r > g * 1.12) orangeCenter += 1;
        if (r > 85 && r < 170 && g > 55 && g < 135 && b < 95 && r >= g && saturation > 0.22) brownCenter += 1;
        if (r > 120 && g > 95 && b > 60 && r > b * 1.35 && Math.abs(r - g) < 70 && saturation < 0.42) drinkToneCenter += 1;
      }
    }
  }

  const centerBrightRatio = brightCenter / Math.max(center, 1);
  const centerFoodColorRatio = warmOrGreenCenter / Math.max(center, 1);
  const centerOrangeRatio = orangeCenter / Math.max(center, 1);
  const centerBrownRatio = brownCenter / Math.max(center, 1);
  const centerDrinkToneRatio = drinkToneCenter / Math.max(center, 1);
  const avgSaturation = saturationAll / Math.max(total, 1);
  const centerSaturation = saturationCenter / Math.max(center, 1);
  const darkRatio = darkAll / Math.max(total, 1);
  const avgBrightness = brightnessAll / Math.max(total, 1);
  const brightnessVariance = brightnessSqAll / Math.max(total, 1) - avgBrightness * avgBrightness;
  const contrastScore = Math.sqrt(Math.max(brightnessVariance, 0));
  let visualRole = "interior";
  let visualMenu = "";
  let visualMenuConfidence = 0;
  if ((centerBrightRatio > 0.18 && centerSaturation > 0.28) || centerFoodColorRatio > 0.24 || (avgSaturation > 0.36 && darkRatio < 0.6)) {
    visualRole = "food";
  }
  if (darkRatio > 0.62 && centerFoodColorRatio < 0.16) visualRole = "interior";

  if (visualRole === "food") {
    visualMenu = "mixed";
    visualMenuConfidence = 0.45;
  }

  if (centerDrinkToneRatio > 0.3 && centerOrangeRatio < 0.05 && avgSaturation < 0.32 && darkRatio < 0.35) {
    visualRole = "drink";
    visualMenu = "drink";
    visualMenuConfidence = 0.68;
  }

  const brightnessPenalty = Math.abs(avgBrightness - 138) * 0.18;
  const darkPenalty = darkRatio * 36;
  const qualityScore = clamp(62 + contrastScore * 0.34 + avgSaturation * 22 - brightnessPenalty - darkPenalty, 0, 100);

  return {
    centerBrightRatio,
    centerFoodColorRatio,
    centerOrangeRatio,
    centerBrownRatio,
    centerDrinkToneRatio,
    avgSaturation,
    avgBrightness,
    contrastScore,
    darkRatio,
    visualRole,
    visualMenu,
    visualMenuConfidence,
    qualityScore,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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
        <div class="photo-analysis">
          <strong>${escapeHtml(photo.caption)}</strong>
          <span>${escapeHtml(photoAnalysisSummary(photo))}</span>
        </div>
        <input data-photo-field="caption" value="${escapeAttr(photo.caption)}" aria-label="사진 표시명">
        <input data-photo-field="note" value="${escapeAttr(photo.note)}" placeholder="확실한 내용이 있을 때만 메모를 써도 돼요">
      </div>
    </div>
  `).join("");

  list.querySelectorAll("[data-photo-field]").forEach((field) => {
    const handlePhotoFieldChange = () => {
      const item = field.closest(".photo-item");
      const photo = state.photos.find((entry) => entry.id === item.dataset.id);
      photo.userEdited = true;
      photo.autoMatched = false;
      photo[field.dataset.photoField] = field.value;
      refreshReports();
      if (field.dataset.photoField === "role" || field.dataset.photoField === "caption") drawThumbnail();
    };
    field.addEventListener("input", handlePhotoFieldChange);
    field.addEventListener("change", handlePhotoFieldChange);
  });
}

function photoAnalysisSummary(photo) {
  if (!photo.analysis) return "분석 중";
  const score = Math.round(photo.analysis.blogScore || photoBlogScore(photo));
  const scene = photoSceneLabel(photo);
  const verdict = score >= 78 ? "추천" : score >= 62 ? "보조" : "제외 후보";
  return `${verdict} · ${scene} · ${score}점`;
}

function photoSceneLabel(photo) {
  if (photo.role === "exclude") return "제외";
  if (photo.role === "drink") return "음료";
  if (photo.role === "menu") return "메뉴판";
  if (["thumbnail", "interior", "exterior", "body"].includes(photo.role) && photo.analysis?.visualRole !== "food") return "분위기";
  if (photo.analysis?.visualMenu === "mixed") return "음식 테이블";
  if (photo.analysis?.visualMenuConfidence >= 0.86 && ["sate", "udang"].includes(photo.analysis?.visualMenu)) return "음식 후보";
  return "음식";
}

function generateAll() {
  disableDirectPreviewEdit();
  state.isPolished = false;
  const input = getInput();
  autoMatchPhotos(input, true);
  renderPhotos();
  state.titleCandidates = makeTitleCandidates(input);
  state.tags = makeTags(input);
  state.naverPost = makeNaverPost(input, state.tags);
  state.blogspotPost = makeBlogspotPost(input, state.tags, state.naverPost);
  $("postEditor").value = state.naverPost;
  if ($("blogspotEditor")) $("blogspotEditor").value = state.blogspotPost;
  $("tagEditor").value = state.tags.join(" ");
  renderTitleCandidates();
  drawThumbnail();
  refreshReports();
}

function buildCodexRequestFromButton() {
  const input = getInput();
  autoMatchPhotos(input, false);
  renderPhotos();
  const request = buildCodexWritingRequest(input);
  $("codexPromptOutput").value = request;
  setAiStatus("원고 스타일과 Codex 요청서를 정리했어. 복사 버튼을 누른 뒤 이 Codex 대화에 붙여넣으면 돼.");
}

async function copyCodexPrompt() {
  const text = $("codexPromptOutput").value.trim() || buildCodexWritingRequest(getInput());
  $("codexPromptOutput").value = text;
  try {
    await navigator.clipboard.writeText(text);
    setAiStatus("Codex 요청서를 복사했어. 이 대화창에 붙여넣으면 내가 원고를 이어서 써줄 수 있어.");
  } catch {
    setAiStatus("브라우저가 복사를 막았어. Codex 요청서 칸의 내용을 직접 선택해서 복사해줘.", true);
  }
}

function buildCodexWritingRequest(input) {
  const experience = input.experience.map((item) => `- ${item}`).join("\n") || "- 아직 경험 메모 없음";
  const menus = input.menus.map((menu) => `- ${menu.name}${menu.local ? `(${menu.local})` : ""}: ${menu.note || "메모 없음"}`).join("\n") || "- 아직 메뉴 메모 없음";
  const voice = [input.voice, ...state.voicePresets].filter(Boolean).slice(0, 5).map((item) => `- ${item}`).join("\n") || "- 담백한 1인칭 후기체";
  const photos = state.photos.length
    ? state.photos.map((photo, index) => `- 사진 ${index + 1}: ${photo.caption || "설명 없음"} / ${photoSceneLabel(photo)} / ${photo.note || "추가 메모 없음"}`).join("\n")
    : "- 아직 사진 없음. 사진이 있으면 실제 사진 내용과 맞는 설명만 사용";
  const keywords = [...input.keywordsKo, ...input.keywordsGoogle].filter(Boolean).join(", ") || "검색어 미입력";
  const tags = makeTags(input).slice(0, 18).join(" ");

  return `
아래 기준으로 네이버 블로그 원고를 작성해줘.

[내가 원하는 원고 스타일]
- 단순 정보글이 아니라, 내가 실제로 다녀온 경험형 후기처럼 써줘.
- AI가 쓴 것처럼 매끈하기만 한 문장보다 내 상황과 감상이 자연스럽게 들어가야 해.
- 1인칭으로 쓰고, "내 기준으로는", "나는", "이날은", "다시 간다면" 같은 표현을 자연스럽게 섞어줘.
- 과장된 광고 문구, "추천드립니다", "만족스러운 경험", "도움이 되었으면 합니다" 같은 표현은 피해야 해.
- 검색 유입은 잡되, 읽으면 사람이 직접 다녀온 글처럼 느껴져야 해.
- 이미 방문한 곳이면 처음 가본 것처럼 쓰지 말고, 다시 방문한 뉘앙스가 있으면 반영해줘.
- 정보만 나열하지 말고 방문 상황, 위치, 분위기, 먹은 메뉴, 대기/예약 팁, 한국인 입맛 기준, 재방문 여부를 자연스럽게 연결해줘.
- 소제목은 7~10개 정도로 나누고, 소제목은 짧고 자연스러워야 해.
- 문단은 모바일에서 읽기 쉽게 2~4문장 단위로 나눠줘.
- 사진은 본문 흐름에 맞게 넣고, 사진 아래 설명은 실제 사진과 맞는 짧은 문장으로 써줘.
- 확실하지 않은 메뉴명이나 사진 내용은 절대 단정하지 말고 "같이 주문한 메뉴", "테이블에 나온 음식"처럼 안전하게 표현해줘.
- 마지막에는 결론과 FAQ, 태그를 포함해줘.

[이번 글 정보]
주제: ${input.topic || "미입력"}
장소명: ${input.place || "미입력"}
방문 날짜: ${input.date || "미입력"}
그날 상황: ${input.situation || "미입력"}

[내 말투 샘플]
${voice}

[경험 메모]
${experience}

[먹은 메뉴]
${menus}

[사진 메모]
${photos}

[SEO 검색어]
${keywords}

[태그 후보]
${tags}

[원고 작성 요청]
- 네이버 블로그에 바로 붙여넣을 수 있는 최종 원고로 써줘.
- 제목 후보 3개, 본문 원고, 사진 위치 제안, 사진 설명, FAQ, 태그를 포함해줘.
- 글은 너무 짧지 않게, 경험이 충분히 보이도록 작성해줘.
- 내 말투를 살리되 문장은 너무 지저분하지 않게 정리해줘.
`.trim();
}

async function generateWithOpenAI() {
  const apiKey = normalizeOpenAIKey($("openaiKeyInput").value);
  const model = $("aiModelInput").value.trim() || "gpt-5.5";
  if (!apiKey) {
    setAiStatus("OpenAI API 키를 먼저 넣어줘. ChatGPT 로그인과 API 키는 별도야.", true);
    return;
  }
  if (!isOpenAIKeyLike(apiKey)) {
    setAiStatus("지금 입력된 값은 OpenAI API 키 형식이 아니야. 키는 보통 sk- 또는 sk-proj-로 시작해. 잘못 저장된 값은 'API 키 지우기'를 눌러 지워줘.", true);
    return;
  }

  saveOpenAISettings();
  const input = getInput();
  autoMatchPhotos(input, true);
  renderPhotos();
  setAiStatus("사진을 AI가 읽을 수 있게 준비하는 중...");

  try {
    const aiPhotos = await prepareOpenAIPhotos(input);
    setAiStatus(`OpenAI에 원고를 요청하는 중... 사진 ${aiPhotos.length}장을 같이 보낼게.`);
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(makeOpenAIRequestBody(model, input, aiPhotos)),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error?.message || `OpenAI 요청 실패 (${response.status})`;
      throw new Error(message);
    }

    const rawText = extractOpenAIText(data);
    const result = parseOpenAIJson(rawText);
    applyOpenAIResult(result, input);
    setAiStatus(`AI 원고 생성 완료. 사진 ${aiPhotos.length}장을 보고 글 흐름에 맞춰 다시 썼어.`);
  } catch (error) {
    setAiStatus(`AI 원고 생성 실패: ${friendlyOpenAIError(error.message)}`, true);
  }
}

function friendlyOpenAIError(message) {
  const text = String(message || "");
  if (/incorrect api key|invalid api key/i.test(text)) {
    return "API 키가 올바르지 않아. 'API 키 지우기'를 누른 뒤 platform.openai.com에서 새로 만든 sk- 키를 넣어줘.";
  }
  if (/model.*not.*found|does not exist|not have access/i.test(text)) {
    return "현재 계정에서 이 모델을 사용할 수 없어요. 모델명을 계정에서 사용 가능한 모델로 바꿔줘.";
  }
  if (/quota|billing|insufficient/i.test(text)) {
    return "API 사용량이나 결제 설정을 확인해야 해. OpenAI 사용량/결제 상태를 보고 다시 시도해줘.";
  }
  return text;
}

function setAiStatus(message, isError = false) {
  const status = $("aiStatus");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("status-warn", Boolean(isError));
  status.classList.toggle("status-good", !isError && /완료|저장|성공/.test(message));
  status.classList.toggle("status-working", !isError && /중|진행|정리하고/.test(message));
}

function setThumbnailAiStatus(message, isError = false) {
  const status = $("thumbnailAiStatus");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("status-warn", Boolean(isError));
  status.classList.toggle("status-good", !isError && /완료|저장|성공|적용/.test(message));
  status.classList.toggle("status-working", !isError && /중|생성|준비/.test(message));
}

async function generateAIThumbnailImage() {
  const apiKey = normalizeOpenAIKey($("openaiKeyInput").value);
  const model = $("thumbnailImageModelInput").value.trim() || "gpt-image-1";
  if (!apiKey) {
    setThumbnailAiStatus("OpenAI API 키를 먼저 넣어줘. 기존 OpenAI 자동 작성 칸의 키를 같이 써.", true);
    return;
  }
  if (!isOpenAIKeyLike(apiKey)) {
    setThumbnailAiStatus("API 키 형식이 맞지 않아. sk- 또는 sk-proj-로 시작하는 키를 넣어줘.", true);
    return;
  }

  saveOpenAISettings();
  saveThumbnailSettings();
  const button = $("generateAiThumbBtn");
  const originalLabel = button.textContent;
  button.disabled = true;
  button.classList.add("is-busy");
  button.textContent = "4개 만드는 중";
  const referencePhoto = thumbnailReferencePhoto();
  setThumbnailAiStatus(referencePhoto
    ? `"${referencePhoto.caption || referencePhoto.name || "업로드 사진"}"을 기준으로 밝은 고퀄 반만화 썸네일 후보 4개를 만드는 중이야. 보통 30~90초 정도 걸릴 수 있어.`
    : "업로드 사진이 없어서 새 썸네일 후보 4개를 만드는 중이야. 보통 30~90초 정도 걸릴 수 있어.");

  try {
    const input = getInput();
    const response = referencePhoto
      ? await requestThumbnailImageEdit(apiKey, model, input, referencePhoto)
      : await requestThumbnailImageGeneration(apiKey, model, input);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error?.message || `AI 썸네일 사진 생성 실패 (${response.status})`;
      throw new Error(message);
    }
    const candidates = await Promise.all((data?.data || []).slice(0, 4).map((item) => imageResultToDataUrl(item)));
    state.thumbnailCandidates = candidates
      .filter(Boolean)
      .map((dataUrl, index) => ({ id: makeId(), dataUrl, label: `추천 ${index + 1}` }));
    if (!state.thumbnailCandidates.length) throw new Error("생성된 이미지를 읽지 못했어.");
    state.selectedThumbnailCandidate = 0;
    state.aiThumbnailDataUrl = state.thumbnailCandidates[0].dataUrl;
    renderThumbnailCandidates();
    drawThumbnail();
    setThumbnailAiStatus(referencePhoto
      ? `추천 썸네일 ${state.thumbnailCandidates.length}개 완성. 첫 번째 후보를 적용했어. 마음에 드는 후보를 아래에서 골라봐.`
      : `추천 썸네일 ${state.thumbnailCandidates.length}개 완성. 첫 번째 후보를 적용했어. 마음에 드는 후보를 아래에서 골라봐.`);
  } catch (error) {
    setThumbnailAiStatus(`AI 썸네일 변환 실패: ${friendlyOpenAIError(error.message)}`, true);
  } finally {
    button.disabled = false;
    button.classList.remove("is-busy");
    button.textContent = originalLabel;
  }
}

function clearAIThumbnailImage() {
  state.aiThumbnailDataUrl = "";
  state.thumbnailCandidates = [];
  state.selectedThumbnailCandidate = -1;
  renderThumbnailCandidates();
  drawThumbnail();
  setThumbnailAiStatus("AI 사진을 지우고 업로드 사진 조합 방식으로 돌아갔어.");
}

function renderThumbnailCandidates() {
  const list = $("thumbnailCandidateList");
  if (!list) return;
  if (!state.thumbnailCandidates.length) {
    list.innerHTML = "";
    return;
  }
  list.innerHTML = state.thumbnailCandidates.map((candidate, index) => `
    <button class="thumbnail-candidate${index === state.selectedThumbnailCandidate ? " is-selected" : ""}" type="button" data-candidate-index="${index}">
      <img src="${candidate.dataUrl}" alt="${candidate.label}">
      <span>${candidate.label}</span>
    </button>
  `).join("");
}

function handleThumbnailCandidateClick(event) {
  const button = event.target.closest("[data-candidate-index]");
  if (!button) return;
  const index = Number(button.dataset.candidateIndex);
  const candidate = state.thumbnailCandidates[index];
  if (!candidate) return;
  state.selectedThumbnailCandidate = index;
  state.aiThumbnailDataUrl = candidate.dataUrl;
  renderThumbnailCandidates();
  drawThumbnail();
  setThumbnailAiStatus(`${candidate.label} 썸네일을 적용했어.`);
}

async function requestThumbnailImageGeneration(apiKey, model, input) {
  return fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt: buildThumbnailImagePrompt(input, false),
      size: "1536x1024",
      quality: "high",
      n: 4,
    }),
  });
}

async function requestThumbnailImageEdit(apiKey, model, input, photo) {
  const formData = new FormData();
  formData.append("model", model);
  formData.append("prompt", buildThumbnailImagePrompt(input, true));
  formData.append("size", "1536x1024");
  formData.append("quality", "high");
  formData.append("n", "4");
  const referenceBlob = await makeThumbnailReferenceBlob(photo.dataUrl);
  formData.append("image", referenceBlob, "thumbnail-reference.png");

  return fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });
}

function thumbnailReferencePhoto() {
  const candidates = state.photos.filter((photo) => photo.dataUrl && photo.role !== "exclude");
  if (!candidates.length) return null;
  return candidates.find((photo) => photo.role === "thumbnail")
    || candidates.find((photo) => ["food", "drink", "interior", "exterior"].includes(photo.role))
    || candidates[0];
}

async function makeThumbnailReferenceBlob(dataUrl) {
  const img = await loadCanvasImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = 1536;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("기준 사진을 변환하지 못했어.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#20140c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  coverImageIn(ctx, img, 0, 0, canvas.width, canvas.height);
  return canvasToBlob(canvas, "image/png", 0.95);
}

function canvasToBlob(canvas, type = "image/png", quality = 0.95) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("이미지 파일을 만들지 못했어."));
    }, type, quality);
  });
}

function buildThumbnailImagePrompt(input, hasReference = false) {
  const menus = input.menus.map((menu) => `${menu.name}${menu.local ? ` (${menu.local})` : ""}`).join(", ") || "Indonesian food";
  const extraStyle = $("thumbnailPromptInput").value.trim();
  const referenceRule = hasReference
    ? "Use the provided image as the main reference. Preserve the useful composition, food placement, table angle, and restaurant mood, but upgrade it into a cleaner high-quality thumbnail background."
    : "Create a new high-quality thumbnail background from the description.";
  return `
Create 4 distinct recommendation candidates with different framing, brightness, and food emphasis while keeping all candidates usable as a blog thumbnail background.
${referenceRule}
Subject: ${input.place || input.topic || "Indonesian restaurant"} in Jakarta/Kokas style.
Food on table: ${menus}.
Style: premium Korean blog / YouTube thumbnail background, semi-illustrated but still food-photography based, crisp details, glossy appetizing food, warm but bright colors, slightly cartoon-like outlines, cinematic restaurant lighting, polished and high-resolution.
Mood: warm Indonesian restaurant interior, cozy lighting, wooden table, teal or green tiles if suitable, soft background blur, appetizing grilled prawns and satay skewers, rice basket, sambal sauce, jahe madu tea.
Composition: leave the left 42 percent clean for large title text, but do not make it black or heavily dark. Keep food in the lower center and right side. Keep the restaurant atmosphere visible in the back. Overall brightness should feel warm, appetizing, and clear.
Style note from user: ${extraStyle || "high-quality semi-cartoon restaurant thumbnail, polished but natural"}
Important: remove or ignore any existing letters, Korean/English/Indonesian words, red check marks, icons, UI buttons, watermark, logo, sign text, people faces, hands, menu text, or browser screenshot artifacts from the reference image. The app will add all title text later.
`.trim();
}

async function imageResultToDataUrl(item) {
  if (!item) return "";
  if (item.b64_json) return `data:image/png;base64,${item.b64_json}`;
  if (!item.url) return "";
  const imageResponse = await fetch(item.url);
  if (!imageResponse.ok) return "";
  const blob = await imageResponse.blob();
  return blobToDataUrl(blob);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("이미지를 변환하지 못했어."));
    reader.readAsDataURL(blob);
  });
}

async function prepareOpenAIPhotos(input) {
  const limit = input.photoDensity === "all" ? state.photos.length : input.photoDensity === "many" ? 18 : 14;
  const photos = state.photos.slice(0, limit);
  const prepared = [];

  for (let i = 0; i < photos.length; i += 1) {
    const photo = photos[i];
    try {
      const imageUrl = await resizePhotoForOpenAI(photo.dataUrl);
      prepared.push({
        index: i + 1,
        name: photo.name || `photo-${i + 1}`,
        caption: photo.caption || "",
        note: photo.note || "",
        role: photo.role || "",
        imageUrl,
      });
    } catch (error) {
      console.warn("OpenAI photo skipped", photo.name, error);
    }
  }

  return prepared;
}

function resizePhotoForOpenAI(dataUrl, maxSide = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const sourceWidth = img.naturalWidth || img.width;
      const sourceHeight = img.naturalHeight || img.height;
      const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
      const width = Math.max(1, Math.round(sourceWidth * scale));
      const height = Math.max(1, Math.round(sourceHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("사진 변환을 할 수 없어요."));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("사진을 읽지 못했어요. JPG, PNG, WEBP 사진을 써줘."));
    img.src = dataUrl;
  });
}

function makeOpenAIRequestBody(model, input, aiPhotos) {
  const content = [
    {
      type: "input_text",
      text: makeOpenAIPrompt(input, aiPhotos),
    },
  ];

  aiPhotos.forEach((photo) => {
    content.push({
      type: "input_text",
      text: `사진 ${photo.index}\n파일명: ${photo.name}\n기존 표시명: ${photo.caption || "없음"}\n사용자 메모: ${photo.note || "없음"}\n기존 분류: ${photo.role || "없음"}`,
    });
    content.push({
      type: "input_image",
      image_url: photo.imageUrl,
      detail: "low",
    });
  });

  return {
    model,
    input: [
      {
        role: "user",
        content,
      },
    ],
    max_output_tokens: 12000,
    text: {
      format: {
        type: "json_schema",
        name: "naver_blog_post",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["title", "naver_post", "tags", "thumbnail_title", "thumbnail_ribbon", "photo_plan"],
          properties: {
            title: { type: "string" },
            naver_post: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            thumbnail_title: { type: "string" },
            thumbnail_ribbon: { type: "string" },
            photo_plan: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["photo", "caption", "reason"],
                properties: {
                  photo: { type: "number" },
                  caption: { type: "string" },
                  reason: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  };
}

function makeOpenAIPrompt(input, aiPhotos) {
  const menus = input.menus.map((menu) => `- ${menu.name}${menu.local ? `(${menu.local})` : ""}: ${menu.note || "메모 없음"}`).join("\n") || "메뉴 메모 없음";
  const experience = input.experience.map((item) => `- ${item}`).join("\n") || "경험 메모 없음";
  const keywords = [...input.keywordsKo, ...input.keywordsGoogle].filter(Boolean).join(", ");
  const searchKeywords = keywords || [input.place, input.topic].filter(Boolean).join(", ") || "현재 입력한 장소와 메뉴";
  const menuExamples = input.menus.map((menu) => menu.local || menu.name).filter(Boolean).slice(0, 3).join(", ") || "사진 속 메뉴명";
  const photoNumbers = aiPhotos.map((photo) => `사진 ${photo.index}`).join(", ") || "사진 없음";
  const photoDensityLabel = input.photoDensity === "recommended" ? "추천컷만" : input.photoDensity === "many" ? "조금 더 많이" : "모두 넣기";
  const extraInstruction = $("aiInstructionInput").value.trim();
  const voiceSamples = [input.voice, ...state.voicePresets].filter(Boolean).slice(0, 6).map((item) => `- ${item}`).join("\n") || "- 담백한 1인칭 후기체";

  return `
너는 한국어 네이버 블로그 맛집 글을 쓰는 전문 작가야.
사용자의 실제 경험을 바탕으로, AI가 쓴 것처럼 딱딱하지 않게 1인칭으로 자연스럽게 써줘.
아래 말투 샘플을 반드시 반영해서, 문장 끝과 표현 습관이 사용자 본인 글처럼 느껴지게 써줘.

[목표]
- 구글문서로 사람이 함께 다듬은 최종 원고처럼 자연스럽고 긴 네이버 블로그 포스팅을 만든다.
- 사용자가 네이버 블로그에 바로 붙여 넣을 수 있는 최종 업로드용 원고를 만든다.
- 사진을 직접 보고 글 흐름에 맞는 위치에 넣는다.
- 사진 속 메뉴명이 확실하지 않으면 ${menuExamples}처럼 단정하지 않는다.
- 확실하지 않은 사진은 "테이블에 나온 음식", "같이 주문한 메뉴", "내부 분위기"처럼 안전하게 표현한다.
- 사진 설명은 사진 바로 아래에 1문장으로 붙인다.
- 제목은 검색어가 들어가되 너무 광고처럼 보이지 않게 쓴다.
- 소제목은 7~10개 정도로 나누고, 각 소제목 아래 문단은 2~5문단으로 정리한다.
- 소제목은 반드시 본문 중간중간에 독립된 한 줄로 넣는다. 마크다운 # 기호는 쓰지 않는다.
- 소제목은 10~22자 정도의 짧은 말투로 쓰고, 마침표로 끝내지 않는다.
- 소제목 예시: 다시 가도 좋았던 이유 / 방문한 날의 기록 / 분위기와 위치 / 먹어본 메뉴 / 예약과 방문 팁 / 마무리하면
- 독자가 지루하지 않도록 짧은 강조 문장과 긴 설명 문단을 섞는다.
- 단락 사이에는 빈 줄을 넣어 모바일에서 읽기 쉽게 만든다.

[입력 정보]
주제: ${input.topic}
장소: ${input.place}
방문 날짜: ${input.date}
그날 상황: ${input.situation}
추가 요청: ${extraInstruction || "없음"}

[반드시 반영할 사용자 말투 샘플]
${voiceSamples}

[경험 메모]
${experience}

[먹은 메뉴]
${menus}

[SEO 키워드]
${searchKeywords}

[사용 가능한 사진 번호]
${photoNumbers}

[사진 사용량 설정]
${photoDensityLabel}

[원고 규칙]
- naver_post는 제목부터 시작하는 완성 원고로 작성한다.
- 한국어 중심으로 쓰고, 필요한 곳에 ${searchKeywords} 같은 검색어를 자연스럽게 넣는다.
- 글은 최소 4500자 이상을 목표로 한다.
- 소제목은 너무 과장하지 말고 자연스럽게 쓴다.
- 소제목은 한 줄에 하나씩 쓰고, 바로 다음 줄부터 본문을 쓴다. 소제목 없는 긴 문단 덩어리를 만들지 않는다.
- 메뉴, 위치, 예약/대기, 결론 파트는 반드시 각각 소제목을 둔다.
- 사진을 넣을 위치에는 반드시 [사진 1: 짧은 캡션] 형식을 사용한다.
- [사진 N: 캡션] 바로 다음 줄에는 사진을 설명하는 자연스러운 1문장을 쓴다.
- 사진 번호는 제공된 사진 번호만 사용한다.
- 사진 사용량 설정이 "모두 넣기"이면 직접 제외된 사진만 빼고 제공된 사진을 모두 쓴다.
- 사진 사용량 설정이 "추천컷만" 또는 "조금 더 많이"일 때만 블로그에 어울리는 사진을 선별한다.
- 글 끝에는 FAQ와 태그를 포함한다.
- 태그는 18개 이하로 추천한다.
- "추천드립니다", "만족스러운 경험", "도움이 되었으면 합니다" 같은 AI식 표현은 피한다.
- 사용자의 실제 경험에서 나온 말처럼, 너무 단정하지 않고 "내 기준으로는", "나는", "이날은" 같은 표현을 자연스럽게 쓴다.

반드시 JSON만 반환해줘.
`.trim();
}

function extractOpenAIText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  const chunks = [];
  (data.output || []).forEach((item) => {
    (item.content || []).forEach((content) => {
      if (typeof content.text === "string") chunks.push(content.text);
      if (typeof content.output_text === "string") chunks.push(content.output_text);
    });
  });
  return chunks.join("\n").trim();
}

function parseOpenAIJson(text) {
  if (!text) throw new Error("OpenAI 응답이 비어 있어요.");
  try {
    return JSON.parse(text);
  } catch (error) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("OpenAI 응답을 원고 형식으로 읽지 못했어요.");
  }
}

function applyOpenAIResult(result, input) {
  disableDirectPreviewEdit();
  const title = String(result.title || "").trim();
  const post = String(result.naver_post || "").trim();
  if (!post) throw new Error("AI가 원고 본문을 보내지 않았어요.");
  const polishedPost = buildPolishedPostText(post);

  const tags = dietTags((result.tags || []).map((tag) => String(tag).trim()).filter(Boolean), 18);
  state.tags = tags.length ? tags.map((tag) => tag.startsWith("#") ? tag : `#${tag}`) : makeTags(input);
  state.naverPost = polishedPost;
  state.isPolished = true;
  state.blogspotPost = makeBlogspotPost(input, state.tags, state.naverPost);
  state.titleCandidates = unique([
    title,
    ...makeTitleCandidates(input).map((item) => item.text),
  ].filter(Boolean)).slice(0, 5).map((text, index) => ({ type: index === 0 ? "AI 추천" : "후보", text }));

  if (result.thumbnail_title) $("thumbTitleInput").value = String(result.thumbnail_title).trim();
  if (result.thumbnail_ribbon) $("thumbRibbonInput").value = String(result.thumbnail_ribbon).trim();
  $("postEditor").value = state.naverPost;
  if ($("blogspotEditor")) $("blogspotEditor").value = state.blogspotPost;
  $("tagEditor").value = state.tags.join(" ");
  renderTitleCandidates();
  drawThumbnail();
  refreshReports();
  activateTab("naver");
}

async function runAIWebReview() {
  syncPreviewEditsIfNeeded({ silent: true });
  const apiKey = normalizeOpenAIKey($("openaiKeyInput").value);
  const model = $("aiModelInput").value.trim() || "gpt-5.5";
  if (!apiKey || !isOpenAIKeyLike(apiKey)) {
    setAiSearchReport("OpenAI API 키를 먼저 확인해줘. sk- 또는 sk-proj-로 시작하는 키가 필요해.", true);
    activateTab("report");
    return;
  }

  const input = getInput();
  const currentPost = $("postEditor").value.trim();
  if (!currentPost) {
    setAiSearchReport("먼저 AI 원고를 생성하거나 원고를 입력해줘.", true);
    activateTab("report");
    return;
  }

  setAiSearchReport("AI가 웹 검색으로 장소명, 메뉴 표기, 방문 팁을 검수하는 중...");
  activateTab("report");

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(makeWebReviewRequestBody(model, input, currentPost)),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error?.message || `AI 검색 검수 실패 (${response.status})`;
      throw new Error(message);
    }
    const rawText = extractOpenAIText(data);
    const result = parseOpenAIJson(rawText);
    applyWebReviewResult(result, input, data);
  } catch (error) {
    setAiSearchReport(`AI 검색 검수 실패: ${friendlyOpenAIError(error.message)}`, true);
  }
}

function makeWebReviewRequestBody(model, input, currentPost) {
  return {
    model,
    tools: [
      {
        type: "web_search",
        search_context_size: "low",
      },
    ],
    tool_choice: "auto",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: makeWebReviewPrompt(input, currentPost),
          },
        ],
      },
    ],
    max_output_tokens: 10000,
    text: {
      format: {
        type: "json_schema",
        name: "web_review_result",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["revised_post", "tags", "report", "sources"],
          properties: {
            revised_post: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            report: { type: "array", items: { type: "string" } },
            sources: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["title", "url"],
                properties: {
                  title: { type: "string" },
                  url: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  };
}

function makeWebReviewPrompt(input, currentPost) {
  return `
너는 네이버 블로그 맛집 글의 최종 검수자야.
웹 검색을 사용해 장소명, 몰 이름, 메뉴 표기, 방문 팁, SEO 키워드를 확인하고 원고를 다듬어줘.

[검수 대상]
장소: ${input.place}
주제: ${input.topic}
키워드: ${[...input.keywordsKo, ...input.keywordsGoogle].join(", ")}

[현재 원고]
${currentPost}

[작업]
- 웹 검색으로 확인 가능한 정보만 보정한다.
- 사용자의 실제 경험, 말투, 감상은 훼손하지 않는다.
- 확실하지 않은 영업시간, 가격, 예약 정책은 단정하지 않는다.
- 검색해서 얻은 일반 정보는 글 안에 자연스럽게 녹인다.
- 제목, 소제목, 문단 구분, 태그를 바로 업로드 가능한 상태로 정리한다.
- 사진 위치 표시 [사진 N: 캡션]은 유지한다.
- 출처 URL은 sources에 담는다.

반드시 JSON만 반환해줘.
`.trim();
}

function applyWebReviewResult(result, input, rawData) {
  const revisedPost = String(result.revised_post || "").trim();
  if (!revisedPost) throw new Error("검색 검수 결과에 수정 원고가 없어요.");
  const tags = dietTags((result.tags || []).map((tag) => String(tag).trim()).filter(Boolean), 18);
  state.tags = tags.length ? tags.map((tag) => tag.startsWith("#") ? tag : `#${tag}`) : state.tags;
  state.naverPost = revisedPost;
  state.blogspotPost = makeBlogspotPost(input, state.tags, state.naverPost);
  $("postEditor").value = state.naverPost;
  if ($("blogspotEditor")) $("blogspotEditor").value = state.blogspotPost;
  $("tagEditor").value = state.tags.join(" ");
  state.aiSearchReport = result.report || [];
  state.aiSearchSources = mergeWebSources(result.sources || [], rawData);
  refreshReports();
  setAiSearchReport("AI 검색 검수 완료. 검색 결과를 반영해 원고를 다시 정리했어.");
  activateTab("naver");
}

function mergeWebSources(sources, data) {
  const collected = [];
  (sources || []).forEach((source) => {
    if (source?.url) collected.push({ title: source.title || source.url, url: source.url });
  });
  (data.output || []).forEach((item) => {
    (item.content || []).forEach((content) => {
      (content.annotations || []).forEach((annotation) => {
        const url = annotation.url || annotation.url_citation?.url;
        const title = annotation.title || annotation.url_citation?.title || url;
        if (url) collected.push({ title, url });
      });
    });
  });
  return unique(collected.map((item) => JSON.stringify(item))).map((item) => JSON.parse(item)).slice(0, 8);
}

function setAiSearchReport(message, isError = false) {
  const target = $("aiSearchReport");
  if (!target) return;
  target.innerHTML = `<p class="metric-row ${isError ? "status-warn" : "status-good"}">${escapeHtml(message)}</p>${renderStoredAiSearchReport()}`;
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
    .replace(/만족스러웠다$/g, "만족스러웠어")
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
    "코타카사블랑카 안에서 인도네시아 음식을 편하게 먹기 좋은 식당이야. 분위기는 따뜻하고, 메뉴도 한국인 입맛에 너무 어렵지 않은 편이라 처음 오는 사람을 데려가기에도 괜찮아.",
    "· 몰 안에 있어서 퇴근길이나 약속 전후로 들르기 편해",
    "· 음식이 대체로 무난해서 실패 확률이 낮아",
    "· 분위기가 따뜻해서 다시 가도 기분 좋은 곳이야",
    "코타카사블랑카 안에서 만난 Pesta Kebun은 입구부터 눈에 잘 들어오는 편이야. 밖에서 봐도 내부 분위기가 따뜻해 보여서 그냥 지나치기 어렵더라.",
    "나는 이런 식당이 좋아. 엄청 특별한 날을 위해 마음먹고 가는 곳이라기보다, 평범한 날 밥 한 끼를 기분 좋게 만들어주는 쪽에 가까워서 더 자주 생각나는 곳.",
  ];
}

function makePhotoReflectionSection(input) {
  const plan = makePhotoPlan(input);
  if (!plan.length) return [];
  const linesOut = [
    "본문에 넣을 사진",
    "아래 사진들은 원고에 넣을 위치만 잡아둔 거야. 사진 설명을 억지로 붙이지 않고, 글 흐름 사이에 자연스럽게 보여주는 방식이야.",
  ];
  plan.forEach((photo) => {
    linesOut.push(photoMarker(photo));
    const note = photoNoteForPost(photo, input);
    if (note) linesOut.push(note);
  });
  return linesOut;
}

function makeAtmosphereSection(input) {
  const { selected } = selectedPhotoPlan(input);
  const settings = photoPlanSettings(input);
  const interiorPhotos = selected.filter((photo) => ["thumbnail", "exterior", "interior", "body"].includes(photo.role)).slice(0, settings.atmosphere);
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
      linesOut.push(photoMarker(photo));
      const note = photoNoteForPost(photo, input);
      if (note) linesOut.push(note);
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
    ...photoLinesForGeneralFood(input),
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
  return `인니어 메뉴 이름이 낯설 수 있는데, ${terms.join(", ")} 정도로 보면 돼. 단어 뜻을 조금 알면 메뉴판 보는 게 훨씬 쉬워져.`;
}

function makeMenuReview(menu, input) {
  const label = `${menu.name}${menu.local ? `(${menu.local})` : ""}`;
  const note = menu.note ? softSentence(menu.note) : `${menu.name}는 내 기준으로 무난하게 먹기 좋았어.`;
  const key = `${menu.name} ${menu.local}`.toLowerCase();
  const linesOut = [label];
  const menuPhotos = photoLinesForMenu(menu, input);

  if (/sate|사테/.test(key)) {
    linesOut.push("먼저 사테. 사테는 한국 사람도 부담 없이 먹기 좋은 인도네시아 음식인 것 같아.");
    linesOut.push("꼬치구이라 익숙한데, 땅콩소스가 올라가면 확실히 인도네시아 맛이 나.");
    linesOut.push(note);
    linesOut.push("한 입 먹으면 고소한 소스 맛이 먼저 오고, 뒤에 살짝 구운 향이 올라와. 라임을 조금 짜서 먹으면 더 깔끔해지고.");
    linesOut.push("이건 흰밥이랑 같이 먹어야 더 맛있어. 소스가 진한 편이라 밥 위에 살짝 올려 먹어도 맛이 잘 살아나거든.");
    linesOut.push("한국에서 꼬치구이를 좋아하는 사람이라면 사테도 크게 낯설지 않을 것 같아. 다만 우리가 흔히 먹는 소금구이나 데리야끼 꼬치와는 다르게, 땅콩소스가 들어가면서 더 부드럽고 묵직한 맛이 나는 게 차이점이야.");
    linesOut.push("사테는 인도네시아에서 정말 흔하게 볼 수 있는 메뉴인데, 식당마다 소스 농도나 단맛, 고기 굽기 정도가 조금씩 달라. Pesta Kebun 사테는 내 기준으로 고소한 맛이 먼저 느껴지는 편이었어.");
    linesOut.push("다만 소스가 진한 편이라 계속 먹으면 살짝 무겁게 느껴질 수도 있어. 그럴 때 라임을 조금 곁들이면 훨씬 깔끔해지고, 다른 메뉴랑 번갈아 먹기도 좋아.");
    if (menuPhotos.length) {
      linesOut.push(...menuPhotos);
    }
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
    if (menuPhotos.length) {
      linesOut.push(...menuPhotos);
    }
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
    if (menuPhotos.length) {
      linesOut.push(...menuPhotos);
    }
    return linesOut;
  }

  linesOut.push(note);
  linesOut.push("이 메뉴는 처음 보는 이름이어도 막 어렵게 느껴지는 쪽은 아니었어. 향이 부담스럽지 않고, 밥이나 다른 메뉴와 같이 먹기 괜찮은 편이야.");
  linesOut.push("다음에 같은 곳을 다시 간다면 이 메뉴를 기준으로 다른 메뉴를 하나 더 붙여서 시켜볼 것 같아.");
  return linesOut;
}

function photoLinesForMenu(menu, input) {
  const { selected } = selectedPhotoPlan(input);
  const settings = photoPlanSettings(input);
  const matches = selected
    .filter((photo) => ["food", "drink", "menu"].includes(photo.role) || photoMatchesMenu(photo, menu))
    .filter((photo) => photoMatchesMenu(photo, menu))
    .slice(0, settings.menuPlacement);

  return matches.flatMap((photo) => [
    photoMarker(photo),
    photoNoteForPost(photo, input),
  ].filter(Boolean));
}

function photoLinesForGeneralFood(input) {
  const { selected } = selectedPhotoPlan(input);
  const settings = photoPlanSettings(input);
  const matches = selected
    .filter((photo) => ["food", "drink", "menu"].includes(photo.role))
    .filter((photo) => !matchedMenuForPhoto(photo, input))
    .slice(0, Math.min(6, settings.menuPlacement * 2));

  return matches.flatMap((photo) => [
    photoMarker(photo),
    photoNoteForPost(photo, input),
  ].filter(Boolean));
}

function photoMarker(photo) {
  const caption = trustedPhotoCaption(photo);
  return caption ? `[사진 ${photo.index}: ${caption}]` : `[사진 ${photo.index}]`;
}

function trustedPhotoCaption(photo) {
  if (!photo) return "";
  const caption = String(photo.caption || "").trim();
  if (!caption || isGenericPhotoCaption(caption)) return "";
  return photo.userEdited ? caption : "";
}

function manualPhotoNote(photo) {
  const note = String(photo?.note || "").trim();
  if (!note || isGenericPhotoNote(note)) return "";
  return photo?.userEdited ? note : "";
}

function photoNoteForPost(photo, input) {
  const manual = manualPhotoNote(photo);
  if (manual) return manual;
  const mode = input.photoCaptionMode || "safe";
  if (mode === "none" || mode === "manual") return "";
  return safePhotoNote(photo, input);
}

function safePhotoNote(photo, input) {
  const place = shortPlace(input.place || input.topic || "이곳");
  const role = photo?.role || "body";
  const index = Number(photo?.index || 1);
  const pick = (items) => items[(index - 1) % items.length];

  if (role === "drink") {
    return pick([
      "음식이랑 같이 마시기 괜찮았던 음료. 양념 있는 메뉴를 먹을 때 중간중간 입을 정리해주는 느낌이 있었어.",
      "메뉴가 조금 진하게 느껴질 때 같이 마시기 좋았어. 이런 음료가 하나 있으면 식사 흐름이 더 편해져.",
    ]);
  }

  if (role === "menu") {
    return "메뉴 이름이 낯설 수 있어서, 처음 방문한다면 먹어보고 싶은 메뉴를 미리 몇 개 정해두고 가는 게 편해.";
  }

  if (["thumbnail", "exterior", "interior", "body"].includes(role) && photo?.analysis?.visualRole !== "food") {
    return pick([
      `${place}는 조명이 따뜻해서 사진으로 봐도 분위기가 꽤 잘 남는 편이야.`,
      "몰 안에 있는 식당인데도 내부 분위기가 차갑지 않아서, 앉아 있는 동안 편하게 느껴졌어.",
      "이런 분위기 때문에 그냥 밥만 먹고 나오는 곳이라기보다, 잠깐 기분 전환하는 느낌도 있었어.",
    ]);
  }

  return pick([
    "이날 테이블에 올라온 음식들. 메뉴 하나만 단독으로 먹기보다 여러 가지를 같이 놓고 나눠 먹는 흐름이 괜찮았어.",
    "소스가 있는 메뉴들이라 밥이랑 같이 먹기 좋았고, 처음 먹는 사람도 크게 어렵지 않을 조합이었어.",
    "사진으로 남겨두니 그날 먹었던 메뉴 조합이 더 잘 기억나. 이런 식당은 여러 메뉴를 같이 시켜야 더 맛있는 것 같아.",
  ]);
}

function photoMatchesMenu(photo, menu) {
  const targetMenu = menuForPhotoTarget(photo, getInput());
  if (targetMenu) return sameMenu(targetMenu, menu);
  const haystack = photoMenuEvidence(photo);
  const targets = [
    menu.name,
    menu.local,
    ...(menu.local || "").split(/\s+/),
    ...(menu.name || "").split(/\s+/),
  ].filter(Boolean).map((item) => item.toLowerCase());
  if (targets.some((target) => target.length > 1 && haystack.includes(target))) return true;
  const menuText = `${menu.name} ${menu.local}`.toLowerCase();
  if (/sate|사테/.test(menuText) && /sate|사테|꼬치/.test(haystack)) return true;
  if (/udang|우당|새우/.test(menuText) && /udang|우당|새우|shrimp/.test(haystack)) return true;
  if (/jahe|자헤|madu|마두|생강|꿀/.test(menuText) && /jahe|자헤|madu|마두|생강|꿀/.test(haystack)) return true;
  return false;
}

function sameMenu(a, b) {
  return normalizePreviewLine(`${a?.name || ""} ${a?.local || ""}`).toLowerCase()
    === normalizePreviewLine(`${b?.name || ""} ${b?.local || ""}`).toLowerCase();
}

function photoMenuEvidence(photo) {
  const parts = [photo.name || ""];
  if (photo.userEdited || !photo.autoMatched) {
    parts.push(photo.caption || "", photo.note || "");
  }
  return parts.join(" ").toLowerCase();
}

function menuMatchesVisualKey(menu, key) {
  const text = `${menu.name || ""} ${menu.local || ""}`.toLowerCase();
  if (key === "sate") return /sate|satay|사테/.test(text);
  if (key === "udang") return /udang|우당|새우|shrimp/.test(text);
  if (key === "drink") return /jahe|자헤|madu|마두|생강|꿀|drink|음료/.test(text);
  return false;
}

function photoRoleLabel(role) {
  const labels = {
    thumbnail: "썸네일",
    exterior: "외관/입구",
    interior: "분위기",
    menu: "메뉴판",
    food: "음식",
    drink: "음료",
    map: "지도/위치",
    body: "기타",
    exclude: "제외",
  };
  return labels[role] || "기타";
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
  syncPreviewEditsIfNeeded({ silent: true });
  const input = getInput();
  const tags = parseCommaOrSpaceTags($("tagEditor").value || state.tags.join(" "));
  const naverPost = $("postEditor").value.trim() || makeNaverPost(input, tags);
  state.blogspotPost = convertNaverPostToBlogspot(input, tags, naverPost);
  if ($("blogspotEditor")) $("blogspotEditor").value = state.blogspotPost;
  if ($("blogspotTab")) activateTab("blogspot");
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
  if (/맛집|식당|Restaurant|Food|카페|몰|Mall|Kokas|Kota|Kasablanka|Jakarta|자카르타/i.test(tag)) score += 4;
  if (/쌀국수|pho|포24|pho24|사테|우당|자헤|Sate|Udang|Jahe|메뉴|음식/i.test(tag)) score += 3;
  if (/주재원|여행|인도네시아|자카르타/i.test(tag)) score += 2;
  return score;
}

function makePhotoPlan(input) {
  return state.photos.map((photo, index) => ({
    index: index + 1,
    caption: photo.caption || `사진 ${index + 1}`,
    role: photo.role,
    size: photo.size || "auto",
    target: photo.target || "auto",
    name: photo.name || "",
    analysis: photo.analysis || null,
    autoMatched: Boolean(photo.autoMatched),
    userEdited: Boolean(photo.userEdited),
    width: photo.width || 0,
    height: photo.height || 0,
    aspectRatio: photo.aspectRatio || 1,
    note: photo.note || photoPlacementNote(photo, input),
    alt: `${input.place || input.topic} ${photo.caption || photo.role}`,
  }));
}

function selectedPhotoPlan(input) {
  const plan = makePhotoPlan(input);
  const selected = [];
  const skipped = [];
  const settings = photoPlanSettings(input);
  const counts = {
    total: 0,
    atmosphere: 0,
    menuBoard: 0,
    drink: 0,
    food: new Map(),
    captions: new Map(),
  };

  const rankedPlan = plan
    .map((photo) => ({ ...photo, blogScore: photoBlogScore(photo) }))
    .sort((a, b) => b.blogScore - a.blogScore || a.index - b.index);

  rankedPlan.forEach((photo) => {
    const menu = matchedMenuForPhoto(photo, input);
    const decision = photoSelectionDecision(photo, menu, counts, settings);

    if (!decision.use) {
      skipped.push({ ...photo, skipped: true, skipReason: decision.reason });
      return;
    }

    selected.push({ ...photo, matchedMenu: menu, skipped: false });
    registerSelectedPhoto(photo, menu, counts, settings);
  });

  return {
    selected: selected.sort((a, b) => a.index - b.index),
    skipped: skipped.sort((a, b) => a.index - b.index),
  };
}

function photoPlanSettings(input) {
  const density = input.photoDensity || "all";
  if (density === "recommended") {
    return { maxTotal: 11, atmosphere: 3, menuBoard: 1, drink: 2, perMenu: 2, sameCaption: 2, menuPlacement: 2, minScore: 58 };
  }
  if (density === "all") {
    return { includeAll: true, maxTotal: Math.max(state.photos.length, 1), atmosphere: state.photos.length, menuBoard: state.photos.length, drink: state.photos.length, perMenu: state.photos.length, sameCaption: state.photos.length, menuPlacement: state.photos.length, minScore: 0 };
  }
  return { maxTotal: 14, atmosphere: 4, menuBoard: 1, drink: 3, perMenu: 3, sameCaption: 3, menuPlacement: 3, minScore: 52 };
}

function photoSelectionDecision(photo, menu, counts, settings) {
  if (photo.target === "exclude" || photo.role === "exclude") return { use: false, reason: "사용자가 원고에서 제외" };
  const manualTarget = photo.target && photo.target !== "auto";
  if (manualTarget) return { use: true };
  if (settings.includeAll) return { use: true };
  if (counts.total >= settings.maxTotal) return { use: false, reason: "사진 사용량 설정에 맞춰 제외" };
  if (photo.blogScore < settings.minScore) return { use: false, reason: "블로그 컷으로 약해서 제외" };

  const captionKey = normalizePreviewLine(photo.caption || photo.name || "");
  const sameCaptionCount = counts.captions.get(captionKey) || 0;
  if (captionKey && sameCaptionCount >= settings.sameCaption) {
    return { use: false, reason: "비슷한 설명의 사진이 많아서 일부 제외" };
  }

  if (menu && ["food", "drink", "menu"].includes(photo.role)) {
    const key = menu.name;
    return (counts.food.get(key) || 0) < settings.perMenu
      ? { use: true }
      : { use: false, reason: `${menu.name} 사진이 충분해서 일부 제외` };
  }
  if (photo.role === "drink") {
    return counts.drink < settings.drink ? { use: true } : { use: false, reason: "음료 사진 수를 줄이기 위해 제외" };
  }
  if (photo.role === "menu") {
    return counts.menuBoard < settings.menuBoard ? { use: true } : { use: false, reason: "메뉴판 사진 수를 줄이기 위해 제외" };
  }
  if (["thumbnail", "exterior", "interior", "body"].includes(photo.role)) {
    return counts.atmosphere < settings.atmosphere ? { use: true } : { use: false, reason: "분위기 사진 수를 줄이기 위해 제외" };
  }
  return { use: true };
}

function photoBlogScore(photo) {
  if (photo.role === "exclude") return -100;
  const analysis = photo.analysis || {};
  let score = typeof analysis.qualityScore === "number" ? analysis.qualityScore : 58;

  if (photo.role === "food" || analysis.visualRole === "food") score += 14;
  if (photo.role === "drink" || analysis.visualRole === "drink") score += 9;
  if (["thumbnail", "interior", "exterior", "body"].includes(photo.role) && analysis.visualRole !== "food") score += 8;
  if (photo.role === "menu") score += 4;
  if (analysis.visualMenu === "mixed") score += 4;
  if (analysis.visualMenuConfidence >= 0.86) score += 3;
  if (photo.userEdited) score += 8;
  if (analysis.darkRatio > 0.72) score -= 18;
  if (photo.width && photo.height && Math.min(photo.width, photo.height) < 450) score -= 10;

  return clamp(score, 0, 100);
}

function registerSelectedPhoto(photo, menu, counts) {
  counts.total += 1;
  const captionKey = normalizePreviewLine(photo.caption || photo.name || "");
  if (captionKey) counts.captions.set(captionKey, (counts.captions.get(captionKey) || 0) + 1);

  if (menu && ["food", "drink", "menu"].includes(photo.role)) {
    counts.food.set(menu.name, (counts.food.get(menu.name) || 0) + 1);
  } else if (photo.role === "drink") {
    counts.drink += 1;
  } else if (photo.role === "menu") {
    counts.menuBoard += 1;
  } else if (["thumbnail", "exterior", "interior", "body"].includes(photo.role)) {
    counts.atmosphere += 1;
  }
}

function photoPlacementNote(photo, input = getInput()) {
  const menu = matchedMenuForPhoto(photo, input);
  return photoNarrativeNote(photo.role, photo.caption, menu, input);
}

function photoNarrativeNote(role, caption, menu, input) {
  const place = shortPlace(input.place || input.topic || "이곳");
  const label = `${caption || ""} ${menu?.name || ""} ${menu?.local || ""}`.toLowerCase();

  if (/sate|satay|사테/.test(label)) {
    return "땅콩소스가 넉넉하게 올라간 사테. 고소한 맛이 먼저 느껴지고, 라임을 살짝 곁들이면 훨씬 깔끔하게 먹기 좋았어.";
  }

  if (/udang|우당|새우|shrimp/.test(label)) {
    return "우당 바카르는 양념이 잘 배어 있는 구운 새우라서 밥이랑 같이 먹기 좋았어. 삼발은 조금씩 곁들이는 쪽이 내 입맛에는 더 잘 맞았어.";
  }

  if (/jahe|자헤|madu|마두|생강|꿀/.test(label)) {
    return "자헤 마두는 생강 향이 먼저 올라오고 뒤에 꿀 단맛이 남는 따뜻한 음료였어. 양념 진한 음식을 먹고 나서 마무리하기 괜찮았어.";
  }

  if (role === "drink") {
    return "음식이랑 같이 마신 음료. 양념 있는 메뉴를 먹을 때 중간중간 마시기 괜찮았어.";
  }

  if (role === "food") {
    return "음식이 테이블에 놓이면 소스 색감이 먼저 눈에 들어와. 사진처럼 밥이랑 같이 먹기 좋은 메뉴라 여러 가지를 나눠 먹는 흐름이 괜찮았어.";
  }

  if (role === "menu") {
    return "메뉴 이름이 낯설 수 있지만 재료 단어를 조금 알면 고르기 훨씬 쉬워. 처음이라면 익숙한 구이 메뉴부터 보는 것도 괜찮아.";
  }

  if (role === "thumbnail" || role === "interior" || role === "exterior") {
    return `${place}는 조명이 따뜻하고 나무톤 분위기가 살아 있어서, 음식 나오기 전부터 기분이 좋아지는 쪽의 식당이야.`;
  }

  if (role === "map") {
    return "코타카사블랑카 몰 안에 있어서 그랩이나 택시로 이동하기 편했고, 약속 전후로 들르기에도 동선이 괜찮았어.";
  }

  return "이 장면은 글 흐름 중간에 넣으면 방문한 날의 분위기를 조금 더 실제처럼 보여줄 수 있어.";
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
  syncPreviewEditsIfNeeded({ silent: true });
  const lines = $("postEditor").value.split(/\r?\n/);
  lines[0] = title;
  $("postEditor").value = lines.join("\n");
  refreshReports();
}

function refreshFromEditor() {
  syncPreviewEditsIfNeeded({ silent: true });
  refreshReports();
  drawThumbnail();
}

function refreshReports() {
  const text = $("postEditor").value;
  const tags = parseCommaOrSpaceTags($("tagEditor").value || state.tags.join(" "));
  renderPostPreview(text, tags);
  renderCounts(text);
  renderKeywordReport(text, tags);
  renderAdReport(text);
  renderAiReport(text);
  renderChecklist(text, tags);
  renderPhotoPlanReport();
  renderAiSearchReport();
}

function renderPostPreview(text, tags = []) {
  const preview = $("postPreview");
  if (!preview) return;
  if (isPreviewEditing()) return;
  preview.classList.toggle("is-polished", Boolean(state.isPolished));
  const linesRaw = text.split(/\r?\n/);
  const blocks = [];
  let listOpen = false;
  let firstTextSeen = false;
  let highlightedInSection = false;

  const closeList = () => {
    if (listOpen) {
      blocks.push("</ul>");
      listOpen = false;
    }
  };

  for (let i = 0; i < linesRaw.length; i += 1) {
    const line = linesRaw[i].trim();
    if (!line) {
      closeList();
      continue;
    }
    const prevLine = (linesRaw[i - 1] || "").trim();
    if (prevLine && normalizePreviewLine(prevLine) === normalizePreviewLine(line)) {
      continue;
    }

    const photoMatch = line.match(/^\[사진\s+(\d+)(?::\s*(.+?))?\]$/);
    if (photoMatch) {
      closeList();
      const photoIndex = Number(photoMatch[1]) - 1;
      const photo = state.photos[photoIndex];
      const nextLine = (linesRaw[i + 1] || "").trim();
      const caption = photoMatch[2] || "";
      const note = lineBelongsToPhotoNote(nextLine, photoIndex + 1, line) ? nextLine : "";
      if (note) i += 1;
      blocks.push(renderPreviewPhoto(photo, caption, note, photoIndex + 1));
      continue;
    }

    if (line.startsWith("· ") || line.startsWith("- ")) {
      if (!listOpen) {
        blocks.push("<ul>");
        listOpen = true;
      }
      blocks.push(`<li>${formatPreviewInline(line.replace(/^[·-]\s*/, ""))}</li>`);
      continue;
    }

    closeList();

    if (!firstTextSeen) {
      blocks.push(`<h1>${formatPreviewInline(line)}</h1>`);
      firstTextSeen = true;
      continue;
    }

    if (isPreviewHeading(line)) {
      highlightedInSection = false;
      blocks.push(`<h2>${formatPreviewInline(line)}</h2>`);
    } else if (isPreviewSubheading(line)) {
      blocks.push(`<h3>${formatPreviewInline(line)}</h3>`);
    } else if (/^Q\./.test(line)) {
      blocks.push(`<h3>${formatPreviewInline(line)}</h3>`);
    } else if (/^https?:\/\//.test(line)) {
      blocks.push(`<p><a href="${escapeAttr(line)}" target="_blank" rel="noopener">${escapeHtml(line)}</a></p>`);
    } else if (line.startsWith("#")) {
      blocks.push(`<p class="preview-tags">${parseCommaOrSpaceTags(line).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</p>`);
    } else {
      const paragraphClass = previewParagraphClass(line, { highlightedInSection });
      if (paragraphClass.split(/\s+/).includes("is-important")) highlightedInSection = true;
      const paragraphBody = paragraphClass.split(/\s+/).includes("is-important")
        ? `<span class="preview-highlight">${formatPreviewInline(line)}</span>`
        : formatPreviewInline(line);
      blocks.push(`<p${paragraphClass ? ` class="${paragraphClass}"` : ""}>${paragraphBody}</p>`);
    }
  }

  closeList();
  preview.innerHTML = blocks.join("");
  preview.contentEditable = "false";
}

function previewParagraphClass(line, options = {}) {
  const text = String(line || "");
  const classes = [];
  if (!options.highlightedInSection && text.length <= 130 && /(이날 제일|운 좋게|대기 없이|다시 가도|한국인 입맛|실패하지|추천하고 싶은|기억에 남|제일 기억|제일 만족|한 번쯤 가볼 만|괜찮을 것 같)/.test(text)) {
    classes.push("is-important");
  }
  if (text.length < 34) classes.push("is-short-note");
  if (/(사테|Sate|우당|Udang|자헤|Jahe|메뉴|음식|맛|소스|양념|밥|주문|먹었|음료)/i.test(text)) {
    classes.push("tone-menu");
  } else if (/(분위기|내부|인테리어|조명|테이블|자리|따뜻|빈티지|예쁜)/i.test(text)) {
    classes.push("tone-atmosphere");
  } else if (/(위치|Kokas|코카스|Casa Residence|가까워|몰 안|입구|이동|찾기)/i.test(text)) {
    classes.push("tone-place");
  } else if (/(예약|대기|피크|주말|시간|기다|방문 팁|팁)/i.test(text)) {
    classes.push("tone-tip");
  }
  return unique(classes).join(" ");
}

function formatPreviewInline(text) {
  const pattern = /(Pesta Kebun Kota Kasablanka|Pesta Kebun Kokas|Pesta Kebun|Kota Kasablanka|Casa Residence|Kokas|코카스|코타카사블랑카|사테|Sate|우당 바카르|Udang Bakar|자헤 마두|Jahe Madu|대기 없이|다시 가도|좋았어|기억에 남(?:았어|는|은)?|한국인 입맛|무난한 편|예약|방문 팁|제일 만족|추천)/g;
  return String(text || "").split(pattern).map((part) => {
    if (!part) return "";
    if (isPreviewEmphasisToken(part)) {
      return `<strong class="preview-keyword">${escapeHtml(part)}</strong>`;
    }
    return escapeHtml(part);
  }).join("");
}

function isPreviewEmphasisToken(text) {
  return /^(Pesta Kebun Kota Kasablanka|Pesta Kebun Kokas|Pesta Kebun|Kota Kasablanka|Casa Residence|Kokas|코카스|코타카사블랑카|사테|Sate|우당 바카르|Udang Bakar|자헤 마두|Jahe Madu|대기 없이|다시 가도|좋았어|기억에 남(?:았어|는|은)?|한국인 입맛|무난한 편|예약|방문 팁|제일 만족|추천)$/.test(text);
}

function shouldUseLineAsPhotoNote(line) {
  if (!line) return false;
  if (/^\[사진\s+\d+:/i.test(line)) return false;
  if (/^(·|-)\s/.test(line)) return false;
  if (/^Q\./.test(line)) return false;
  if (/^https?:\/\//.test(line)) return false;
  if (line.startsWith("#")) return false;
  return !isPreviewHeading(line) && !isPreviewSubheading(line);
}

function lineBelongsToPhotoNote(line, photoNumber, markerLine = "") {
  if (!shouldUseLineAsPhotoNote(line)) return false;
  const photo = state.photos[photoNumber - 1];
  const input = getInput();
  const expected = photo ? photoNoteForPost({ ...photo, index: photoNumber }, input) : "";
  if (expected && normalizePreviewLine(line) === normalizePreviewLine(expected)) return true;
  const marker = markerLine.match(/^\[사진\s+\d+(?::\s*(.+?))?\]$/);
  return Boolean(marker?.[1]);
}

function normalizePreviewLine(line) {
  return String(line || "").replace(/\s+/g, " ").trim();
}

function renderPreviewPhoto(photo, caption, note, photoNumber = 0) {
  const className = previewPhotoClass(photo);
  const safeCaption = String(caption || "").trim();
  const safeNote = String(note || "").trim();
  const altText = safeCaption || `${getInput().place || getInput().topic || "블로그"} 사진`;
  const controls = photoNumber ? `
    <div class="photo-move-controls" aria-label="사진 위치와 삭제" contenteditable="false">
      <button type="button" data-photo-move="up" data-photo-number="${photoNumber}">위로</button>
      <button type="button" data-photo-move="down" data-photo-number="${photoNumber}">아래로</button>
      <button class="is-danger" type="button" data-photo-delete="true" data-photo-number="${photoNumber}">삭제</button>
    </div>
  ` : "";
  if (!photo?.dataUrl) {
    return `<figure class="${className} is-missing" data-photo-number="${photoNumber}">${controls}<div>${escapeHtml(safeCaption || "사진")}</div>${safeNote ? `<figcaption>${escapeHtml(safeNote)}</figcaption>` : ""}</figure>`;
  }
  const captionHtml = safeCaption || safeNote
    ? `
      <figcaption>
        ${safeCaption ? `<strong>${escapeHtml(safeCaption)}</strong>` : ""}
        ${safeNote ? `<span>${escapeHtml(safeNote)}</span>` : ""}
      </figcaption>
    `
    : "";
  return `
    <figure class="${className}" data-photo-number="${photoNumber}">
      ${controls}
      <img src="${photo.dataUrl}" alt="${escapeHtml(altText)}" contenteditable="false" draggable="false">
      ${captionHtml}
    </figure>
  `;
}

function handlePreviewPhotoMove(event) {
  const button = event.target.closest("[data-photo-move], [data-photo-delete]");
  if (!button) return;
  const photoNumber = Number(button.dataset.photoNumber);
  if (!photoNumber) return;
  syncPreviewEditsIfNeeded({ silent: true });
  if (button.dataset.photoDelete) {
    deletePhotoBlock(photoNumber);
    return;
  }
  const direction = button.dataset.photoMove;
  if (!direction) return;
  movePhotoBlock(photoNumber, direction);
}

function photoBlockStart(lines, photoNumber) {
  return lines.findIndex((line) => new RegExp(`^\\[사진\\s+${photoNumber}(?::.*)?\\]$`).test(line.trim()));
}

function movePhotoBlock(photoNumber, direction) {
  const editor = $("postEditor");
  const lines = editor.value.split(/\r?\n/);
  const start = photoBlockStart(lines, photoNumber);
  if (start < 0) return;
  const end = photoBlockEnd(lines, start);
  const photoBlock = lines.slice(start, end);

  if (direction === "up") {
    const prev = previousBlockBounds(lines, start);
    if (!prev) return;
    const nextLines = [
      ...lines.slice(0, prev.start),
      ...photoBlock,
      ...lines.slice(prev.end, start),
      ...lines.slice(prev.start, prev.end),
      ...lines.slice(end),
    ];
    editor.value = nextLines.join("\n");
  } else {
    const next = nextBlockBounds(lines, end);
    if (!next) return;
    const nextLines = [
      ...lines.slice(0, start),
      ...lines.slice(next.start, next.end),
      ...lines.slice(end, next.start),
      ...photoBlock,
      ...lines.slice(next.end),
    ];
    editor.value = nextLines.join("\n");
  }

  refreshReports();
}

function deletePhotoBlock(photoNumber) {
  const editor = $("postEditor");
  const lines = editor.value.split(/\r?\n/);
  const start = photoBlockStart(lines, photoNumber);
  if (start < 0) return;
  const end = photoBlockEnd(lines, start);
  editor.value = [
    ...lines.slice(0, start),
    ...lines.slice(end),
  ].join("\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  refreshReports();
  setAiStatus("사진과 바로 아래 사진 설명을 원고에서 삭제했어.");
}

function photoBlockEnd(lines, start) {
  const markerLine = (lines[start] || "").trim();
  const match = markerLine.match(/^\[사진\s+(\d+)(?::\s*(.+?))?\]$/);
  if (!match) return start + 1;
  const photoNumber = Number(match[1]);
  const nextLine = (lines[start + 1] || "").trim();
  return lineBelongsToPhotoNote(nextLine, photoNumber, markerLine) ? start + 2 : start + 1;
}

function previousBlockBounds(lines, start) {
  let index = start - 1;
  while (index >= 0 && !lines[index].trim()) index -= 1;
  if (index < 0) return null;
  return blockBoundsAt(lines, index);
}

function nextBlockBounds(lines, end) {
  let index = end;
  while (index < lines.length && !lines[index].trim()) index += 1;
  if (index >= lines.length) return null;
  return blockBoundsAt(lines, index);
}

function blockBoundsAt(lines, index) {
  const current = (lines[index] || "").trim();
  const currentMarker = current.match(/^\[사진\s+(\d+)(?::\s*(.+?))?\]$/);
  if (currentMarker) {
    return { start: index, end: photoBlockEnd(lines, index) };
  }

  const previous = (lines[index - 1] || "").trim();
  const previousMarker = previous.match(/^\[사진\s+(\d+)(?::\s*(.+?))?\]$/);
  if (previousMarker && lineBelongsToPhotoNote(current, Number(previousMarker[1]), previous)) {
    return { start: index - 1, end: index + 1 };
  }

  return { start: index, end: index + 1 };
}

function previewPhotoClass(photo) {
  const classes = ["preview-photo"];
  if (!photo?.dataUrl) classes.push("is-missing");
  const role = photo?.role || "body";
  const size = photo?.size || "auto";
  if (size !== "auto") {
    classes.push(`is-size-${size}`);
  } else if (["thumbnail", "exterior", "interior", "body"].includes(role)) {
    classes.push("is-wide");
  } else if (["drink", "menu", "map"].includes(role)) {
    classes.push("is-compact");
  } else {
    classes.push("is-medium");
  }
  if (photo?.width && photo?.height && photo.height > photo.width * 1.15) {
    classes.push("is-portrait");
  }
  return classes.join(" ");
}

function isPreviewHeading(line) {
  const text = String(line || "").trim();
  if (!text || text.length > 34) return false;
  if (/^\[사진|^#|^(Q\.|A\.)|^(·|-)\s/.test(text)) return false;
  if (/[.!?。]$/.test(text)) return false;
  return text.endsWith("는 이런 곳이야") || [
    "다시 가도 좋았던 이유",
    "방문한 날의 기록",
    "분위기와 위치",
    "분위기가 먼저 예쁜 곳",
    "방문해서 먹은 메뉴",
    "먹어본 메뉴",
    "예약과 방문 팁",
    "방문 전 자주 묻는 질문",
    "위치와 이동 팁",
    "마무리하면",
    "결론은,, 다시 갈 만한 곳",
  ].includes(text) || /(이유|기록|곳|메뉴|분위기|후기|팁|예약|위치|이동|FAQ|정리|결론|맛|추천|방문|마무리)/.test(text);
}

function isPreviewSubheading(line) {
  return getInput().menus.some((menu) => line === `${menu.name}${menu.local ? `(${menu.local})` : ""}`);
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
  const { selected, skipped } = selectedPhotoPlan(input);
  $("photoPlanReport").innerHTML = selected.length
    ? [
      `<p class="metric-row status-good">원고에 넣을 사진 ${selected.length}장${skipped.length ? `, 제외된 사진 ${skipped.length}장` : ""}</p>`,
      `<p class="metric-row">사진은 기본적으로 설명 없이 배치해요. 직접 쓴 사진 메모가 있을 때만 캡션/문장을 반영해요.</p>`,
      `<ul class="report-list">${selected.map((photo) => `<li>사용: 사진 ${photo.index} / ${escapeHtml(photoRoleLabel(photo.role))}<br>${escapeHtml(manualPhotoNote(photo) || "자동 설명 없음")}</li>`).join("")}</ul>`,
      skipped.length ? `<ul class="report-list">${skipped.map((photo) => `<li>제외: 사진 ${photo.index}<br>${escapeHtml(photo.skipReason)}</li>`).join("")}</ul>` : "",
    ].join("")
    : `<p class="metric-row">사진을 올리면 자동 배치 계획이 생겨요.</p>`;
}

function renderAiSearchReport() {
  const target = $("aiSearchReport");
  if (!target) return;
  target.innerHTML = renderStoredAiSearchReport() || `<p class="metric-row">AI 검색 검수를 실행하면 최신 정보 확인 결과와 반영 내용이 여기에 남아요.</p>`;
}

function renderStoredAiSearchReport() {
  const report = state.aiSearchReport || [];
  const sources = state.aiSearchSources || [];
  const reportHtml = report.length
    ? `<ul class="report-list">${report.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : "";
  const sourceHtml = sources.length
    ? `<div class="source-list"><strong>확인한 출처</strong>${sources.map((source) => `<a href="${escapeAttr(source.url)}" target="_blank" rel="noopener">${escapeHtml(source.title || source.url)}</a>`).join("")}</div>`
    : "";
  return `${reportHtml}${sourceHtml}`;
}

function dietTagsFromEditor() {
  syncPreviewEditsIfNeeded({ silent: true });
  const input = getInput();
  const next = dietTags(makeTags(input), 18);
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
  syncPreviewEditsIfNeeded({ silent: true });
  let text = $("postEditor").value;
  aiSmells.forEach(([bad, good]) => {
    text = text.split(bad).join(good);
  });
  $("postEditor").value = text.replace(/[ \t]+\n/g, "\n").replace(/\n{4,}/g, "\n\n\n");
  refreshReports();
}

async function polishPostLayout() {
  syncPreviewEditsIfNeeded({ silent: true });
  const button = $("polishPostBtn");
  if (button) {
    button.disabled = true;
    button.classList.add("is-busy");
    button.textContent = "꾸미는 중";
  }
  setAiStatus("글 꾸미기 중입니다. 제목, 소제목, 강조 문장과 행간을 정리하고 있어요.");
  await delay(700);

  $("postEditor").value = buildPolishedPostText($("postEditor").value || "");
  state.isPolished = true;
  refreshReports();
  disableDirectPreviewEdit();
  if (button) {
    button.disabled = false;
    button.classList.remove("is-busy");
    button.textContent = "글 꾸미기";
  }
  setAiStatus("글 꾸미기 완료. 빠진 소제목을 보강하고, 강조색, 굵기, 글자 크기, 행간을 정리했어.");
}

function buildPolishedPostText(rawText) {
  let text = String(rawText || "");
  text = text
    .replace(/```(?:markdown|html|text)?/gi, "")
    .replace(/```/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const polished = [];

  lines.forEach((line, index) => {
    if (!line) {
      pushBlank(polished);
      return;
    }

    const previous = polished[polished.length - 1] || "";
    const isPhoto = /^\[사진\s+\d+(?::.*)?\]$/.test(line);
    const isFaq = /^(Q\.|A\.)/.test(line);
    const isTagLine = line.startsWith("#");
    const isBullet = /^(·|-)\s/.test(line);
    const isLikelyHeading = isPolishHeading(line, index);

    if (isPhoto || isFaq || isTagLine || isLikelyHeading) {
      pushBlank(polished);
      polished.push(line);
      if (isLikelyHeading || isTagLine) pushBlank(polished);
      return;
    }

    if (isBullet) {
      if (previous && !/^(·|-)\s/.test(previous)) pushBlank(polished);
      polished.push(line.replace(/^-\s/, "· "));
      return;
    }

    polished.push(line);
  });

  return ensureReadableSectionHeadings(polished).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function ensureReadableSectionHeadings(lines) {
  const cleanLines = lines.map((line) => String(line || "").trim());
  const contentLines = cleanLines.filter(Boolean);
  if (contentLines.length <= 4) return cleanLines;

  const existingHeadingCount = contentLines.slice(1).filter((line, index) => isPolishHeading(line, index + 1)).length;
  const shouldAddMoreHeadings = existingHeadingCount < 4;
  const output = [];
  let firstLineHandled = false;
  let activeHeading = "";
  const usedHeadings = new Set();

  cleanLines.forEach((line, index) => {
    if (!line) {
      pushBlank(output);
      return;
    }

    if (!firstLineHandled) {
      output.push(line);
      pushBlank(output);
      firstLineHandled = true;
      return;
    }

    if (/^(·|-)\s/.test(line) && shouldAddMoreHeadings && !activeHeading) {
      activeHeading = "다시 가도 좋았던 이유";
      usedHeadings.add(activeHeading);
      pushBlank(output);
      output.push(activeHeading);
      pushBlank(output);
    }

    if (isPostStructureLine(line, index)) {
      if (isPolishHeading(line, index)) {
        activeHeading = line;
        usedHeadings.add(line);
      }
      pushBlank(output);
      output.push(line);
      if (isPolishHeading(line, index) || line.startsWith("#")) pushBlank(output);
      return;
    }

    if (shouldAddMoreHeadings) {
      const nextHeading = suggestSectionHeading(line, activeHeading, output);
      if (nextHeading && nextHeading !== activeHeading && !usedHeadings.has(nextHeading)) {
        pushBlank(output);
        output.push(nextHeading);
        pushBlank(output);
        activeHeading = nextHeading;
        usedHeadings.add(nextHeading);
      }
    }

    output.push(line);
  });

  return output;
}

function isPostStructureLine(line, index) {
  return /^\[사진\s+\d+(?::.*)?\]$/.test(line)
    || /^#/.test(line)
    || /^(Q\.|A\.)/.test(line)
    || /^(·|-)\s/.test(line)
    || isPolishHeading(line, index);
}

function suggestSectionHeading(line, activeHeading, output) {
  const text = String(line || "");
  if (!text || /^\[사진\s+\d+/.test(text) || /^#/.test(text) || /^(Q\.|A\.)/.test(text)) return "";
  if (/^(·|-)\s/.test(text)) return activeHeading || "다시 가도 좋았던 이유";

  const lastUseful = [...output].reverse().find(Boolean) || "";
  if (isPolishHeading(lastUseful, 1)) return "";

  if (/(사테|Sate|우당|Udang|자헤|Jahe|메뉴|음식|맛|소스|양념|밥|주문|먹었|먹은|마셨|음료)/i.test(text)) {
    return "먹어본 메뉴";
  }
  if (/(분위기|내부|인테리어|조명|테이블|자리|따뜻|빈티지|예쁜|몰 안|Kokas|코카스|Casa Residence|가까워|위치|입구|이동|찾기)/i.test(text)) {
    return "분위기와 위치";
  }
  if (/(예약|대기|피크|주말|시간|기다|방문 팁|팁|가고 싶다고 바로|사람이 많|자리)/i.test(text)) {
    return "예약과 방문 팁";
  }
  if (/(결론|마무리|다시 갈|다시 가도|추천|괜찮|갈 만|실패하지|데려가)/i.test(text)) {
    return "마무리하면";
  }
  if (/(20\d{2}|방문|퇴근|저녁|점심|이날|들렀|앉았|먹고 들어가|운 좋게|기록)/i.test(text)) {
    return "방문한 날의 기록";
  }
  if (!activeHeading) return "방문한 날의 기록";
  return "";
}

function pushBlank(lines) {
  if (lines.length && lines[lines.length - 1] !== "") lines.push("");
}

function isPolishHeading(line, index) {
  if (!line || line.length > 34) return false;
  if (/^\[사진|^#|^(Q\.|A\.)|^(·|-)\s/.test(line)) return false;
  if (index === 0) return true;
  if (/[.!?。]$/.test(line)) return false;
  return /(이유|기록|곳|메뉴|분위기|후기|팁|예약|위치|이동|FAQ|정리|결론|맛|추천|방문|마무리)/.test(line);
}

function setEditorVisible(visible) {
  const shell = $("editorShell");
  const button = $("toggleEditorBtn");
  if (!shell || !button) return;
  shell.classList.toggle("is-hidden", !visible);
  shell.classList.toggle("is-visible", visible);
  button.textContent = visible ? "수정창 숨기기" : "바로 수정";
  if (visible) $("postEditor").focus();
}

function isPreviewEditing() {
  return $("postPreview")?.dataset.editing === "true";
}

function toggleDirectPreviewEdit() {
  if (isPreviewEditing()) {
    savePreviewEdits();
  } else {
    enableDirectPreviewEdit();
  }
}

function enableDirectPreviewEdit() {
  const preview = $("postPreview");
  if (!preview) return;
  setEditorVisible(false);
  preview.contentEditable = "true";
  preview.dataset.editing = "true";
  preview.dataset.dirty = "false";
  preview.classList.add("is-editing");

  const editButton = $("toggleEditorBtn");
  if (editButton) {
    editButton.textContent = "수정 중";
    editButton.classList.add("is-active");
  }

  const saveButton = $("savePreviewEditBtn");
  if (saveButton) {
    saveButton.disabled = false;
    saveButton.textContent = "수정 저장";
  }

  preview.focus();
  setAiStatus("본문을 바로 클릭해서 고친 뒤, 수정 저장을 눌러줘.");
}

function disableDirectPreviewEdit() {
  const preview = $("postPreview");
  if (!preview) return;
  preview.contentEditable = "false";
  preview.dataset.editing = "false";
  preview.dataset.dirty = "false";
  preview.classList.remove("is-editing");

  const editButton = $("toggleEditorBtn");
  if (editButton) {
    editButton.textContent = "바로 수정";
    editButton.classList.remove("is-active");
  }

  const saveButton = $("savePreviewEditBtn");
  if (saveButton) {
    saveButton.disabled = true;
    saveButton.textContent = "수정 저장";
  }
}

function markPreviewDirty() {
  if (!isPreviewEditing()) return;
  const preview = $("postPreview");
  preview.dataset.dirty = "true";
  const saveButton = $("savePreviewEditBtn");
  if (saveButton) {
    saveButton.disabled = false;
    saveButton.textContent = "수정 저장 *";
  }
}

function syncPreviewEditsIfNeeded(options = {}) {
  if (isPreviewEditing()) savePreviewEdits(options);
}

function savePreviewEdits(options = {}) {
  const preview = $("postPreview");
  if (!preview) return;
  const text = previewToPostText(preview);
  $("postEditor").value = text.trim();
  disableDirectPreviewEdit();
  refreshReports();
  if (!options.silent) setAiStatus("화면에서 직접 고친 내용을 원고에 저장했어.");
}

function previewToPostText(preview) {
  const lines = [];
  Array.from(preview.childNodes).forEach((node) => appendPreviewNodeText(node, lines));
  return lines.join("\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function appendPreviewNodeText(node, lines) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = cleanPreviewText(node.textContent);
    if (text) lines.push(text);
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const element = node;
  if (element.classList?.contains("photo-move-controls") || element.closest?.(".photo-move-controls")) return;

  const tag = element.tagName;
  if (tag === "FIGURE") {
    appendFigureText(element, lines);
    return;
  }

  if (tag === "H1" || tag === "H2" || tag === "H3") {
    const text = cleanPreviewText(element.textContent);
    if (text) {
      pushBlank(lines);
      lines.push(text);
      pushBlank(lines);
    }
    return;
  }

  if (tag === "P") {
    if (element.classList.contains("preview-tags")) {
      const tags = Array.from(element.querySelectorAll("span")).map((span) => cleanPreviewText(span.textContent)).filter(Boolean);
      if (tags.length) {
        pushBlank(lines);
        lines.push(tags.join(" "));
      }
      return;
    }
    const text = cleanPreviewText(element.textContent);
    if (text) lines.push(text);
    return;
  }

  if (tag === "UL" || tag === "OL") {
    pushBlank(lines);
    Array.from(element.children).forEach((item) => {
      if (item.tagName !== "LI") return;
      const text = cleanPreviewText(item.textContent).replace(/^[·-]\s*/, "");
      if (text) lines.push(`· ${text}`);
    });
    pushBlank(lines);
    return;
  }

  if (tag === "BR") {
    pushBlank(lines);
    return;
  }

  if (element.childNodes.length) {
    Array.from(element.childNodes).forEach((child) => appendPreviewNodeText(child, lines));
    return;
  }

  const text = cleanPreviewText(element.textContent);
  if (text) lines.push(text);
}

function appendFigureText(figure, lines) {
  const photoNumber = Number(figure.dataset.photoNumber || figure.querySelector("[data-photo-number]")?.dataset.photoNumber || 0);
  const caption = cleanPreviewText(figure.querySelector("figcaption strong")?.textContent || figure.querySelector("img")?.alt || "");
  const note = cleanPreviewText(figure.querySelector("figcaption span")?.textContent || "");

  pushBlank(lines);
  if (photoNumber) {
    lines.push(`[사진 ${photoNumber}${caption ? `: ${caption}` : ""}]`);
  } else if (caption) {
    lines.push(caption);
  }
  if (note) lines.push(note);
  pushBlank(lines);
}

function cleanPreviewText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/위로\s*아래로\s*삭제/g, "")
    .replace(/위로\s*아래로/g, "")
    .trim();
}

function insertSnippet(type) {
  syncPreviewEditsIfNeeded({ silent: true });
  const editor = $("postEditor");
  const snippets = {
    h2: "\n\n새 단락 제목\n",
    h3: "\n\n메뉴명\n이 메뉴는 내 기준으로...\n",
    photo: "\n\n[사진 1]\n",
    faq: "\n\nQ. 궁금한 점?\nA. 내 기준으로는...\n",
  };
  const snippet = snippets[type] || "";
  editor.value = `${editor.value.trimEnd()}${snippet}`;
  refreshReports();
  setAiStatus("필요한 블록을 원고 끝에 넣었어. 위치와 문장은 바로 수정에서 다듬으면 돼.");
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
  localStorage.setItem("naverBlogLatestVoice", value);
  renderVoicePresets();
}

function loadVoiceSettings() {
  const latest = localStorage.getItem("naverBlogLatestVoice") || state.voicePresets[0] || "";
  if (latest && $("voiceInput")) $("voiceInput").value = latest;
}

function saveActiveVoice() {
  const value = $("voiceInput").value.trim();
  if (value) localStorage.setItem("naverBlogLatestVoice", value);
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
      saveActiveVoice();
    });
  });
}

function drawThumbnail() {
  const canvas = $("thumbnailCanvas");
  const ctx = canvas.getContext("2d");
  const input = getInput();
  const accent = $("accentInput").value || "#d86b79";
  const renderId = state.thumbnailRenderId + 1;
  state.thumbnailRenderId = renderId;

  if (state.aiThumbnailDataUrl) {
    loadCanvasImage(state.aiThumbnailDataUrl)
      .then((img) => {
        if (state.thumbnailRenderId !== renderId) return;
        drawGeneratedThumbnailScene(ctx, canvas, img);
        drawThumbnailOverlay(ctx, canvas, input, accent);
      })
      .catch(() => {
        if (state.thumbnailRenderId !== renderId) return;
        state.aiThumbnailDataUrl = "";
        drawFallbackBackground(ctx, canvas);
        drawThumbnailOverlay(ctx, canvas, input, accent);
        setThumbnailAiStatus("AI 썸네일 사진을 읽지 못해서 업로드 사진 조합으로 돌아갔어.", true);
      });
    return;
  }

  const scenePhotos = thumbnailScenePhotos();

  if (!scenePhotos.length) {
    drawFallbackBackground(ctx, canvas);
    drawThumbnailOverlay(ctx, canvas, input, accent);
    return;
  }

  Promise.all(scenePhotos.map((photo) => loadCanvasImage(photo.dataUrl).then((img) => ({ photo, img })).catch(() => null)))
    .then((loadedItems) => {
      if (state.thumbnailRenderId !== renderId) return;
      const loaded = loadedItems.filter(Boolean);
      if (!loaded.length) {
        drawFallbackBackground(ctx, canvas);
      } else {
        drawThumbnailPhotoScene(ctx, canvas, loaded);
      }
      drawThumbnailOverlay(ctx, canvas, input, accent);
  });
}

function drawGeneratedThumbnailScene(ctx, canvas, img) {
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.filter = "saturate(1.1) contrast(1.03) brightness(1.06)";
  coverImageIn(ctx, img, 0, 0, w, h);
  ctx.restore();

  const warmth = ctx.createLinearGradient(0, 0, 0, h);
  warmth.addColorStop(0, "rgba(255,232,188,0.03)");
  warmth.addColorStop(0.62, "rgba(255,200,118,0.04)");
  warmth.addColorStop(1, "rgba(52,28,14,0.08)");
  ctx.fillStyle = warmth;
  ctx.fillRect(0, 0, w, h);
}

function coverImage(ctx, img, width, height) {
  coverImageIn(ctx, img, 0, 0, width, height);
}

function coverImageIn(ctx, img, x, y, width, height) {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const ratio = Math.max(width / img.width, height / img.height);
  const drawWidth = img.width * ratio;
  const drawHeight = img.height * ratio;
  ctx.drawImage(img, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function loadCanvasImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function thumbnailScenePhotos() {
  const photos = state.photos.filter((photo) => photo.dataUrl);
  if (!photos.length) return [];
  const background = photos.find((photo) => ["thumbnail", "interior", "exterior", "body"].includes(photo.role) && photo.analysis?.visualRole !== "food")
    || photos.find((photo) => photo.role === "thumbnail")
    || photos[0];
  const foodPhotos = photos
    .filter((photo) => photo.id !== background.id)
    .filter((photo) => ["food", "drink", "menu"].includes(photo.role) || photo.analysis?.visualRole === "food" || Boolean(photo.analysis?.visualMenu))
    .slice(0, 2);
  const backupFood = photos.filter((photo) => photo.id !== background.id && !foodPhotos.some((item) => item.id === photo.id)).slice(0, Math.max(0, 2 - foodPhotos.length));
  return uniqueById([background, ...foodPhotos, ...backupFood]).slice(0, 3);
}

function uniqueById(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item?.id || item?.name;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function drawThumbnailPhotoScene(ctx, canvas, loaded) {
  const w = canvas.width;
  const h = canvas.height;
  const background = loaded[0]?.img;
  ctx.clearRect(0, 0, w, h);
  if (background) {
    ctx.save();
    ctx.filter = "blur(4px) saturate(1.12) brightness(0.92)";
    coverImageIn(ctx, background, -22, -22, w + 44, h + 44);
    ctx.restore();
  } else {
    drawFallbackBackground(ctx, canvas);
  }

  const warm = ctx.createLinearGradient(0, 0, 0, h);
  warm.addColorStop(0, "rgba(255,226,175,0.03)");
  warm.addColorStop(0.48, "rgba(120,70,28,0.08)");
  warm.addColorStop(1, "rgba(45,25,13,0.2)");
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, w, h);
  drawThumbnailTable(ctx, w, h);

  const foodImages = loaded.slice(1).map((item) => item.img);
  if (foodImages[1]) drawThumbnailFoodPhoto(ctx, foodImages[1], 870, 278, 340, 238, 26, -0.02);
  if (foodImages[0]) {
    drawThumbnailFoodPhoto(ctx, foodImages[0], 388, 410, 690, 276, 30, 0.01);
  } else if (background) {
    drawThumbnailFoodPhoto(ctx, background, 428, 414, 640, 268, 30, 0.01);
  }
}

function drawThumbnailTable(ctx, w, h) {
  const table = ctx.createLinearGradient(0, h * 0.58, 0, h);
  table.addColorStop(0, "rgba(128,76,38,0.34)");
  table.addColorStop(1, "rgba(75,40,20,0.82)");
  ctx.fillStyle = table;
  ctx.fillRect(0, h * 0.58, w, h * 0.42);
  ctx.fillStyle = "rgba(255,226,170,0.15)";
  ctx.fillRect(0, h * 0.59, w, 3);
}

function drawThumbnailFoodPhoto(ctx, img, x, y, width, height, radius, rotation = 0) {
  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate(rotation);
  ctx.shadowColor = "rgba(0,0,0,0.42)";
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 16;
  roundRect(ctx, -width / 2, -height / 2, width, height, radius, "rgba(255,246,226,0.88)", true);
  ctx.shadowColor = "transparent";
  roundedRectPath(ctx, -width / 2 + 10, -height / 2 + 10, width - 20, height - 20, Math.max(10, radius - 8));
  ctx.clip();
  coverImageIn(ctx, img, -width / 2 + 10, -height / 2 + 10, width - 20, height - 20);
  ctx.restore();
}

function roundedRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
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
  ctx.fillStyle = "rgba(0, 0, 0, 0.06)";
  ctx.fillRect(0, 0, w, h);

  const leftFade = ctx.createLinearGradient(0, 0, w * 0.72, 0);
  leftFade.addColorStop(0, "rgba(0,0,0,0.28)");
  leftFade.addColorStop(0.5, "rgba(0,0,0,0.08)");
  leftFade.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = leftFade;
  ctx.fillRect(0, 0, w, h);

  const bottomFade = ctx.createLinearGradient(0, h * 0.48, 0, h);
  bottomFade.addColorStop(0, "rgba(0,0,0,0)");
  bottomFade.addColorStop(1, "rgba(0,0,0,0.18)");
  ctx.fillStyle = bottomFade;
  ctx.fillRect(0, 0, w, h);

  const radial = ctx.createRadialGradient(w * 0.66, h * 0.5, 110, w * 0.66, h * 0.5, 760);
  radial.addColorStop(0, "rgba(0,0,0,0)");
  radial.addColorStop(1, "rgba(0,0,0,0.08)");
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, w, h);

  drawBrandPill(ctx, input.brand || "Ara Cinta Indonesia");
  const [top, bottom] = splitTitle(input.thumbTitle || shortPlace(input.place || input.topic));
  drawShadowText(ctx, top, 56, 154, "76px Georgia", "#fff8ef", "#111");
  if (bottom) {
    drawShadowText(ctx, bottom, 56, 300, "138px Georgia", accent, "#111");
  }
  drawRibbon(ctx, input.thumbRibbon || "내 기준 솔직 후기", accent, bottom ? 482 : 354);
}

function drawThumbnailSubtitle(ctx, text, rightX, y, accent) {
  ctx.save();
  let fontSize = 35;
  ctx.font = `900 italic ${fontSize}px Arial`;
  while (ctx.measureText(text).width > 560 && fontSize > 25) {
    fontSize -= 2;
    ctx.font = `900 italic ${fontSize}px Arial`;
  }
  const textWidth = ctx.measureText(text).width;
  const x = rightX - textWidth;
  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(0,0,0,0.72)";
  ctx.fillStyle = "#fff8ef";
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x + 6, y + 14);
  ctx.lineTo(x + textWidth - 4, y + 10);
  ctx.stroke();
  ctx.restore();
}

function drawThumbnailSpeech(ctx, text, x, y) {
  ctx.save();
  ctx.font = "900 24px Arial";
  const width = Math.max(92, ctx.measureText(text).width + 34);
  roundRect(ctx, x, y - 38, width, 42, 20, "rgba(255,255,255,0.92)", true);
  ctx.fillStyle = "#25332c";
  ctx.fillText(text, x + 17, y - 10);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.beginPath();
  ctx.moveTo(x + 22, y - 3);
  ctx.lineTo(x + 37, y + 17);
  ctx.lineTo(x + 52, y - 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawMainThumbnailTitle(ctx, title, x, baseline, maxWidth, accent) {
  const lines = thumbnailTitleLines(title);
  const hasTwoLines = lines.length > 1;
  if (hasTwoLines) {
    drawImpactText(ctx, lines[0], x, baseline - 126, maxWidth, 78, "#fffdf5");
    drawImpactText(ctx, lines[1], x, baseline, maxWidth, 158, "#fffdf5");
  } else {
    drawImpactText(ctx, lines[0], x, baseline, maxWidth, 166, "#fffdf5");
  }
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x + 6, baseline + 18);
  ctx.lineTo(Math.min(x + maxWidth * 0.7, x + 690), baseline + 11);
  ctx.stroke();
  ctx.restore();
}

function drawImpactText(ctx, text, x, baseline, maxWidth, startSize, color) {
  ctx.save();
  let fontSize = startSize;
  ctx.font = `900 italic ${fontSize}px Arial Black, Arial, sans-serif`;
  while (ctx.measureText(text).width > maxWidth && fontSize > 52) {
    fontSize -= 4;
    ctx.font = `900 italic ${fontSize}px Arial Black, Arial, sans-serif`;
  }
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(8, Math.round(fontSize * 0.085));
  ctx.strokeStyle = "rgba(0,0,0,0.88)";
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.fillText(text, x + 8, baseline + 9);
  ctx.strokeText(text, x, baseline);
  ctx.fillStyle = color;
  ctx.fillText(text, x, baseline);
  ctx.restore();
}

function thumbnailTitleLines(title) {
  const clean = String(title || "").replace(/\s+/g, " ").trim();
  if (!clean) return ["맛집 후기"];
  const words = clean.split(" ");
  if (words.length === 1) return [clean];
  if (words.length === 2) return words;
  return [words.slice(0, -1).join(" "), words.at(-1)];
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
  state.aiThumbnailDataUrl = "";
  state.thumbnailCandidates = [];
  state.selectedThumbnailCandidate = -1;
  renderThumbnailCandidates();
  renderPhotos();
  generateAll();
}

function copyText(text) {
  navigator.clipboard.writeText(text);
}

async function copyStyledPost() {
  const { html, plain } = buildPostExportHtml();
  try {
    const copiedRich = await copyRichHtml(html, plain);
    setAiStatus(copiedRich
      ? "꾸민 원고를 복사했어. 네이버 블로그 글쓰기 화면에 붙여넣어 봐."
      : "브라우저가 꾸민 복사를 지원하지 않아서 일반 원고로 복사했어.");
  } catch (error) {
    await navigator.clipboard.writeText(plain);
    setAiStatus("브라우저가 꾸민 복사를 막아서 일반 원고로 복사했어.", true);
  }
}

async function exportToGoogleDocs() {
  const button = $("exportGoogleDocsBtn");
  const originalLabel = button?.textContent || "구글문서+리포트";
  if (button) {
    button.disabled = true;
    button.classList.add("is-busy");
    button.textContent = "복사 중";
  }
  const { html, plain, title } = buildPostExportHtml({ includeReport: true });
  const docsUrl = `https://docs.google.com/document/create?title=${encodeURIComponent(title)}`;
  try {
    setAiStatus(`구글문서용으로 사진 포함 원고와 리포트를 먼저 복사하는 중이야. 문서 제목은 "${title}"로 열게.`);
    const copiedRich = await copyRichHtml(html, plain);
    if (!copiedRich) {
      downloadGoogleDocsHtml(html, title);
      if (button) button.textContent = "복사 완료";
      const docsWindow = window.open(docsUrl, "_blank", "noopener");
      setAiStatus(`사진 포함 복사는 브라우저가 지원하지 않아서 "${safeFilename(title)}.html" 파일도 저장했어. 대신 원고와 리포트 일반 텍스트는 복사됐어. ${googleDocsOpenGuide(docsWindow)}`, true);
      return;
    }
    if (button) button.textContent = "복사 완료";
    const docsWindow = window.open(docsUrl, "_blank", "noopener");
    setAiStatus(`구글문서용 복사 완료. 원고 뒤에 작성 리포트까지 같이 들어가 있어. ${googleDocsOpenGuide(docsWindow)} Google Docs에는 보안상 본문 자동 붙여넣기는 안 돼.`);
  } catch (error) {
    const plainCopied = await copyPlainTextFallback(plain);
    downloadGoogleDocsHtml(html, title);
    const docsWindow = plainCopied ? window.open(docsUrl, "_blank", "noopener") : null;
    setAiStatus(plainCopied
      ? `사진 포함 복사는 막혔지만 원고와 리포트 일반 텍스트는 복사됐어. "${safeFilename(title)}.html" 파일도 같이 저장했어. ${googleDocsOpenGuide(docsWindow)}`
      : `브라우저가 클립보드 복사를 막아서 원고와 리포트를 "${safeFilename(title)}.html" 파일로 저장했어. Google Drive에 올린 뒤 Docs로 열어봐.`, true);
  } finally {
    if (button) {
      button.disabled = false;
      button.classList.remove("is-busy");
      setTimeout(() => {
        button.textContent = originalLabel;
      }, 900);
    }
  }
}

function googleDocsOpenGuide(docsWindow) {
  return docsWindow
    ? "새로 열린 Google Docs 문서 제목은 블로그 제목으로 들어가고, 본문은 Ctrl+V로 붙여넣어줘."
    : "팝업이 막혔으면 구글문서+리포트를 한 번 더 누르거나 Google Docs에서 새 문서를 열고 Ctrl+V를 눌러줘.";
}

function buildPostExportHtml(options = {}) {
  syncPreviewEditsIfNeeded({ silent: true });
  refreshReports();
  const preview = $("postPreview");
  const cleanPreview = preview.cloneNode(true);
  cleanPreview.querySelectorAll(".photo-move-controls").forEach((element) => element.remove());
  cleanPreview.querySelectorAll("[contenteditable]").forEach((element) => element.removeAttribute("contenteditable"));
  cleanPreview.removeAttribute("contenteditable");
  cleanPreview.classList.remove("is-editing");
  applyInlinePostStyles(cleanPreview);
  const reportExport = options.includeReport ? buildReportExportHtml() : { html: "", plain: "" };
  const html = `
    <article style="font-family: Arial, 'Malgun Gothic', sans-serif; color: #292f2b; font-size: 16.5px; line-height: 1.84;">
      ${cleanPreview.innerHTML}
    </article>
    ${reportExport.html}
  `;
  const postPlain = $("postEditor").value;
  const plain = [postPlain, reportExport.plain].filter(Boolean).join("\n\n");
  const title = postTitleForExport(postPlain);
  return { html, plain, title };
}

function buildReportExportHtml() {
  const tags = ($("tagEditor")?.value || state.tags.join(" ")).trim();
  const blocks = [
    ["글자수", $("countReport")?.innerHTML || ""],
    ["예상 유입 키워드", $("keywordReport")?.innerHTML || ""],
    ["예상 광고", $("adReport")?.innerHTML || ""],
    ["태그", `<p>${escapeHtml(tags || "태그 없음")}</p>`],
    ["AI 느낌 검사", $("aiReport")?.innerHTML || ""],
    ["업로드 체크리스트", $("checklistReport")?.innerHTML || ""],
    ["사진 배치", $("photoPlanReport")?.innerHTML || ""],
    ["AI 검색 검수", $("aiSearchReport")?.innerHTML || ""],
  ];
  const blockHtml = blocks.map(([title, body]) => reportBlockExportHtml(title, body)).join("");
  const html = `
    <section style="margin:54px 0 0;padding:34px 0 0;border-top:2px solid #d8cfae;font-family:Arial, 'Malgun Gothic', sans-serif;color:#24332c;">
      <h1 style="margin:0 0 10px;color:#173f36;font-size:26px;line-height:1.38;font-weight:800;letter-spacing:0;">작성 리포트</h1>
      <p style="margin:0 0 24px;color:#667066;font-size:14.5px;line-height:1.75;">원고 검수용 리포트야. 네이버에 올릴 때는 위 원고를 사용하고, 아래 내용은 키워드·광고·태그·체크리스트 확인용으로 보면 돼.</p>
      ${blockHtml}
    </section>
  `;
  return {
    html,
    plain: htmlToPlainText(html),
  };
}

function reportBlockExportHtml(title, bodyHtml) {
  return `
    <section style="margin:0 0 22px;padding:18px 18px 16px;border:1px solid #e5dfcf;border-radius:8px;background:#fffefb;">
      <h2 style="margin:0 0 12px;color:#173f36;font-size:18px;line-height:1.4;font-weight:800;letter-spacing:0;">${escapeHtml(title)}</h2>
      <div style="font-size:14.5px;line-height:1.72;color:#28342e;">
        ${inlineReportContentStyles(bodyHtml)}
      </div>
    </section>
  `;
}

function inlineReportContentStyles(html) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = String(html || "").trim() || "<p>내용 없음</p>";
  wrapper.querySelectorAll("ul").forEach((element) => {
    element.setAttribute("style", "margin:0;padding-left:20px;color:#28342e;font-size:14.5px;line-height:1.72;");
  });
  wrapper.querySelectorAll("li").forEach((element) => {
    element.setAttribute("style", "margin:0 0 7px;line-height:1.72;");
  });
  wrapper.querySelectorAll("p, .metric-row, .check-row").forEach((element) => {
    element.setAttribute("style", "margin:0 0 7px;color:#28342e;font-size:14.5px;line-height:1.72;");
  });
  wrapper.querySelectorAll("strong").forEach((element) => {
    element.setAttribute("style", "color:#173f36;font-weight:800;");
  });
  wrapper.querySelectorAll(".status-good").forEach((element) => {
    element.setAttribute("style", "color:#1d624d;font-weight:700;");
  });
  wrapper.querySelectorAll(".status-warn").forEach((element) => {
    element.setAttribute("style", "color:#8a5b16;font-weight:700;");
  });
  wrapper.querySelectorAll(".status-bad").forEach((element) => {
    element.setAttribute("style", "color:#9b2e2e;font-weight:700;");
  });
  wrapper.querySelectorAll(".source-list").forEach((element) => {
    element.setAttribute("style", "margin-top:10px;color:#28342e;font-size:14px;line-height:1.7;");
  });
  wrapper.querySelectorAll("a").forEach((element) => {
    element.setAttribute("style", "display:block;color:#1a5c87;text-decoration:underline;");
  });
  return wrapper.innerHTML;
}

function htmlToPlainText(html) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = String(html || "");
  return (wrapper.innerText || wrapper.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
}

async function copyRichHtml(html, plain) {
  if (!navigator.clipboard) throw new Error("Clipboard unavailable");
  if (!window.ClipboardItem || !navigator.clipboard.write) {
    await navigator.clipboard.writeText(plain);
    return false;
  }
  await navigator.clipboard.write([
    new ClipboardItem({
      "text/html": new Blob([html], { type: "text/html" }),
      "text/plain": new Blob([plain], { type: "text/plain" }),
    }),
  ]);
  return true;
}

async function copyPlainTextFallback(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    return false;
  }
}

function postTitleForExport(text) {
  const firstLine = String(text || "").split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  return (firstLine || $("topicInput")?.value?.trim() || "네이버 블로그 원고").slice(0, 110);
}

function safeFilename(text) {
  return String(text || "네이버 블로그 원고")
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90) || "네이버 블로그 원고";
}

function downloadGoogleDocsHtml(html, title = "네이버 블로그 원고") {
  const documentHtml = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
</head>
<body>
${html}
</body>
</html>`;
  downloadBlob(`${safeFilename(title)}.html`, new Blob([documentHtml], { type: "text/html;charset=utf-8" }));
}

function applyInlinePostStyles(root) {
  root.querySelectorAll("h1").forEach((element) => {
    element.setAttribute("style", "margin:0 0 34px;padding-bottom:18px;border-bottom:1px solid #e4ded1;color:#173f36;font-size:30px;line-height:1.36;font-weight:800;letter-spacing:0;");
  });
  root.querySelectorAll("h2").forEach((element) => {
    element.setAttribute("style", "margin:46px 0 22px;padding:0 0 5px 16px;border-left:5px solid #c7aa68;border-bottom:0;background:transparent;color:#173f36;font-size:23.5px;line-height:1.42;font-weight:800;letter-spacing:0;text-decoration-line:underline;text-decoration-color:#d8c28b;text-decoration-thickness:2px;text-underline-offset:8px;");
  });
  root.querySelectorAll("h3").forEach((element) => {
    element.setAttribute("style", "margin:28px 0 12px;color:#253f34;font-size:19px;line-height:1.42;font-weight:750;letter-spacing:0;");
  });
  root.querySelectorAll("p").forEach((element) => {
    const base = "margin:0 0 18px;color:#202824;font-size:16.5px;line-height:1.84;letter-spacing:0;";
    const toneColor = inlineParagraphToneColor(element);
    const colorBase = toneColor ? base.replace("color:#202824;", `color:${toneColor};`) : base;
    if (element.classList.contains("is-important")) {
      element.setAttribute("style", `${colorBase}margin-top:0;margin-bottom:18px;background:transparent;font-weight:600;`);
    } else if (element.classList.contains("is-short-note")) {
      element.setAttribute("style", `${colorBase}font-weight:600;`);
    } else {
      element.setAttribute("style", colorBase);
    }
  });
  root.querySelectorAll("ul").forEach((element) => {
    element.setAttribute("style", "margin:4px 0 22px;padding:13px 18px 13px 30px;border-left:3px solid #d7c28a;background:#fbf8f1;color:#26342d;font-size:16px;line-height:1.84;");
  });
  root.querySelectorAll("li").forEach((element) => {
    element.setAttribute("style", "margin:4px 0;line-height:1.84;");
  });
  root.querySelectorAll(".preview-keyword").forEach((element) => {
    element.setAttribute("style", "color:#17483b;font-weight:800;");
  });
  root.querySelectorAll(".preview-highlight").forEach((element) => {
    element.setAttribute("style", "padding:0 .14em;background:linear-gradient(transparent 58%, #fff0bd 58%);box-decoration-break:clone;-webkit-box-decoration-break:clone;border-radius:2px;");
  });
  root.querySelectorAll("figcaption").forEach((element) => {
    element.setAttribute("style", "margin:0 auto;padding:10px 4px 0;color:#5f665f;font-size:14px;line-height:1.7;text-align:center;");
  });
  root.querySelectorAll("img").forEach((element) => {
    element.setAttribute("style", "display:block;max-width:100%;height:auto;margin:0 auto;border-radius:6px;");
  });
}

function inlineParagraphToneColor(element) {
  if (element.classList.contains("tone-menu")) return "#3d3328";
  if (element.classList.contains("tone-atmosphere")) return "#2f4138";
  if (element.classList.contains("tone-place")) return "#24483b";
  if (element.classList.contains("tone-tip")) return "#5b4930";
  if (element.classList.contains("is-important")) return "#1e3d32";
  if (element.classList.contains("is-short-note")) return "#28483b";
  return "";
}

function downloadText(filename, text) {
  downloadBlob(filename, new Blob([text], { type: "text/plain;charset=utf-8" }));
}

function downloadBlob(filename, blob) {
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
