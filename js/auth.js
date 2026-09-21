/* OZZI Authentication - fixed field IDs */

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

function showMessage(message, type = "error", elementId = "registerMessage") {
  const box = document.getElementById(elementId);
  if (!box) {
    alert(message);
    return;
  }
  box.textContent = message;
  box.className = `auth-message ${type}`;
  box.style.display = "block";
}

function setLoading(button, loading, normalText) {
  if (!button) return;
  button.disabled = loading;
  button.textContent = loading ? "جاري التنفيذ..." : normalText;
}

async function registerUser(event) {
  event.preventDefault();

  const button = document.getElementById("registerButton");
  const name = document.getElementById("registerName")?.value.trim();
  const phone = document.getElementById("registerPhone")?.value.trim();
  const countryCode = document.getElementById("registerCountry")?.value;
  const email = document.getElementById("registerEmail")?.value.trim().toLowerCase();
  const password = document.getElementById("registerPassword")?.value;
  const confirmPassword = document.getElementById("registerPasswordConfirm")?.value;

  if (!name || !phone || !countryCode || !email || !password || !confirmPassword) {
    showMessage("من فضلك أكمل جميع البيانات.", "error", "registerMessage");
    return;
  }

  if (password.length < 8) {
    showMessage("كلمة المرور يجب أن تكون 8 أحرف على الأقل.", "error", "registerMessage");
    return;
  }

  if (password !== confirmPassword) {
    showMessage("كلمتا المرور غير متطابقتين.", "error", "registerMessage");
    return;
  }

  setLoading(button, true, "إنشاء الحساب");

  try {
    const { data: country, error: countryError } = await supabaseClient
      .from("countries")
      .select("id, code, name_ar, name_en, currency_code, currency_symbol")
      .eq("code", countryCode)
      .single();

    if (countryError || !country) {
      throw new Error("الدولة المختارة غير موجودة.");
    }

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

    if (error) throw error;
    if (!data.user) throw new Error("تعذر إنشاء الحساب. حاول مرة أخرى.");

    showMessage("تم إنشاء حسابك بنجاح. جاري تحويلك...", "success", "registerMessage");

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
      message = "كلمة المرور غير صالحة. استخدم 8 أحرف على الأقل.";
    }

    showMessage(message, "error", "registerMessage");
  } finally {
    setLoading(button, false, "إنشاء الحساب");
  }
}

async function loginUser(event) {
  event.preventDefault();

  const button = document.getElementById("loginButton");
  const email = document.getElementById("loginEmail")?.value.trim().toLowerCase();
  const password = document.getElementById("loginPassword")?.value;

  if (!email || !password) {
    showMessage("أدخل البريد الإلكتروني وكلمة المرور.", "error", "loginMessage");
    return;
  }

  setLoading(button, true, "تسجيل الدخول");

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    if (!data.user) throw new Error("تعذر تسجيل الدخول.");

    showMessage("تم تسجيل الدخول بنجاح. جاري التحويل...", "success", "loginMessage");

    setTimeout(() => {
      window.location.href = "index.html";
    }, 700);

  } catch (error) {
    console.error("OZZI Login Error:", error);

    let message = "البريد الإلكتروني أو كلمة المرور غير صحيحة.";

    if (error.message?.toLowerCase().includes("email not confirmed")) {
      message = "يجب تأكيد البريد الإلكتروني أولًا.";
    }

    showMessage(message, "error", "loginMessage");
  } finally {
    setLoading(button, false, "تسجيل الدخول");
  }
}

async function logoutUser() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    console.error("OZZI Logout Error:", error);
    return;
  }
  window.location.href = "index.html";
}

async function getCurrentUser() {
  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
      console.error("OZZI Session Error:", error);
      return null;
    }
    return data?.session?.user || null;
  } catch (error) {
    console.error("OZZI Session Error:", error);
    return null;
  }
}

async function getCurrentProfile() {
  const user = await getCurrentUser();
  if (!user) return null;

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

async function updateHeaderAuth() {
  const user = await getCurrentUser();

  const loginLink = document.querySelector('[data-auth="login"]');
  const registerLink = document.querySelector('[data-auth="register"]');
  const accountLink = document.querySelector('[data-auth="account"]');
  const logoutButton = document.querySelector('[data-auth="logout"]');

  if (user) {
    if (loginLink) loginLink.style.setProperty("display", "none", "important");
    if (registerLink) registerLink.style.setProperty("display", "none", "important");
    if (accountLink) accountLink.style.setProperty("display", "inline-flex", "important");
    if (logoutButton) logoutButton.style.setProperty("display", "inline-flex", "important");
  } else {
    if (loginLink) loginLink.style.setProperty("display", "inline-flex", "important");
    if (registerLink) registerLink.style.setProperty("display", "inline-flex", "important");
    if (accountLink) accountLink.style.setProperty("display", "none", "important");
    if (logoutButton) logoutButton.style.setProperty("display", "none", "important");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const registerForm = document.getElementById("registerForm");
  const loginForm = document.getElementById("loginForm");

  if (registerForm) registerForm.addEventListener("submit", registerUser);
  if (loginForm) loginForm.addEventListener("submit", loginUser);

  // Always read the real Supabase session when the page opens.
  await updateHeaderAuth();
});

supabaseClient.auth.onAuthStateChange((event) => {
  console.log("OZZI Auth:", event);
  // Keep the header synchronized for login, logout, refresh and initial session.
  setTimeout(() => updateHeaderAuth(), 0);
});
