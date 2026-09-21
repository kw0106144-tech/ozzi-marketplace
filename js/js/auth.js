// ==========================================
// OZZI AUTHENTICATION
// ==========================================

let supabaseClient = null;


// ==========================================
// INITIALIZE SUPABASE
// ==========================================

function initializeSupabase() {

    if (
        typeof window.supabase === "undefined" ||
        typeof SUPABASE_URL === "undefined" ||
        typeof SUPABASE_ANON_KEY === "undefined"
    ) {
        console.error("Supabase configuration is missing.");
        return false;
    }

    supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY
    );

    return true;
}


// ==========================================
// MESSAGE HELPER
// ==========================================

function showMessage(elementId, message, type = "error") {

    const element = document.getElementById(elementId);

    if (!element) {
        return;
    }

    element.textContent = message;
    element.className = `auth-message ${type}`;
}


// ==========================================
// REGISTER
// ==========================================

async function registerUser(event) {

    event.preventDefault();

    if (!initializeSupabase()) {
        showMessage(
            "registerMessage",
            "حدث خطأ في إعداد الاتصال."
        );
        return;
    }


    const name =
        document.getElementById("registerName").value.trim();

    const phone =
        document.getElementById("registerPhone").value.trim();

    const countryCode =
        document.getElementById("registerCountry").value;

    const email =
        document.getElementById("registerEmail").value.trim();

    const password =
        document.getElementById("registerPassword").value;

    const confirmPassword =
        document.getElementById("registerPasswordConfirm").value;

    const button =
        document.getElementById("registerButton");


    // ------------------------------
    // VALIDATION
    // ------------------------------

    if (!name || !phone || !countryCode || !email || !password) {

        showMessage(
            "registerMessage",
            "من فضلك أكمل جميع البيانات."
        );

        return;
    }


    if (password.length < 8) {

        showMessage(
            "registerMessage",
            "كلمة المرور يجب أن تكون 8 أحرف على الأقل."
        );

        return;
    }


    if (password !== confirmPassword) {

        showMessage(
            "registerMessage",
            "كلمتا المرور غير متطابقتين."
        );

        return;
    }


    button.disabled = true;
    button.textContent = "جاري إنشاء الحساب...";


    try {

        // --------------------------------
        // FIND COUNTRY
        // --------------------------------

        const {
            data: country,
            error: countryError
        } = await supabaseClient
            .from("countries")
            .select("id, code")
            .eq("code", countryCode)
            .single();


        if (countryError || !country) {

            throw new Error(
                "تعذر العثور على الدولة."
            );
        }


        // --------------------------------
        // CREATE AUTH ACCOUNT
        // --------------------------------

        const {
            data,
            error
        } = await supabaseClient.auth.signUp({

            email: email,

            password: password,

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


        // --------------------------------
        // SUCCESS
        // --------------------------------

        showMessage(
            "registerMessage",
            "تم إنشاء الحساب بنجاح! جاري تحويلك...",
            "success"
        );


        setTimeout(() => {

            window.location.href = "index.html";

        }, 1200);


    } catch (error) {

        console.error(error);

        let message =
            "حدث خطأ أثناء إنشاء الحساب.";


        if (error.message) {

            if (
                error.message
                    .toLowerCase()
                    .includes("already registered")
            ) {

                message =
                    "هذا البريد الإلكتروني مسجل بالفعل.";

            } else {

                message = error.message;

            }

        }


        showMessage(
            "registerMessage",
            message
        );


    } finally {

        button.disabled = false;
        button.textContent = "إنشاء الحساب";

    }

}


// ==========================================
// LOGIN
// ==========================================

async function loginUser(event) {

    event.preventDefault();

    if (!initializeSupabase()) {

        showMessage(
            "loginMessage",
            "حدث خطأ في إعداد الاتصال."
        );

        return;
    }


    const email =
        document.getElementById("loginEmail").value.trim();

    const password =
        document.getElementById("loginPassword").value;


    const button =
        document.getElementById("loginButton");


    if (!email || !password) {

        showMessage(
            "loginMessage",
            "من فضلك أدخل البريد الإلكتروني وكلمة المرور."
        );

        return;
    }


    button.disabled = true;
    button.textContent = "جاري تسجيل الدخول...";


    try {

        const {
            data,
            error
        } = await supabaseClient.auth.signInWithPassword({

            email: email,

            password: password

        });


        if (error) {
            throw error;
        }


        showMessage(
            "loginMessage",
            "تم تسجيل الدخول بنجاح! جاري تحويلك...",
            "success"
        );


        setTimeout(() => {

            window.location.href = "index.html";

        }, 800);


    } catch (error) {

        console.error(error);

        let message =
            "البريد الإلكتروني أو كلمة المرور غير صحيحة.";


        if (error.message) {

            if (
                error.message
                    .toLowerCase()
                    .includes("invalid login credentials")
            ) {

                message =
                    "البريد الإلكتروني أو كلمة المرور غير صحيحة.";

            } else {

                message = error.message;

            }

        }


        showMessage(
            "loginMessage",
            message
        );


    } finally {

        button.disabled = false;
        button.textContent = "تسجيل الدخول";

    }

}


// ==========================================
// LOGOUT
// ==========================================

async function logoutUser() {

    if (!initializeSupabase()) {
        return;
    }

    const {
        error
    } = await supabaseClient.auth.signOut();


    if (error) {

        console.error(
            "Logout error:",
            error
        );

        return;
    }


    window.location.href = "login.html";
}


// ==========================================
// GET CURRENT USER
// ==========================================

async function getCurrentUser() {

    if (!initializeSupabase()) {
        return null;
    }

    const {
        data,
        error
    } = await supabaseClient.auth.getUser();


    if (error) {

        console.error(error);

        return null;
    }


    return data.user;
}


// ==========================================
// PAGE INITIALIZATION
// ==========================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        // Register page

        const registerForm =
            document.getElementById("registerForm");

        if (registerForm) {

            registerForm.addEventListener(
                "submit",
                registerUser
            );

        }


        // Login page

        const loginForm =
            document.getElementById("loginForm");

        if (loginForm) {

            loginForm.addEventListener(
                "submit",
                loginUser
            );

        }

    }
);
