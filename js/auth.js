/* OZZI AUTH - single source of truth */
(function () {
  let client = null;

  function getClient() {
    if (!client) {
      if (!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
        throw new Error("Supabase لم يتم تحميله بشكل صحيح.");
      }
      client = window.supabase.createClient(
        window.SUPABASE_URL,
        window.SUPABASE_ANON_KEY,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storageKey: "ozzi-auth"
          }
        }
      );
      window.ozziSupabase = client;
    }
    return client;
  }

  async function updateHeaderAuth() {
    try {
      const sb = getClient();
      const { data, error } = await sb.auth.getSession();
      if (error) throw error;
      const loggedIn = !!data.session;

      document.querySelectorAll('[data-auth="login"], [data-auth="register"]').forEach(el => {
        el.style.setProperty("display", loggedIn ? "none" : "inline-flex", "important");
      });

      document.querySelectorAll('[data-auth="account"], [data-auth="logout"]').forEach(el => {
        el.style.setProperty("display", loggedIn ? "inline-flex" : "none", "important");
      });
    } catch (err) {
      console.error("OZZI AUTH HEADER ERROR:", err);
    }
  }

  async function loginUser(event) {
    event.preventDefault();
    const email = document.getElementById("loginEmail")?.value.trim().toLowerCase();
    const password = document.getElementById("loginPassword")?.value;
    const msg = document.getElementById("loginMessage");
    const btn = document.getElementById("loginButton");

    if (!email || !password) {
      if (msg) msg.textContent = "أدخل البريد الإلكتروني وكلمة المرور.";
      return;
    }

    if (btn) { btn.disabled = true; btn.textContent = "جاري تسجيل الدخول..."; }

    try {
      const { data, error } = await getClient().auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.session) throw new Error("تم تسجيل الدخول لكن لم يتم إنشاء Session.");

      if (msg) {
        msg.textContent = "تم تسجيل الدخول بنجاح...";
        msg.className = "auth-message success";
      }

      window.location.replace("index.html?auth=" + Date.now());
    } catch (error) {
      console.error("OZZI Login Error:", error);
      let message = "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
      if (String(error.message || "").toLowerCase().includes("email not confirmed")) {
        message = "يجب تأكيد البريد الإلكتروني أولًا.";
      }
      if (msg) msg.textContent = message;
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "تسجيل الدخول"; }
    }
  }

  async function registerUser(event) {
    event.preventDefault();

    const name = document.getElementById("registerName")?.value.trim();
    const phone = document.getElementById("registerPhone")?.value.trim();
    const countryCode = document.getElementById("registerCountry")?.value;
    const email = document.getElementById("registerEmail")?.value.trim().toLowerCase();
    const password = document.getElementById("registerPassword")?.value;
    const confirm = document.getElementById("registerPasswordConfirm")?.value;
    const msg = document.getElementById("registerMessage");
    const btn = document.getElementById("registerButton");

    if (!name || !phone || !countryCode || !email || !password || !confirm) {
      if (msg) msg.textContent = "من فضلك أكمل جميع البيانات.";
      return;
    }
    if (password.length < 8) {
      if (msg) msg.textContent = "كلمة المرور يجب أن تكون 8 أحرف على الأقل.";
      return;
    }
    if (password !== confirm) {
      if (msg) msg.textContent = "كلمتا المرور غير متطابقتين.";
      return;
    }

    if (btn) { btn.disabled = true; btn.textContent = "جاري إنشاء الحساب..."; }

    try {
      // لا نعتمد على جدول countries أثناء التسجيل.
      // الدولة تُحفظ كـ country_code داخل user_metadata لتجنب فشل التسجيل
      // بسبب جدول غير موجود أو سياسات RLS على قاعدة البيانات.
      const { data, error } = await getClient().auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            phone,
            country_code: countryCode
          }
        }
      });

      if (error) throw error;
      if (!data.user) throw new Error("تعذر إنشاء الحساب.");

      if (msg) {
        msg.textContent = data.session
          ? "تم إنشاء الحساب وتسجيل الدخول..."
          : "تم إنشاء الحساب. يمكنك الآن تسجيل الدخول.";
        msg.className = "auth-message success";
      }

      if (data.session) {
        window.location.replace("index.html?auth=" + Date.now());
      } else {
        setTimeout(() => window.location.replace("login.html"), 900);
      }
    } catch (error) {
      console.error("OZZI Register Error:", error);
      let message = error.message || "حدث خطأ أثناء إنشاء الحساب.";
      if (String(message).toLowerCase().includes("already registered")) {
        message = "هذا البريد الإلكتروني مسجل بالفعل.";
      }
      if (msg) msg.textContent = message;
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "إنشاء الحساب"; }
    }
  }

  async function logoutUser() {
    try {
      await getClient().auth.signOut();
    } finally {
      window.location.replace("index.html?auth=" + Date.now());
    }
  }

  window.logoutUser = logoutUser;
  window.updateHeaderAuth = updateHeaderAuth;
  window.ozziGetSupabase = getClient;

  document.addEventListener("DOMContentLoaded", () => {
    const rf = document.getElementById("registerForm");
    const lf = document.getElementById("loginForm");
    if (rf) rf.addEventListener("submit", registerUser);
    if (lf) lf.addEventListener("submit", loginUser);

    updateHeaderAuth();

    try {
      getClient().auth.onAuthStateChange(() => {
        setTimeout(updateHeaderAuth, 0);
      });
    } catch (e) {
      console.error(e);
    }
  });
})();