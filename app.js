/* app.js (ES Module) */

// ===== Firebase imports (CDN) =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  deleteDoc,
  doc,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// =====================
// 1) CONFIG (SIZNIKI)
// =====================
const firebaseConfig = {
  apiKey: "AIzaSyA0zyqs1BrDKKS7kkq3nqmJSj_VpM6CVcM",
  authDomain: "millionkm-a42ee.firebaseapp.com",
  projectId: "millionkm-a42ee",
  storageBucket: "millionkm-a42ee.firebasestorage.app",
  messagingSenderId: "594685468082",
  appId: "1:594685468082:web:e44c081e0617f0016998ab"
};

const TG_TOKEN = "7722483735:AAG_LZ1Bg0H-mnqAlnw4OknNj-BTrqM8CWM";
const TG_CHAT_ID = "-1003461463026";

// =====================
// 2) INIT
// =====================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// =====================
// 3) STATE
// =====================
let carData = {};         // carData.json dan yuklanadi
let isLogin = false;      // auth modal mode
let currentUserChatId = null;

// =====================
// 4) HELPERS
// =====================
const $ = (id) => document.getElementById(id);

function showToast(message, type = "success") {
  const toast = $("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove("show"), 3000);
}

function safeText(v) {
  return String(v ?? "");
}

function brandTitle(brandKey) {
  return brandKey ? brandKey.charAt(0).toUpperCase() + brandKey.slice(1) : "";
}

async function loadCarData() {
  // faqat index.html'da kerak bo'lishi mumkin, lekin yuklab qo'yamiz
  const res = await fetch("./carData.json", { cache: "no-store" });
  if (!res.ok) throw new Error("carData.json yuklanmadi");
  carData = await res.json();
}

// Telegram: minimal, parse_mode yo‘q
async function sendTelegramMessage(message) {
  if (!TG_TOKEN || TG_TOKEN.includes("PASTE_") || !TG_CHAT_ID || TG_CHAT_ID.includes("PASTE_")) {
    console.warn("Telegram token/chat_id qo‘yilmagan.");
    return false;
  }

  const url = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
  const payload = {
    chat_id: TG_CHAT_ID,
    text: safeText(message),
    disable_web_page_preview: true
  };

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok || !data.ok) {
      console.error("Telegram API xato:", { status: r.status, data });
      showToast(`Telegram xato: ${data?.description || "Unknown"}`, "error");
      return false;
    }

    return true;
  } catch (e) {
    console.error("Telegram fetch error:", e);
    showToast(`Telegram fetch xato: ${e?.message || "Unknown"}`, "error");
    return false;
  }
}

// =====================
// 5) AUTH MODAL
// =====================
function openAuthModal(login) {
  const modal = $("authModal");
  const title = $("authTitle");
  const submitBtn = $("authSubmitBtn");
  const genderSelect = $("userGender");
  const switchLink = $("switchAuthLink");

  if (!modal || !title || !submitBtn || !genderSelect || !switchLink) return;

  isLogin = login;

  if (login) {
    title.textContent = "Kirish";
    submitBtn.textContent = "Kirish";
    genderSelect.style.display = "none";
    switchLink.textContent = "Ro'yxatdan o'tish";
  } else {
    title.textContent = "Ro'yxatdan o'tish";
    submitBtn.textContent = "Ro'yxatdan o'tish";
    genderSelect.style.display = "block";
    switchLink.textContent = "Kirish";
  }

  modal.classList.add("show");
}

function closeAuthModal() {
  $("authModal")?.classList.remove("show");
}

// =====================
// 6) BRAND MODAL (faqat index.html)
// =====================
function openBrandModal(brand) {
  const modal = $("brandModal");
  const title = $("modalTitle");
  const container = $("carModelsContainer");
  if (!modal || !title || !container) return;

  title.textContent = `${brandTitle(brand)} modellari`;
  container.innerHTML = "";

  const models = carData?.[brand];
  if (!models) {
    container.innerHTML = `<p style="color: var(--gray);">Model ma'lumoti topilmadi</p>`;
    modal.classList.add("show");
    return;
  }

  Object.entries(models).forEach(([model, data]) => {
    const card = document.createElement("div");
    card.className = "car-model";
    card.innerHTML = `
      <h4>${safeText(model)}</h4>
      <p style="color: var(--gray); font-size: 14px; margin: 10px 0;">${safeText(data.desc)}</p>
      <ul>
        <li>• Maksimal yosh: ${Number(data.maxAge)} yil</li>
        <li>• Maksimal km: ${Number(data.maxKm).toLocaleString()} km</li>
      </ul>

      <div style="margin-top: 10px; font-size: 12px;">
        <span style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px; margin-right: 5px;">1 martalik</span>
        <span style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px;">1 yillik</span>
      </div>

      <button class="btn btn-secondary order-model-btn" style="margin-top: 15px; width: 100%; font-size: 13px;">
        Xarid qilish
      </button>

      <div class="order-form hidden">
        <h4>Buyurtma berish</h4>
        <select class="service-type">
          <option value="">Xizmat turini tanlang</option>
          <option value="1year">1 yillik xizmat</option>
          <option value="1time">1 martalik xizmat</option>
        </select>
        <textarea class="problem-desc" placeholder="Mashinangizda qanday muammo bor? (ixtiyoriy)"></textarea>
        <input type="tel" class="contact-phone" placeholder="Telefon raqamingiz">
        <button class="btn submit-order-btn" style="width: 100%; margin-top: 10px;">Buyurtma berish</button>
      </div>
    `;

    container.appendChild(card);

    card.querySelector(".order-model-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      card.querySelector(".order-form")?.classList.toggle("hidden");
    });

    card.querySelector(".submit-order-btn")?.addEventListener("click", async (e) => {
      e.stopPropagation();

      const serviceType = card.querySelector(".service-type")?.value || "";
      const problemDesc = card.querySelector(".problem-desc")?.value || "";
      const phone = card.querySelector(".contact-phone")?.value || "";

      if (!serviceType || !phone.trim()) {
        showToast("Xizmat turini va telefon raqamini kiriting!", "error");
        return;
      }

      const user = auth.currentUser;
      let userName = "Mehmon";

      if (user) {
        const uq = query(collection(db, "users"), where("uid", "==", user.uid));
        const snap = await getDocs(uq);
        if (!snap.empty) userName = snap.docs[0].data().name || "Mijoz";
      }

      const serviceTypeName = serviceType === "1year" ? "1 yillik xizmat" : "1 martalik xizmat";

      await sendTelegramMessage(
        "🚗 Yangi buyurtma\n\n" +
        `👤 Mijoz: ${userName}\n` +
        `🚘 Brend: ${brandTitle(brand)}\n` +
        `📦 Model: ${model}\n` +
        `⚙️ Xizmat: ${serviceTypeName}\n` +
        `📱 Telefon: ${phone}\n` +
        `📝 Muammo: ${problemDesc ? problemDesc : "Ko'rsatilmagan"}`
      );

      showToast("Buyurtma qabul qilindi! Tez orada aloqaga chiqamiz.", "success");
      card.querySelector(".order-form")?.classList.add("hidden");
      if (card.querySelector(".service-type")) card.querySelector(".service-type").value = "";
      if (card.querySelector(".problem-desc")) card.querySelector(".problem-desc").value = "";
      if (card.querySelector(".contact-phone")) card.querySelector(".contact-phone").value = "";
    });
  });

  modal.classList.add("show");
}

function closeBrandModal() {
  $("brandModal")?.classList.remove("show");
}

// =====================
// 7) STATUS CHECKER (faqat index.html)
// =====================
function bindStatusChecker() {
  if (!$("brandSelect") || !$("modelSelect") || !$("checkStatusBtn")) return;

  $("brandSelect")?.addEventListener("change", function () {
    const brand = this.value;
    const modelSelect = $("modelSelect");
    if (!modelSelect) return;

    modelSelect.innerHTML = `<option value="">Model tanlang</option>`;
    const models = carData?.[brand];
    if (!models) return;

    Object.keys(models).forEach((model) => {
      const opt = document.createElement("option");
      opt.value = model;
      opt.textContent = model;
      modelSelect.appendChild(opt);
    });
  });

  $("checkStatusBtn")?.addEventListener("click", () => {
    const brand = $("brandSelect")?.value || "";
    const model = $("modelSelect")?.value || "";
    const year = Number.parseInt($("carYear")?.value || "", 10);
    const km = Number.parseInt($("carKm")?.value || "", 10);
    const result = $("statusResult");
    if (!result) return;

    if (!brand || !model || Number.isNaN(year) || Number.isNaN(km)) {
      result.style.display = "block";
      result.innerHTML = "❌ Iltimos, barcha maydonlarni to'ldiring";
      return;
    }

    const currentYear = new Date().getFullYear();
    const carAge = currentYear - year;

    const limits = carData?.[brand]?.[model];
    if (!limits) {
      result.style.display = "block";
      result.innerHTML = "❌ Model ma'lumoti topilmadi";
      return;
    }

    result.style.display = "block";

    if (carAge <= limits.maxAge && km <= limits.maxKm) {
      result.innerHTML = `
        <h3 style="color: #34c759; margin-bottom: 10px;">✅ Tabriklaymiz!</h3>
        <p>Mashinangiz Million km garantiyali xizmatga mos keladi!</p>
        <p style="margin-top: 10px; font-size: 14px;">
          Yosh: ${carAge} yil (Max: ${limits.maxAge} yil)<br>
          Probeg: ${km.toLocaleString()} km (Max: ${Number(limits.maxKm).toLocaleString()} km)
        </p>
        <button class="btn" id="registerFromStatus" style="margin-top: 15px; background: var(--green); color: white; width: 100%;">
          Ro'yxatdan o'tish
        </button>
      `;
      $("registerFromStatus")?.addEventListener("click", () => {
        result.style.display = "none";
        openAuthModal(false);
      });
    } else {
      result.innerHTML = `
        <h3 style="color: #ff3b30;">⚠️ Afsuski</h3>
        <p>Mashinangiz garantiyali dasturga mos kelmaydi</p>
        <p style="margin-top: 10px; font-size: 14px;">
          Lekin bir martalik xizmatdan foydalanishingiz mumkin!
        </p>
        <button class="btn" id="oneTimeService" style="margin-top: 15px; background: var(--red); color: white; width: 100%;">
          Bir martalik xizmat
        </button>
      `;
      $("oneTimeService")?.addEventListener("click", () => {
        result.style.display = "none";
        openAuthModal(false);
      });
    }
  });
}

// =====================
// 8) CABINET (GARAGE) - cabinet.html
// =====================
function loadGarage(uid) {
  // Index talab qilmasin: orderBy olib tashladik
  const qCars = query(collection(db, "cars"), where("userUid", "==", uid));

  onSnapshot(qCars, (snapshot) => {
    const garage = $("garage");
    if (!garage) return;

    garage.innerHTML = "";

    snapshot.forEach((carDoc) => {
      const car = carDoc.data();
      const id = carDoc.id;

      const lastOil = Number(car.lastOil ?? 0);
      const daily = Number(car.daily ?? 1);

      const nextService = lastOil + 8000;
      const daysLeft = daily > 0 ? Math.ceil((nextService - lastOil) / daily) : 0;
      const statusColor = daysLeft < 10 ? "var(--red)" : "var(--green)";

      const card = document.createElement("div");
      card.className = "cabinet-card";
      card.innerHTML = `
        <h4>${safeText(car.model)} (${Number(car.year)})</h4>
        <p style="margin: 5px 0;">Oxirgi moy: ${lastOil.toLocaleString()} km</p>
        <p style="margin: 5px 0;">Keyingi servis: ${nextService.toLocaleString()} km</p>
        <p style="margin: 5px 0;">Kunlik: ${daily} km</p>
        <p style="margin: 10px 0; color: ${statusColor}; font-weight: 600;">
          ${daysLeft > 0 ? `⏱ ~${daysLeft} kun qoldi` : "⚠️ Servis vaqti keldi!"}
        </p>
        <button class="btn btn-danger" data-id="${id}" style="margin-top: 10px;">O'chirish</button>
      `;

      garage.appendChild(card);

      card.querySelector(".btn-danger")?.addEventListener("click", async () => {
        if (!confirm("Mashinani o'chirmoqchimisiz?")) return;
        try {
          await deleteDoc(doc(db, "cars", id));
          showToast("Mashina o'chirildi!", "success");
        } catch (e) {
          console.error(e);
          showToast("Xatolik!", "error");
        }
      });
    });

    if (snapshot.empty) {
      garage.innerHTML = `<p style="text-align: center; padding: 40px; color: var(--gray);">Hali mashinalar yo'q</p>`;
    }
  });
}

function bindCabinetAddCar() {
  if (!$("addCarBtn")) return;

  $("addCarBtn")?.addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!user) {
      showToast("Avval kirish qiling!", "error");
      return;
    }

    const model = $("carModel")?.value?.trim() || "";
    const year = Number.parseInt($("carYearInput")?.value || "", 10);
    const lastOil = Number.parseInt($("lastOilKm")?.value || "", 10);
    const daily = Number.parseInt($("dailyKm")?.value || "", 10);

    if (!model || Number.isNaN(year) || Number.isNaN(lastOil) || Number.isNaN(daily)) {
      showToast("Barcha maydonlarni to'ldiring!", "error");
      return;
    }

    const currentYear = new Date().getFullYear();
    if (year < 1900 || year > currentYear || lastOil < 0 || daily < 1) {
      showToast("Noto'g'ri qiymatlar!", "error");
      return;
    }

    try {
      await addDoc(collection(db, "cars"), {
        userUid: user.uid,
        model,
        year,
        lastOil,
        daily,
        createdAt: new Date()
      });

      await sendTelegramMessage(
        "🚗 Yangi mashina qo'shildi\n" +
        `🏷 Model: ${model}\n` +
        `📅 Yil: ${year}\n` +
        `🛢 Oxirgi moy: ${lastOil} km\n` +
        `📊 Kunlik: ${daily} km`
      );

      showToast("Mashina qo'shildi!", "success");

      if ($("carModel")) $("carModel").value = "";
      if ($("carYearInput")) $("carYearInput").value = "";
      if ($("lastOilKm")) $("lastOilKm").value = "";
      if ($("dailyKm")) $("dailyKm").value = "";
    } catch (e) {
      console.error(e);
      showToast("Xatolik yuz berdi!", "error");
    }
  });
}

// =====================
// 9) ADMIN PAGE - admin.html
// =====================
async function loadAdminLists() {
  const usersList = $("allUsersList");
  const carsList = $("allCarsList");
  if (usersList) usersList.innerHTML = "";
  if (carsList) carsList.innerHTML = "";

  const usersSnap = await getDocs(collection(db, "users"));
  usersSnap.forEach((docSnap) => {
    const u = docSnap.data();
    const card = document.createElement("div");
    card.className = "admin-card";
    card.innerHTML = `
      <h4>${safeText(u.name)}</h4>
      <p>Email: ${safeText(u.email)}</p>
      <p>Telefon: ${safeText(u.phone)}</p>
      <p>Jins: ${safeText(u.gender)}</p>
      <p>Admin: ${u.isAdmin ? "Ha" : "Yo'q"}</p>
    `;
    usersList?.appendChild(card);
  });

  const carsSnap = await getDocs(collection(db, "cars"));
  carsSnap.forEach((docSnap) => {
    const c = docSnap.data();
    const card = document.createElement("div");
    card.className = "admin-card";
    card.innerHTML = `
      <h4>${safeText(c.model)} (${Number(c.year)})</h4>
      <p>Oxirgi moy: ${Number(c.lastOil).toLocaleString()} km</p>
      <p>Kunlik: ${Number(c.daily)} km</p>
    `;
    carsList?.appendChild(card);
  });
}

// =====================
// 10) CHAT (faqat index.html bo'lsa)
// =====================
function bindChat() {
  if (!$("chatButton") || !$("chatBox") || !$("chatMessages")) return;

  $("chatButton")?.addEventListener("click", () => $("chatBox")?.classList.toggle("show"));
  $("closeChat")?.addEventListener("click", () => $("chatBox")?.classList.remove("show"));

  async function sendChatMessage() {
    const input = $("chatInput");
    const message = input?.value?.trim() || "";
    if (!message) return;

    const messagesDiv = $("chatMessages");
    const user = auth.currentUser;

    let userName = "Mehmon";
    let userEmail = "";

    if (user) {
      const uq = query(collection(db, "users"), where("uid", "==", user.uid));
      const snap = await getDocs(uq);
      if (!snap.empty) {
        const ud = snap.docs[0].data();
        userName = ud.name || "Mijoz";
        userEmail = ud.email || "";
      }
    }

    const userMsg = document.createElement("p");
    userMsg.style.cssText =
      "background: var(--primary); color: white; padding: 10px; border-radius: 10px; margin: 5px 0; text-align: right;";
    userMsg.textContent = message;
    messagesDiv?.appendChild(userMsg);

    const chatId = currentUserChatId || "guest_" + Date.now();

    await sendTelegramMessage(
      "💬 Chat xabar\n\n" +
      `👤 Ism: ${userName}\n` +
      `📧 Email: ${userEmail || "Yo'q"}\n` +
      `🆔 Chat ID: ${chatId}\n\n` +
      `💭 Xabar: ${message}\n\n` +
      `Javob: /reply ${chatId} ...`
    );

    if (input) input.value = "";

    setTimeout(() => {
      const botMsg = document.createElement("p");
      botMsg.style.cssText = "background: #f5f5f7; padding: 10px; border-radius: 10px; margin: 5px 0;";
      botMsg.textContent = "Xabaringiz qabul qilindi! Tez orada javob beramiz.";
      messagesDiv?.appendChild(botMsg);
      if (messagesDiv) messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }, 600);
  }

  $("sendChatBtn")?.addEventListener("click", sendChatMessage);
  $("chatInput")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendChatMessage();
  });
}

// =====================
// 11) SERVICES (faqat index.html)
// =====================
function openServiceModal(serviceKey) {
  const modal = $("serviceModal");
  if (!modal) return;

  // select value set
  const typeSel = $("serviceType");
  if (typeSel) typeSel.value = serviceKey || "";

  // title
  const title = $("serviceTitle");
  if (title) {
    title.textContent = serviceKey === "fuel"
      ? "Million km Fuel buyurtmasi"
      : "Million km Express buyurtmasi";
  }

  modal.classList.add("show");
}

function closeServiceModal() {
  $("serviceModal")?.classList.remove("show");
}

function bindServices() {
  // open modal on service buttons
  document.querySelectorAll("[data-service]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const service = btn.getAttribute("data-service");
      const user = auth.currentUser;

      if (!user) {
        showToast("Avval kirish qiling!", "error");
        openAuthModal(true);
        return;
      }

      openServiceModal(service);
    });
  });

  $("closeServiceModal")?.addEventListener("click", closeServiceModal);

  // submit
  $("serviceSubmitBtn")?.addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!user) {
      showToast("Avval kirish qiling!", "error");
      closeServiceModal();
      openAuthModal(true);
      return;
    }

    const name = ($("serviceName")?.value || "").trim();
    const phone = ($("servicePhone")?.value || "").trim();
    const service = $("serviceType")?.value || "";
    const note = ($("serviceNote")?.value || "").trim();

    if (!name || !phone || !service) {
      showToast("Ism, telefon va xizmat turini kiriting!", "error");
      return;
    }

    const serviceName =
      service === "fuel" ? "Million km Fuel" :
      service === "express" ? "Million km Express" :
      service;

    await sendTelegramMessage(
      "📦 Xizmat buyurtmasi\n\n" +
      `🔧 Tur: ${serviceName}\n` +
      `👤 Ism: ${name}\n` +
      `📱 Telefon: ${phone}\n` +
      `📝 Izoh: ${note || "Yo'q"}`
    );

    showToast("Buyurtma yuborildi!", "success");

    // clear + close
    if ($("serviceName")) $("serviceName").value = "";
    if ($("servicePhone")) $("servicePhone").value = "";
    if ($("serviceNote")) $("serviceNote").value = "";
    closeServiceModal();
  });
}

// =====================
// 12) SMOOTH SCROLL (faqat # bo'lsa)
// =====================
function bindSmoothScroll() {
  const anchors = document.querySelectorAll('a[href^="#"]');
  if (!anchors.length) return;

  anchors.forEach((a) => {
    a.addEventListener("click", (e) => {
      const href = a.getAttribute("href");
      if (!href || href === "#") return;

      const target = document.querySelector(href);
      if (!target) return;

      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth" });
    });
  });

  $("statusBtn")?.addEventListener("click", () => {
    document.querySelector("#status")?.scrollIntoView({ behavior: "smooth" });
  });

  $("logoHome")?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

// =====================
// 13) AUTH EVENTS (har sahifa)
// =====================
function bindAuthEvents() {
  $("authLink")?.addEventListener("click", async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (user) {
      await signOut(auth);
      return;
    }
    openAuthModal(true);
  });

  $("startBtn")?.addEventListener("click", () => openAuthModal(false));

  $("switchAuthLink")?.addEventListener("click", (e) => {
    e.preventDefault();
    openAuthModal(!isLogin);
  });

  $("closeAuthModal")?.addEventListener("click", closeAuthModal);

  $("authSubmitBtn")?.addEventListener("click", async () => {
    const name = $("userName")?.value?.trim() || "";
    const email = $("userEmail")?.value?.trim() || "";
    const password = $("userPassword")?.value?.trim() || "";
    const phone = $("userPhone")?.value?.trim() || "";
    const gender = $("userGender")?.value || "";

    if (isLogin) {
      if (!email || !password) {
        showToast("Email va parolni kiriting!", "error");
        return;
      }
      try {
        await signInWithEmailAndPassword(auth, email, password);
        showToast("Muvaffaqiyatli kirdingiz!", "success");
        closeAuthModal();
      } catch (e) {
        console.error(e);
        showToast("Email yoki parol noto'g'ri!", "error");
      }
      return;
    }

    // register
    if (!name || !email || !password || !phone || !gender) {
      showToast("Barcha maydonlarni to'ldiring!", "error");
      return;
    }
    if (password.length < 6) {
      showToast("Parol kamida 6 ta belgidan iborat bo'lishi kerak!", "error");
      return;
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const user = cred.user;

      await addDoc(collection(db, "users"), {
        uid: user.uid,
        name,
        email,
        phone,
        gender,
        isAdmin: false,
        createdAt: new Date()
      });

      await sendTelegramMessage(
        "🆕 Yangi foydalanuvchi\n" +
        `👤 Ism: ${name}\n` +
        `📧 Email: ${email}\n` +
        `📱 Telefon: ${phone}\n` +
        `👥 Jins: ${gender}`
      );

      showToast("Ro'yxatdan muvaffaqiyatli o'tdingiz!", "success");
      closeAuthModal();
    } catch (e) {
      console.error(e);
      if (e?.code === "auth/email-already-in-use") {
        showToast("Bu email allaqachon ro'yxatdan o'tgan!", "error");
      } else {
        showToast("Xatolik yuz berdi!", "error");
      }
    }
  });
}

// =====================
// 14) BRAND CARDS (faqat index.html)
// =====================
function bindBrandCards() {
  const cards = document.querySelectorAll(".brand-card");
  if (!cards.length) return;

  cards.forEach((card) => {
    card.addEventListener("click", () => {
      const brand = card.getAttribute("data-brand");
      if (brand) openBrandModal(brand);
    });

    card.querySelectorAll("button, a").forEach((inner) => {
      inner.addEventListener("click", (e) => e.stopPropagation());
    });
  });

  $("closeBrandModal")?.addEventListener("click", closeBrandModal);
  $("brandModal")?.addEventListener("click", (e) => {
    if (e.target && e.target.id === "brandModal") closeBrandModal();
  });
}

// =====================
// 15) AUTH STATE (har sahifa)
// =====================
function bindAuthState() {
  onAuthStateChanged(auth, async (user) => {
    const authLink = $("authLink");
    const cabinetLink = $("cabinetLink");
    const adminLink = $("adminLink");

    if (user) {
      if (authLink) authLink.textContent = "Chiqish";
      cabinetLink?.classList.remove("hidden");

      const uq = query(collection(db, "users"), where("uid", "==", user.uid));
      const snap = await getDocs(uq);

      if (!snap.empty) {
        const ud = snap.docs[0].data();
        currentUserChatId = user.uid;

        if (ud.isAdmin) adminLink?.classList.remove("hidden");

        // faqat cabinet.html'da bor bo'lishi mumkin
        if ($("welcomeText")) {
          $("welcomeText").textContent = `Xush kelibsiz, ${ud.name}! Email: ${ud.email}`;
        }

        // admin.html bo'lsa ro'yxatlarni yuklaymiz
        if ($("adminPanel")) {
          if (ud.isAdmin) {
            await loadAdminLists();
          } else {
            showToast("Siz admin emassiz!", "error");
          }
        }
      }

      // cabinet.html bo'lsa garage yuklaymiz
      if ($("garage")) {
        loadGarage(user.uid);
      }
    } else {
      if (authLink) authLink.textContent = "Kirish";
      cabinetLink?.classList.add("hidden");
      adminLink?.classList.add("hidden");
      currentUserChatId = null;

      // cabinet/admin sahifalarda logout bo'lsa indexga qaytaramiz (xohlasangiz)
      // window.location.href = "./index.html";
    }
  });
}

// =====================
// 16) BOOTSTRAP
// =====================
async function main() {
  // carData faqat index uchun kerak, lekin zarar qilmaydi
  try {
    await loadCarData();
  } catch (e) {
    console.warn("carData.json yuklanmadi (cabinet/admin sahifada normal):", e);
  }

  // ✅ status checker carData yuklangandan keyin ishlaydi
  bindStatusChecker();

  // qolganlari
  bindSmoothScroll();
  bindBrandCards();
  bindAuthEvents();
  bindCabinetAddCar();
  bindChat();
  bindServices();
  bindAuthState();
}

console.log("app.js ishladi ✅");
main();
