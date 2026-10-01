/* 덕포초등학교 홈페이지 스크립트
   - 모바일 메뉴 · 스크롤 등장
   - 급식: NEIS 공공데이터 실시간 조회 (실패 시 실제 저장 식단 표시) */

(() => {
  "use strict";

  document.body.classList.add("js");

  /* ── 모바일 메뉴 ─────────────────────────── */
  const navToggle = document.getElementById("navToggle");
  const gnb = document.getElementById("gnb");
  navToggle.addEventListener("click", () => {
    const open = gnb.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(open));
    navToggle.querySelector(".sr-only").textContent = open ? "메뉴 닫기" : "메뉴 열기";
  });
  gnb.addEventListener("click", (e) => {
    if (e.target.closest("a")) {
      gnb.classList.remove("open");
      navToggle.setAttribute("aria-expanded", "false");
    }
  });

  /* ── 스크롤 등장 ─────────────────────────── */
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add("in");
          io.unobserve(en.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

  const rings = document.querySelector(".rings");
  if (rings) {
    new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            rings.classList.add("in-view");
            obs.disconnect();
          }
        });
      },
      { threshold: 0.2 }
    ).observe(rings);
  }

  /* ── 날짜 유틸 (한국 시간 기준) ───────────── */
  const KST_TODAY = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }); // YYYY-MM-DD
  const [ty, tm, td] = KST_TODAY.split("-").map(Number);
  const today = new Date(ty, tm - 1, td);

  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const krDate = (d) => `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.(${DOW[d.getDay()]})`;
  const krRange = (a, b) => `${krDate(a)} ~ ${b.getMonth() + 1}. ${b.getDate()}.(${DOW[b.getDay()]})`;
  const DOW = ["일", "월", "화", "수", "목", "금", "토"];
  const mondayOf = (d) => {
    const m = new Date(d);
    m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
    return m;
  };

  /* ── NEIS 급식 API ───────────────────────── */
  const NEIS = "https://open.neis.go.kr/hub/mealServiceDietInfo";
  const CODES = "ATPT_OFCDC_SC_CODE=C10&SD_SCHUL_CODE=7201066&Type=json";

  function cleanDish(raw) {
    let s = raw.trim();
    const allergens = [];
    const addAll = (str) => str.split(/[.·,\s]+/).filter(Boolean);
    // 신규 형식: "계란찜 (1.2)"
    let m = s.match(/\((\d[\d.,·\s]*)\)\s*$/);
    if (m) { allergens.push(...addAll(m[1])); s = s.slice(0, m.index).trim(); }
    // 구 형식: "깍두기(영양량)**9.13." / "김/맛김*13."
    m = s.match(/\*{1,2}\s*([\d.]+)\s*\.?$/);
    if (m) { allergens.push(...addAll(m[1])); s = s.slice(0, m.index).trim(); }
    // 구 형식: "팥밥-덕초" / "새알미역국-덕초5.6.9.13."
    m = s.match(/-(덕)?초\s*([\d.]*)\.?\s*$/);
    if (m) { if (m[2]) allergens.push(...addAll(m[2])); s = s.slice(0, m.index).trim(); }
    s = s.replace(/\(영양량\)/g, "").replace(/\.+$/, "").trim();
    return { name: s, all: [...new Set(allergens)] };
  }

  async function fetchMeals(from, to) {
    const res = await fetch(`${NEIS}?${CODES}&MLSV_FROM_YMD=${from}&MLSV_TO_YMD=${to}`);
    if (!res.ok) throw new Error("NEIS 응답 오류");
    const data = await res.json();
    const head = data?.mealServiceDietInfo?.[0]?.head?.[0];
    if (!head || head.RESULT?.CODE !== "INFO-000") return {};
    const rows = data.mealServiceDietInfo[1]?.row || [];
    const map = {};
    rows.forEach((r) => {
      const dishes = (r.DDISH_NM || "")
        .split(/<br\s*\/?>|\/\s/gi)
        .map(cleanDish)
        .filter((d) => d.name);
      map[r.MLSV_YMD] = { cal: r.CAL_INFO ? `${r.CAL_INFO} Kcal` : "", dishes };
    });
    return map;
  }

  /* ── 오프라인 폴백: 2026. 9. 14.~18. 실제 식단(NEIS 저장분) ── */
  const FALLBACK = {
    "20260914": { cal: "648.2 Kcal", dishes: [
      { name: "쌀보리밥", all: [] }, { name: "꼬지어묵국", all: ["5","6","9","16"] },
      { name: "일미실채간장볶음", all: ["5","6","13","17"] }, { name: "계란찜", all: ["1","2"] },
      { name: "마늘쫑조림", all: ["5","6","13"] }, { name: "비엔나케첩조림", all: ["1","5","6","10","12","13","16"] },
      { name: "배추김치", all: ["9"] }, { name: "사과", all: [] } ] },
    "20260915": { cal: "789.2 Kcal", dishes: [
      { name: "차수수밥", all: [] }, { name: "쇠고기무맑은국", all: ["5","6","9","16"] },
      { name: "연근참깨소스무침", all: ["1","5","13"] }, { name: "낙지볶음", all: ["5","6","9","13"] },
      { name: "스윗허니닭강정", all: ["1","2","5","6","15","16","18"] },
      { name: "배추김치", all: ["9"] }, { name: "망고", all: [] }, { name: "도시락김", all: [] } ] },
    "20260916": { cal: "674.8 Kcal", dishes: [
      { name: "미니밥", all: [] }, { name: "카레우동", all: ["1","2","5","6","10","12","13","16","18"] },
      { name: "오이양파무침", all: ["13"] }, { name: "깍두기", all: ["9"] },
      { name: "명랑핫도그", all: ["1","2","5","6","10","12","16"] }, { name: "쥬스(자두)", all: [] } ] },
    "20260917": { cal: "724.1 Kcal", dishes: [
      { name: "오색현미밥", all: [] }, { name: "등뼈감자탕", all: ["5","6","10"] },
      { name: "연두부양념", all: ["5","6"] }, { name: "콩나물잔파무침", all: ["5"] },
      { name: "계란말이", all: ["1","12"] }, { name: "한입떡갈비", all: ["5","6","10","12","13","15","16","18"] },
      { name: "배추김치", all: ["9"] } ] },
    "20260918": { cal: "512.6 Kcal", dishes: [
      { name: "차수수밥", all: [] }, { name: "나주식곰탕", all: ["1","5","16"] },
      { name: "두부양념조림", all: ["5","6","13"] }, { name: "파프리카된장무침", all: ["5","6","13"] },
      { name: "대구살&어니언소스", all: ["1","5","6","17"] }, { name: "깍두기", all: ["9"] },
      { name: "포도(거봉)", all: [] } ] },
  };

  /* ── 렌더링 ──────────────────────────────── */
  const grid = document.getElementById("lunchGrid");
  const weekLabel = document.getElementById("weekLabel");
  const statusEl = document.getElementById("lunchStatus");
  const cache = new Map(); // weekStart ymd -> {map, live}

  function fallbackWeek(weekStart) {
    const map = {};
    for (let i = 0; i < 5; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const k = ymd(d);
      if (FALLBACK[k]) map[k] = FALLBACK[k];
    }
    return map;
  }

  function dayCard(d, meal, isToday) {
    const card = document.createElement("article");
    card.className = "day" + (isToday ? " today" : "");
    const head = document.createElement("div");
    head.className = "day-head";
    const dow = document.createElement("span");
    dow.className = "dow";
    dow.textContent = `${DOW[d.getDay()]}요일`;
    const date = document.createElement("span");
    date.className = "date";
    date.textContent = `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
    head.append(dow, date);
    card.append(head);
    if (isToday) {
      const badge = document.createElement("span");
      badge.className = "badge-today";
      badge.textContent = "오늘";
      card.append(badge);
    }
    if (!meal) {
      const none = document.createElement("p");
      none.className = "none";
      none.textContent = "급식 정보가 없습니다 (방학·공휴일)";
      card.append(none);
      return card;
    }
    const ul = document.createElement("ul");
    ul.className = "dishes";
    meal.dishes.forEach((dish) => {
      const li = document.createElement("li");
      li.append(dish.name);
      if (dish.all.length) {
        const a = document.createElement("span");
        a.className = "all";
        a.title = `알레르기 표시번호 ${dish.all.join(", ")}`;
        a.textContent = `(${dish.all.join("·")})`;
        li.append(a);
      }
      ul.append(li);
    });
    const kcal = document.createElement("p");
    kcal.className = "kcal";
    kcal.textContent = meal.cal;
    card.append(ul, kcal);
    return card;
  }

  function render(weekStart, mealMap, live) {
    grid.replaceChildren();
    const days = [...Array(5)].map((_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
    days.forEach((d) => {
      const isToday = ymd(d) === ymd(today);
      grid.append(dayCard(d, mealMap[ymd(d)], isToday));
    });
    weekLabel.textContent = krRange(days[0], days[4]);
    statusEl.textContent = live
      ? "● NEIS 공공데이터 실시간 연동 — 덕포초등학교 중식(급식실 제공 기준)"
      : "○ 실시간 연결 불가 — 2026. 9. 14.~9. 18. 실제 식단(NEIS 저장분)을 표시합니다";
  }

  async function loadWeek(weekStart) {
    const key = ymd(weekStart);
    if (cache.has(key)) {
      const { map, live } = cache.get(key);
      render(weekStart, map, live);
      return;
    }
    const from = ymd(weekStart);
    const endDate = new Date(weekStart);
    endDate.setDate(endDate.getDate() + 4);
    try {
      const map = await fetchMeals(from, ymd(endDate));
      const hasData = Object.keys(map).length > 0;
      const useMap = hasData ? map : fallbackWeek(weekStart);
      const live = hasData || Object.keys(useMap).length === 0;
      cache.set(key, { map: useMap, live });
      render(weekStart, useMap, live);
    } catch {
      const fb = fallbackWeek(weekStart);
      if (Object.keys(fb).length) {
        cache.set(key, { map: fb, live: false });
        render(weekStart, fb, false);
      } else {
        render(weekStart, {}, false);
        statusEl.textContent = "○ 일시적으로 급식 데이터를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.";
      }
    }
  }

  let current = mondayOf(today);
  document.getElementById("prevWeek").addEventListener("click", () => {
    current.setDate(current.getDate() - 7);
    loadWeek(current);
  });
  document.getElementById("nextWeek").addEventListener("click", () => {
    current.setDate(current.getDate() + 7);
    loadWeek(current);
  });
  loadWeek(current);
})();
