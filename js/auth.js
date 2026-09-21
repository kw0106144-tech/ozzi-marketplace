/* =========================================
   OZZI - Authentication
   Supabase Auth + public.users
========================================= */

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

/* ---------- Helpers ---------- */

function showMessage(message, type = "error") {
  const box = document.getElementById("message");

  if (!box) {
    alert(message);
    return;
  }

  box.textContent = message;
  box.className = `message ${type}`;
  box.style.display = "block";
}

function setLoading(button, loading, normalText) {
  if (!button) return;

  button.disabled = loading;
  button.textContent = loading ? "جاري التنفيذ..." : normalText;
}

/* ---------- Register ---------- */

async function registerUser(event) {
  event.preventDefault();

  const form = event.target;
  const button = form.querySelector('button[type="submit"]');

  const name = document.getElementById("name")?.value.trim();
  const phone = document.getElementById("phone")?.value.trim();
  const countryCode = document.getElementById("country")?.value;
  const email = document.getElementById("email")?.value.trim().toLowerCase();
  const password = document.getElementById("password")?.value;
  const confirmPassword =
    document.getElementById("confirmPassword")?.value;

  if (!name || !phone || !countryCode || !email || !password || !confirmPassword) {
    showMessage("من فضلك أكمل جميع البيانات.");
    return;
  }

  if (password.length < 6) {
    showMessage("كلمة المرور يجب أن تكون 6 أحرف على الأقل.");
    return;
  }

  if (password !== confirmPassword) {
    showMessage("كلمتا المرور غير متطابقتين.");
    return;
  }

  setLoading(button, true, "إنشاء حساب");

  try {
    /* Get selected country */
    const { data: country, error: countryError } =
      await supabaseClient
        .from("countries")
        .select("id, code, name_ar, name_en, currency_code, currency_symbol")
        .eq("code", countryCode)
        .single();

    if (countryError || !country) {
      throw new Error("الدولة المختارة غير موجودة.");
    }

    /* Create Supabase Auth user.
       The trigger saves this metadata into public.users. */
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          phone: phone,
          country_id: country.id
        }
      }
    });

    if (error) {
      throw error;
    }

    if (!data.user) {
      throw new Error("تعذر إنشاء الحساب. حاول مرة أخرى.");
    }

    showMessage("تم إنشاء حسابك بنجاح. جاري تحويلك...", "success");

    setTimeout(() => {
      window.location.href = "index.html";
    }, 900);

  } catch (error) {
    console.error("OZZI Register Error:", error);

    let message = error.message || "حدث خطأ أثناء إنشاء الحساب.";

    if (message.toLowerCase().includes("already registered")) {
      message = "هذا البريد الإلكتروني مسجل بالفعل.";
    }

    if (message.toLowerCase().includes("password")) {
      message = "كلمة المرور غير صالحة. استخدم 6 أحرف على الأقل.";
    }

    showMessage(message);

  } finally {
    setLoading(button, false, "إنشاء حساب");
  }
}

/* ---------- Login ---------- */

async function loginUser(event) {
  event.preventDefault();

  const form = event.target;
  const button = form.querySelector('button[type="submit"]');

  const email = document.getElementById("email")?.value.trim().toLowerCase();
  const password = document.getElementById("password")?.value;

  if (!email || !password) {
    showMessage("أدخل البريد الإلكتروني وكلمة المرور.");
    return;
  }

  setLoading(button, true, "تسجيل الدخول");

  try {
    const { data, error } =
      await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

    if (error) {
      throw error;
    }

    if (!data.user) {
      throw new Error("تعذر تسجيل الدخول.");
    }

    showMessage("تم تسجيل الدخول بنجاح.", "success");

    setTimeout(() => {
      window.location.href = "index.html";
    }, 700);

  } catch (error) {
    console.error("OZZI Login Error:", error);

    let message = "البريد الإلكتروني أو كلمة المرور غير صحيحة.";

    if (error.message?.toLowerCase().includes("email not confirmed")) {
      message = "يجب تأكيد البريد الإلكتروني أولًا.";
    }

    showMessage(message);

  } finally {
    setLoading(button, false, "تسجيل الدخول");
  }
}

/* ---------- Logout ---------- */

async function logoutUser() {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    console.error("OZZI Logout Error:", error);
    return;
  }

  window.location.href = "index.html";
}

/* ---------- Current User ---------- */

async function getCurrentUser() {
  const {
    data: { user }
  } = await supabaseClient.auth.getUser();

  return user;
}

/* ---------- Current Public Profile ---------- */

async function getCurrentProfile() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabaseClient
    .from("users")
    .select(`
      id,
      auth_id,
      email,
      full_name,
      phone,
      role,
      country_id,
      countries (
        code,
        name_ar,
        name_en,
        currency_code,
        currency_symbol
      )
    `)
    .eq("auth_id", user.id)
    .single();

  if (error) {
    console.error("OZZI Profile Error:", error);
    return null;
  }

  return data;
}

/* ---------- Header State ---------- */

async function updateHeaderAuth() {
  const user = await getCurrentUser();

  const loginLink = document.querySelector('[data-auth="login"]');
  const registerLink = document.querySelector('[data-auth="register"]');
  const accountLink = document.querySelector('[data-auth="account"]');
  const logoutButton = document.querySelector('[data-auth="logout"]');

  if (user) {
    if (loginLink) loginLink.style.display = "none";
    if (registerLink) registerLink.style.display = "none";
    if (accountLink) accountLink.style.display = "inline-flex";
    if (logoutButton) logoutButton.style.display = "inline-flex";
  } else {
    if (loginLink) loginLink.style.display = "inline-flex";
    if (registerLink) registerLink.style.display = "inline-flex";
    if (accountLink) accountLink.style.display = "none";
    if (logoutButton) logoutButton.style.display = "none";
  }
}

/* ---------- Form Events ---------- */

document.addEventListener("DOMContentLoaded", () => {
  const registerForm = document.getElementById("registerForm");
  const loginForm = document.getElementById("loginForm");

  if (registerForm) {
    registerForm.addEventListener("submit", registerUser);
  }

  if (loginForm) {
    loginForm.addEventListener("submit", loginUser);
  }

  updateHeaderAuth();
});

/* ---------- Auth State ---------- */

supabaseClient.auth.onAuthStateChange((event, session) => {
  console.log("OZZI Auth:", event);

  if (event === "SIGNED_OUT") {
    updateHeaderAuth();
  }
});
