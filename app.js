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
  getDocs,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/** =========================
 *  SOZLAMALAR (sizniki)
 *  ========================= */
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// ⚠️ XAVFSIZ EMAS: token front-end’da ko‘rinadi.
// Keyin xohlasangiz proxy/backend qilib beraman.
const TG_TOKEN = "YOUR_TELEGRAM_BOT_TOKEN";
const TG_CHAT_ID = "YOUR_TELEGRAM_CHAT_ID";

/** =========================
 *  INIT
 *  ========================= */
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/** carData.json dan yuklaymiz */
let carData = {};
await loadCarData();

/** UI state */
let isLogin = false;
let currentUserChatId = null;

/** =========================
 *  HELPERS
 *  ========================= */
function $(id) { return document.getElementById(id); }

function showToast(message, type = "success") {
  const toast = $("toast");
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove("show"), 3000);
}

async function loadCarData() {
  try {
    const r = await fetch("./carData.json", { cache: "no-store" });
    if (!r.ok) throw new Error("carData.json yuklanmadi");
    carData = await r.json();
  } catch (e) {
    console.error(e);
    showToast("carData.json topilmadi yoki xato", "error");
    carData = {};
  }
}

async function sendTelegramMessage(message) {
  const url = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
  const payload = {
    chat_id: TG_CHAT_ID,
    text: String(message),
    disable_web_page_preview: true
  };

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await r.json();

    if (!r.ok || !data.ok) {
      console.error("Telegram error:", data);
      showToast("Telegramga yuborilmadi (API xato)", "error");
      return false;
    }
    return true;
  } catch (e) {
    console.error("Telegram fetch error:", e);
    showToast("Telegram bilan aloqa yo‘q", "error");
    return false;
  }
}

/** href="#" lar smooth scrollga tushib qolmasin */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    const href = a.getAttribute("href");
    // faqat #something bo'lsin, "#" emas
    if (!href || href.length <= 1) return;

    a.addEventListener("click", (e) => {
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) target.scrollIntoView({ behavior: "smooth" });
    });
  });
}

/** Brand card ichidagi button bosilganda modalni “ikki marta” ochirmasin */
function stopBrandButtonBubbling() {
  document.querySelectorAll(".brand-card .btn").forEach(b => {
    b.addEventListener("click", (e) => e.stopPropagation());
  });
}

/** =========================
 *  STATUS CHECKER
 *  ========================= */
function initStatusChecker() {
  $("brandSelect").addEventListener("change", function() {
    const brand = this.value;
    const modelSelect = $("modelSelect");
    modelSelect.innerHTML = '<option value="">Model tanlang</option>';

    if (brand && carData[brand]) {
      Object.keys(carData[brand]).forEach(model => {
        const option = document.createElement("option");
        option.value = model;
        option.textContent = model;
        modelSelect.appendChild(option);
      });
    }
  });

  $("checkStatusBtn").addEventListener("click", () => {
    const brand = $("brandSelect").value;
    const model = $("modelSelect").value;
    const year = Number.parseInt($("carYear").value, 10);
    const km = Number.parseInt($("carKm").value, 10);
    const result = $("statusResult");

    // 0 bo'lsa ham xato bo'lib qolmasligi uchun NaN tekshiruv
    if (!brand || !model || Number.isNaN(year) || Number.isNaN(km)) {
      result.style.display = "block";
      result.innerHTML = "❌ Iltimos, barcha maydonlarni to'ldiring";
      return;
    }

    const limits = carData?.[brand]?.[model];
    if (!limits) {
      result.style.display = "block";
      result.innerHTML = "❌ Model topilmadi (carData.json tekshiring)";
      return;
    }

    const currentYear = new Date().getFullYear();
    const carAge = currentYear - year;

    result.style.display = "block";

    if (carAge <= limits.maxAge && km <= limits.maxKm) {
      result.innerHTML = `
        <h3 style="color: #34c759; margin-bottom: 10px;">✅ Tabriklaymiz!</h3>
        <p>Mashinangiz Million km garantiyali xizmatga mos keladi!</p>
        <p style="margin-top: 10px; font-size: 14px;">
          Yosh: ${carAge} yil (Max: ${limits.maxAge} yil)<br>
          Probeg: ${km.toLocaleString()} km (Max: ${limits.maxKm.toLocaleString()} km)
        </p>
        <button class="btn" id="registerFromStatus" style="margin-top: 15px; background: var(--green); color: white; width: 100%;">
          Ro'yxatdan o'tish
        </button>
      `;
      $("registerFromStatus").addEventListener("click", () => {
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
      $("oneTimeService").addEventListener("click", () => {
        result.style.display = "none";
        openAuthModal(false);
      });
    }
  });
}

/** =========================
 *  BRAND MODAL + ORDER
 *  ========================= */
function initBrandModal() {
  document.querySelectorAll(".brand-card").forEach(card => {
    card.addEventListener("click", function() {
      const brand = this.getAttribute("data-brand");
      openBrandModal(brand);
    });
  });

  $("closeBrandModal").addEventListener("click", () => {
    $("brandModal").classList.remove("show");
  });

  // tashqariga bosganda yopish (ixtiyoriy)
  $("brandModal").addEventListener("click", (e) => {
    if (e.target === $("brandModal")) $("brandModal").classList.remove("show");
  });
}

function openBrandModal(brand) {
  const modal = $("brandModal");
  const title = $("modalTitle");
  const container = $("carModelsContainer");

  title.textContent = brand.charAt(0).toUpperCase() + brand.slice(1) + " modellari";
  container.innerHTML = "";

  if (!carData[brand]) {
    container.innerHTML = `<p style="color: var(--gray);">Model ma'lumoti topilmadi.</p>`;
    modal.classList.add("show");
    return;
  }

  Object.entries(carData[brand]).forEach(([model, data]) => {
    const card = document.createElement("div");
    card.className = "car-model";

    const safeId = `order-${brand}-${model}`.replace(/\s+/g, "_");
    card.innerHTML = `
      <h4>${model}</h4>
      <p style="color: var(--gray); font-size: 14px; margin: 10px 0;">${data.desc}</p>
      <ul>
        <li>• Maksimal yosh: ${data.maxAge} yil</li>
        <li>• Maksimal km: ${data.maxKm.toLocaleString()} km</li>
      </ul>
      <div style="margin-top: 10px; font-size: 12px;">
        <span style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px; margin-right: 5px;">1 martalik</span>
        <span style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px;">1 yillik</span>
      </div>
      <button class="btn btn-secondary order-model-btn" style="margin-top: 15px; width: 100%; font-size: 13px;" data-model="${model}" data-brand="${brand}">
        Xarid qilish
      </button>
      <div class="order-form hidden" id="${safeId}">
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

    const orderBtn = card.querySelector(".order-model-btn");
    const orderForm = card.querySelector(".order-form");
    const submitBtn = card.querySelector(".submit-order-btn");

    orderBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      orderForm.classList.toggle("hidden");
    });

    submitBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const serviceType = orderForm.querySelector(".service-type").value;
      const problemDesc = orderForm.querySelector(".problem-desc").value;
      const phone = orderForm.querySelector(".contact-phone").value;

      if (!serviceType || !phone) {
        showToast("Xizmat turini va telefon raqamini kiriting!", "error");
        return;
      }

      const user = auth.currentUser;
      let userName = "Mehmon";

      if (user) {
        const userQuery = query(collection(db, "users"), where("uid", "==", user.uid));
        const userSnapshot = await getDocs(userQuery);
        if (!userSnapshot.empty) userName = userSnapshot.docs[0].data().name;
      }

      const serviceTypeName = serviceType === "1year" ? "1 yillik xizmat" : "1 martalik xizmat";

      await sendTelegramMessage(
        `🚗 Yangi buyurtma\n\n` +
        `👤 Mijoz: ${userName}\n` +
        `🚘 Brend: ${brand.charAt(0).toUpperCase() + brand.slice(1)}\n` +
        `📦 Model: ${model}\n` +
        `⚙️ Xizmat: ${serviceTypeName}\n` +
        `📱 Telefon: ${phone}\n` +
        `📝 Muammo: ${problemDesc || "Ko'rsatilmagan"}`
      );

      showToast("Buyurtma qabul qilindi! Tez orada aloqaga chiqamiz.", "success");
      orderForm.classList.add("hidden");
      orderForm.querySelector(".service-type").value = "";
      orderForm.querySelector(".problem-desc").value = "";
      orderForm.querySelector(".contact-phone").value = "";
    });
  });

  modal.classList.add("show");
}

/** =========================
 *  AUTH MODAL
 *  ========================= */
function openAuthModal(login) {
  isLogin = login;

  const modal = $("authModal");
  const title = $("authTitle");
  const submitBtn = $("authSubmitBtn");
  const genderSelect = $("userGender");
  const switchLink = $("switchAuthLink");

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

function initAuth() {
  $("authLink").addEventListener("click", (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (user) signOut(auth);
    else openAuthModal(true);
  });

  $("startBtn").addEventListener("click", () => openAuthModal(false));

  $("statusBtn").addEventListener("click", () => {
    $("status").scrollIntoView({ behavior: "smooth" });
  });

  $("switchAuthLink").addEventListener("click", (e) => {
    e.preventDefault();
    openAuthModal(!isLogin);
  });

  $("closeAuthModal").addEventListener("click", () => {
    $("authModal").classList.remove("show");
  });

  $("authSubmitBtn").addEventListener("click", async () => {
    const name = $("userName").value.trim();
    const email = $("userEmail").value.trim();
    const password = $("userPassword").value.trim();
    const phone = $("userPhone").value.trim();
    const gender = $("userGender").value;

    if (isLogin) {
      if (!email || !password) {
        showToast("Email va parolni kiriting!", "error");
        return;
      }
      try {
        await signInWithEmailAndPassword(auth, email, password);
        showToast("Muvaffaqiyatli kirdingiz!", "success");
        $("authModal").classList.remove("show");
      } catch {
        showToast("Email yoki parol noto'g'ri!", "error");
      }
    } else {
      if (!name || !email || !password || !phone || !gender) {
        showToast("Barcha maydonlarni to'ldiring!", "error");
        return;
      }
      if (password.length < 6) {
        showToast("Parol kamida 6 ta belgidan iborat bo'lishi kerak!", "error");
        return;
      }

      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

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
          `🆕 Yangi foydalanuvchi\n` +
          `👤 Ism: ${name}\n` +
          `📧 Email: ${email}\n` +
          `📱 Telefon: ${phone}\n` +
          `👥 Jins: ${gender}`
        );

        showToast("Ro'yxatdan muvaffaqiyatli o'tdingiz!", "success");
        $("authModal").classList.remove("show");
      } catch (error) {
        if (error?.code === "auth/email-already-in-use") showToast("Bu email allaqachon ro'yxatdan o'tgan!", "error");
        else showToast("Xatolik yuz berdi!", "error");
      }
    }
  });

  onAuthStateChanged(auth, async (user) => {
    const authLink = $("authLink");
    const cabinetLink = $("cabinetLink");
    const adminLink = $("adminLink");

    if (user) {
      authLink.textContent = "Chiqish";
      cabinetLink.classList.remove("hidden");

      const q = query(collection(db, "users"), where("uid", "==", user.uid));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const userData = querySnapshot.docs[0].data();
        currentUserChatId = user.uid;

        if (userData.isAdmin) adminLink.classList.remove("hidden");
        $("welcomeText").textContent = `Xush kelibsiz, ${userData.name}! Email: ${userData.email}`;
      }

      loadGarage(user.uid);
    } else {
      authLink.textContent = "Kirish";
      cabinetLink.classList.add("hidden");
      adminLink.classList.add("hidden");
      $("cabinet").classList.add("hidden");
      $("adminPanel").classList.add("hidden");
      currentUserChatId = null;
    }
  });

  $("cabinetLink").addEventListener("click", (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (user) {
      $("cabinet").classList.remove("hidden");
      $("cabinet").scrollIntoView({ behavior: "smooth" });
    }
  });

  $("adminLink").addEventListener("click", async (e) => {
    e.preventDefault();
    $("adminPanel").classList.remove("hidden");
    $("adminPanel").scrollIntoView({ behavior: "smooth" });

    const usersSnapshot = await getDocs(collection(db, "users"));
    const usersList = $("allUsersList");
    usersList.innerHTML = "";

    usersSnapshot.forEach(docSnap => {
      const userData = docSnap.data();
      const card = document.createElement("div");
      card.className = "admin-card";
      card.innerHTML = `
        <h4>${userData.name}</h4>
        <p>Email: ${userData.email}</p>
        <p>Telefon: ${userData.phone}</p>
        <p>Jins: ${userData.gender}</p>
        <p>Admin: ${userData.isAdmin ? "Ha" : "Yo'q"}</p>
      `;
      usersList.appendChild(card);
    });

    const carsSnapshot = await getDocs(collection(db, "cars"));
    const carsList = $("allCarsList");
    carsList.innerHTML = "";

    carsSnapshot.forEach(docSnap => {
      const car = docSnap.data();
      const card = document.createElement("div");
      card.className = "admin-card";
      card.innerHTML = `
        <h4>${car.model} (${car.year})</h4>
        <p>Oxirgi moy: ${car.lastOil} km</p>
        <p>Kunlik: ${car.daily} km</p>
      `;
      carsList.appendChild(card);
    });
  });
}

/** =========================
 *  GARAGE (CARS)
 *  ========================= */
function initAddCar() {
  $("addCarBtn").addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!user) {
      showToast("Avval kirish qiling!", "error");
      return;
    }

    const model = $("carModel").value.trim();
    const year = Number.parseInt($("carYearInput").value, 10);
    const lastOil = Number.parseInt($("lastOilKm").value, 10);
    const daily = Number.parseInt($("dailyKm").value, 10);

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
        `🚗 Yangi mashina qo'shildi\n` +
        `🏷 Model: ${model}\n` +
        `📅 Yil: ${year}\n` +
        `🛢 Oxirgi moy: ${lastOil} km\n` +
        `📊 Kunlik: ${daily} km`
      );

      showToast("Mashina qo'shildi!", "success");

      $("carModel").value = "";
      $("carYearInput").value = "";
      $("lastOilKm").value = "";
      $("dailyKm").value = "";
    } catch (e) {
      console.error(e);
      showToast("Xatolik yuz berdi!", "error");
    }
  });
}

function loadGarage(uid) {
  const q = query(collection(db, "cars"), where("userUid", "==", uid), orderBy("createdAt", "desc"));

  onSnapshot(q, (snapshot) => {
    const garage = $("garage");
    garage.innerHTML = "";

    snapshot.forEach((carDoc) => {
      const car = carDoc.data();
      const id = carDoc.id;

      const nextService = car.lastOil + 8000;
      const daysLeft = Math.ceil((nextService - car.lastOil) / car.daily);
      const statusColor = daysLeft < 10 ? "var(--red)" : "var(--green)";

      const card = document.createElement("div");
      card.className = "cabinet-card";
      card.innerHTML = `
        <h4>${car.model} (${car.year})</h4>
        <p style="margin: 5px 0;">Oxirgi moy: ${Number(car.lastOil).toLocaleString()} km</p>
        <p style="margin: 5px 0;">Keyingi servis: ${Number(nextService).toLocaleString()} km</p>
        <p style="margin: 5px 0;">Kunlik: ${car.daily} km</p>
        <p style="margin: 10px 0; color: ${statusColor}; font-weight: 600;">
          ${daysLeft > 0 ? `⏱ ~${daysLeft} kun qoldi` : "⚠️ Servis vaqti keldi!"}
        </p>
        <button class="btn btn-danger btn-small" data-id="${id}" style="margin-top: 10px;">O'chirish</button>
      `;

      garage.appendChild(card);

      card.querySelector(".btn-danger").addEventListener("click", async function() {
        if (confirm("Mashinani o'chirmoqchimisiz?")) {
          try {
            await deleteDoc(doc(db

