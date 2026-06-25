const { Bot, Keyboard, InlineKeyboard, session } = require("grammy");
const nedb = require("nedb-promises");
const cron = require("node-cron");
const http = require("http");

// 1. ASOSIY KONFIGURATSIYA VA BAZALARNI INTEGRATSIYA QILISH
const BOT_TOKEN = "8949142604:AAGqrksBXzXZqOiBPIP0EWLHFJPpSX9Tlmk";
const SUPER_ADMIN = 8485164743;

const bot = new Bot(BOT_TOKEN);

const db = {
    users: nedb.create({ filename: "users.db", autoplay: true }),
    rooms: nedb.create({ filename: "rooms.db", autoplay: true }),
    settings: nedb.create({ filename: "settings.db", autoplay: true }),
    requests: nedb.create({ filename: "requests.db", autoplay: true }),
    messages: nedb.create({ filename: "messages.db", autoplay: true }),
    buxgalteriya: nedb.create({ filename: "buxgalteriya.db", autoplay: true })
};

// Veb-server - Render.com doimiy faolligi uchun (Ping tizimi)
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Tinchlik Hostel ERP Professional Server Active!");
}).listen(PORT);

// Session tizimining poydevor mantiqiy strukturalari
bot.use(session({
    initial: () => ({
        step: "idle",
        history: [],
        regData: {},
        currentBranch: null,
        currentRoom: null,
        currentBed: null,
        murojaatData: {},
        adminStateData: {}
    })
}));

// 2. TIZIMNING YORDAMCHI FUNKSIYALARI VA FILTRLARI
async function getSetting(key, defaultVal = null) {
    const s = await db.settings.findOne({ key });
    return s ? s.value : defaultVal;
}

async function setSetting(key, value) {
    await db.settings.update({ key }, { key, value }, { upsert: true });
}

async function isAdmin(userId) {
    if (userId === SUPER_ADMIN) return true;
    const admins = await getSetting("admins_list", []);
    return admins.includes(userId);
}

function formatSum(num) {
    return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// CHAT TOZALIGINI TA'MINLASH TIZIMI (MAKSIMAL SAFE DELETE)
async function safeDelete(ctx, msgId) {
    try {
        await ctx.api.deleteMessage(ctx.chat.id, msgId);
    } catch (e) {}
}

async function renderPage(ctx, text, keyboard = null) {
    if (ctx.message && ctx.message.text !== "/start") {
        try { await ctx.deleteMessage(); } catch (e) {}
    }

    const oldMsgs = await db.messages.find({ chatId: ctx.chat.id });
    for (const m of oldMsgs) {
        await safeDelete(ctx, m.msgId);
    }
    await db.messages.remove({ chatId: ctx.chat.id }, { multi: true });

    const replyMarkup = keyboard ? keyboard : { remove_keyboard: true };
    const newMsg = await ctx.reply(text, { reply_markup: replyMarkup, parse_mode: "HTML" });
    
    if (newMsg) {
        await db.messages.insert({ chatId: ctx.chat.id, msgId: newMsg.message_id });
    }
}

// 3. KLAVIATURA VA MASHRUTLASTRISH TUGMALARI
const backBtn = "⬅️ Ortga Qaytish";

function getMainMenu(isKvartirant = false) {
    const kb = new Keyboard();
    if (isKvartirant) {
        kb.text("📅 Ijara Muddati").text("💵 Toʻlov qilish").row()
          .text("💳 Karta Raqam").text("📜 Qoidalar").row()
          .text("%KEYBOARD_PASSPORT%").text("🛂 Adminga murojat yoʻllash");
    } else {
        kb.text("👤 Roʻyxatdan oʻtish").row()
          .text("🏨 HOSTEL bilan tanishish").row()
          .text("🛂 HOSTEL Qoidalar");
    }
    return kb.resized();
}

function getAdminMenu() {
    return new Keyboard()
        .text("📊 STATISTIKA").text("📜 Qoida sozlash").row()
        .text("🏨 HOSTEL Sozlash").text("👮‍♂️ Admin qoʻshish").row()
        .text("💳 Karta Sozlamalari").text("📢 Xabarnoma").row()
        .text("🏨 HOSTEL tanishuv sozlamalari").row()
        .text("⛅ KUNLIK Toʻlovni sozlash").text("📊 BUXGALTERIYA").row()
        .text("⬅️ Bosh menyu").resized();
}

// 4. DINAMIK GURUHLAR MONITORINGI (/aktiv, /qarz, /arxiv)
bot.command("aktiv", async (ctx) => {
    if (ctx.chat.type === "private") return;
    await setSetting("Aktiv_Guruh", ctx.chat.id);
    await ctx.reply("✅ Ushbu guruh AKTIV kvartirantlar bazasi sifatida sozlandi.");
});

bot.command("qarz", async (ctx) => {
    if (ctx.chat.type === "private") return;
    await setSetting("Qarz_Guruh", ctx.chat.id);
    await ctx.reply("⚠️ Ushbu guruh QARZDORLAR bazasi sifatida sozlandi.");
});

bot.command("arxiv", async (ctx) => {
    if (ctx.chat.type === "private") return;
    await setSetting("Ketgan_Guruh", ctx.chat.id);
    await ctx.reply("❌ Ushbu guruh KETGAN kvartirantlar arxiviga aylantirildi.");
});

// 5. START VA KIRISH FILTRLARI
bot.command("start", async (ctx) => {
    ctx.session = { step: "idle", history: [], regData: {}, currentBranch: null, currentRoom: null, currentBed: null, murojaatData: {}, adminStateData: {} };
    const user = await db.users.findOne({ userId: ctx.from.id });
    
    if (user && (user.status === "aktiv" || user.status === "qarz")) {
        await renderPage(ctx, `Assalomu alaykum ${user.filial} Profilingizga xush kelibsiz...❕`, getMainMenu(true));
    } else {
        await renderPage(ctx, "Assalomu alaykum Tinchlik HOSTEL tizimiga xush kelibsiz!", getMainMenu(false));
    }
});

bot.command("admin", async (ctx) => {
    if (!(await isAdmin(ctx.from.id))) {
        return ctx.reply("Kechirasiz hurmatli foydalanuvchi Siz Admin paneliga kirish huquqiga ega emassiz...!");
    }
    ctx.session.step = "admin_main";
    await renderPage(ctx, "👑 Admin paneliga xush kelibsiz!", getAdminMenu());
});

// 6. MULTI-STEP RO'YXATDAN O'TISH ALGORITMI
bot.on("message:text", async (ctx) => {
    const txt = ctx.message.text;
    const step = ctx.session.step;

    // ORTGA QAYTISH TIZIMI MANTIQI
    if (txt === backBtn) {
        const prev = ctx.session.history.pop();
        if (!prev || prev === "idle") {
            ctx.session.step = "idle";
            const u = await db.users.findOne({ userId: ctx.from.id });
            return await renderPage(ctx, "Bosh menyu", getMainMenu(!!u));
        }
        ctx.session.step = prev;
        if (prev === "reg_fish") return await renderPage(ctx, "1. Foydalanuvchi Familiya Ism Sharifi F.I.SH kiriting:", new Keyboard().text(backBtn).resized());
        if (prev === "reg_birth") return await renderPage(ctx, "2. Kun.Oy.Yil tartibida Tugʻilgan sanasi:", new Keyboard().text(backBtn).resized());
        if (prev === "reg_phone") return await renderPage(ctx, "3. Telefon raqami:", new Keyboard().text(backBtn).resized());
        if (prev === "reg_passport") return await renderPage(ctx, "4. Pasport Seriya Raqami: AD", new Keyboard().text(backBtn).resized());
        if (prev === "reg_jshshir") return await renderPage(ctx, "5. Pasport JSHSHIR Raqami:", new Keyboard().text(backBtn).resized());
        if (prev === "reg_gender") return await renderPage(ctx, "6. Jinsni belgilash:", new Keyboard().text("Erkak").text("Ayol").row().text(backBtn).resized());
        if (prev === "admin_main") return await renderPage(ctx, "👑 Admin paneliga xush kelibsiz!", getAdminMenu());
    }

    if (txt === "👤 Roʻyxatdan oʻtish") {
        ctx.session.step = "reg_fish";
        ctx.session.history.push("idle");
        return await renderPage(ctx, "1. Foydalanuvchi Familiya Ism Sharifi F.I.SH kiriting:", new Keyboard().text(backBtn).resized());
    }

    // REGISTRATSIYA MATNLARI FILTRI
    if (step === "reg_fish") { ctx.session.regData.fish = txt; ctx.session.step = "reg_birth"; ctx.session.history.push("reg_fish"); return await renderPage(ctx, "2. Kun.Oy.Yil tartibida Tugʻilgan sanasini kiriting:", new Keyboard().text(backBtn).resized()); }
    if (step === "reg_birth") { ctx.session.regData.birth = txt; ctx.session.step = "reg_phone"; ctx.session.history.push("reg_birth"); return await renderPage(ctx, "3. Telefon raqamingizni kiriting:", new Keyboard().text(backBtn).resized()); }
    if (step === "reg_phone") { ctx.session.regData.phone = txt; ctx.session.step = "reg_passport"; ctx.session.history.push("reg_phone"); return await renderPage(ctx, "4. Pasport Seriya Raqami: AD formatida kiriting:", new Keyboard().text(backBtn).resized()); }
    if (step === "reg_passport") { ctx.session.regData.passport = txt; ctx.session.step = "reg_jshshir"; ctx.session.history.push("reg_passport"); return await renderPage(ctx, "5. Pasport JSHSHIR Raqamini kiriting:", new Keyboard().text(backBtn).resized()); }
    if (step === "reg_jshshir") { ctx.session.regData.jshshir = txt; ctx.session.step = "reg_gender"; ctx.session.history.push("reg_jshshir"); return await renderPage(ctx, "6. Jinsni belgilash:", new Keyboard().text("Erkak").text("Ayol").row().text(backBtn).resized()); }
    if (step === "reg_gender") {
        if (txt !== "Erkak" && txt !== "Ayol") return;
        ctx.session.regData.gender = txt; ctx.session.step = "reg_selfie"; ctx.session.history.push("reg_gender");
        return await renderPage(ctx, "7. Foydalanuvchi yuzini Selfi Rasmini yuboring:", new Keyboard().text(backBtn).resized());
    }

    // DINAMIK JOYLARENI TANLASH FILTRI
    if (step === "reg_select_viloyat") {
        ctx.session.currentBranch = txt;
        const rooms = await db.rooms.find({ viloyat: txt });
        const filiallar = [...new Set(rooms.map(r => r.filial))];
        const kb = new Keyboard(); filiallar.forEach(f => kb.text(f).row()); kb.text(backBtn);
        ctx.session.step = "reg_select_filial";
        return await renderPage(ctx, "Filialni tanlang:", kb.resized());
    }
    if (step === "reg_select_filial") {
        ctx.session.regData.filial = txt;
        const rooms = await db.rooms.find({ viloyat: ctx.session.currentBranch, filial: txt });
        const xonalar = [...new Set(rooms.map(r => r.xona))];
        const kb = new Keyboard(); xonalar.forEach(x => kb.text(x).row()); kb.text(backBtn);
        ctx.session.step = "reg_select_xona";
        return await renderPage(ctx, "Xonani tanlang:", kb.resized());
    }
    if (step === "reg_select_xona") {
        ctx.session.regData.xona = txt;
        const beds = await db.rooms.find({ viloyat: ctx.session.currentBranch, filial: ctx.session.regData.filial, xona: txt, isFree: true });
        const kb = new Keyboard(); beds.forEach(b => kb.text(b.yotoq).row()); kb.text(backBtn);
        ctx.session.step = "reg_select_yotoq";
        return await renderPage(ctx, "Yotoq oʻrnini tanlang:", kb.resized());
    }
    if (step === "reg_select_yotoq") {
        const target = await db.rooms.findOne({ viloyat: ctx.session.currentBranch, filial: ctx.session.regData.filial, xona: ctx.session.regData.xona, yotoq: txt });
        if (!target) return;
        ctx.session.regData.yotoq = txt;
        ctx.session.regData.oylikNarx = target.oylikNarx;
        ctx.session.regData.kunlikNarx = target.kunlikNarx;

        const kb = new Keyboard().text("Oylik").row();
        const maxKun = await getSetting("kunlik_limit_kun", 10);
        for(let i=1; i<=maxKun; i++) { kb.text(`${i} kun`); if(i%3===0) kb.row(); }
        kb.row().text(backBtn);
        ctx.session.step = "reg_select_tariff";
        return await renderPage(ctx, "Toʻlov turini tanlash (Oylik yoki kunlik):", kb.resized());
    }
    if (step === "reg_select_tariff") {
        ctx.session.regData.tariffType = txt;
        let price = 0; let end = new Date();
        if (txt === "Oylik") {
            price = ctx.session.regData.oylikNarx; end.setMonth(end.getMonth() + 1);
        } else {
            const k = parseInt(txt); price = ctx.session.regData.kunlikNarx * k; end.setDate(end.getDate() + k);
        }
        ctx.session.regData.totalSum = price;
        ctx.session.regData.endDateStr = `${end.getDate()}.${end.getMonth()+1}.${end.getFullYear()}`;

        const kb = new Keyboard().text("💳 Karta orqali").text("💵 Naqd pul bilan").row().text(backBtn);
        ctx.session.step = "reg_pay_method";
        return await renderPage(ctx, `To'lov summasi: ${formatSum(price)} so'm\nIjara muddati: ${ctx.session.regData.endDateStr}\nTo'lov uslubini tanlang:`, kb.resized());
    }
    if (step === "reg_pay_method") {
        if (txt === "💳 Karta orqali") {
            const kNum = await getSetting("karta_raqam", "0000 0000 0000 0000");
            const kName = await getSetting("karta_egasi", "Hali mavjud emas");
            ctx.session.step = "reg_send_chek";
            return await renderPage(ctx, `Karta raqam: <code>${kNum}</code>\nEgasining ismi: ${kName}\n\nIltimos to'lov skrinshotini yuklang:`, new Keyboard().text(backBtn).resized());
        } else if (txt === "💵 Naqd pul bilan") {
            await createRequest(ctx, "naqd");
            ctx.session.step = "idle";
            return await renderPage(ctx, "Soʻrovingiz Adminga yuborildi iltimos Admin javobini kuting.", getMainMenu(false));
        }
    }

    // 7. MULTI-FUNCTIONAL ADMINGA RASMLI MUROJAAT YO'LLASH ALGORITMI
    if (txt === "配送 Adminga murojat yoʻllash" || txt === "🛂 Adminga murojat yoʻllash") {
        ctx.session.step = "murojaat_matn";
        ctx.session.history.push("idle");
        return await renderPage(ctx, "📨 Adminga yo'llamoqchi bo'lgan murojaatingiz (matn) yoki muammo haqida yozib yuboring:", new Keyboard().text(backBtn).resized());
    }
    if (step === "murojaat_matn") {
        ctx.session.murojaatData.text = txt;
        const kb = new Keyboard().text("📸 Rasm biriktirish").row().text("❌ Rasmsiz yuborish").row().text(backBtn);
        ctx.session.step = "murojaat_rasm_opt";
        return await renderPage(ctx, "Muammoga oid rasmli xabar yuklashni xohlaysizmi?", kb.resized());
    }
    if (step === "murojaat_rasm_opt") {
        if (txt === "❌ Rasmsiz yuborish") {
            await sendMurojaatToAdmins(ctx, null);
            ctx.session.step = "idle";
            return await renderPage(ctx, "Murojaatingiz adminga rasmsiz yuborildi.", getMainMenu(true));
        } else if (txt === "📸 Rasm biriktirish") {
            ctx.session.step = "murojaat_get_photo";
            return await renderPage(ctx, "Iltimos, muammoning suratini (rasmini) botga yuboring:", new Keyboard().text(backBtn).resized());
        }
    }

    // KVARTIRANT INTERFEYSI ODDIY TUGMALARI
    if (txt === "💳 Karta Raqam") {
        const kNum = await getSetting("karta_raqam", "0000 0000 0000 0000");
        const kName = await getSetting("karta_egasi", "Hali mavjud emas");
        return await ctx.reply(`💳 Karta raqam: <code>${kNum}</code>\n👤 Egasining ismi: ${kName}`, { parse_mode: "HTML" });
    }
    if (txt === "📜 Qoidalar") {
        const q = await getSetting("hostel_qoidalar_matn", "Qoidalar kiritilmagan.");
        return await ctx.reply(q);
    }
    if (txt === "🏨 HOSTEL bilan tanishish") {
        const t = await getSetting("hostel_tanishuv_matn", "Tanishuv matni yo'q.");
        return await ctx.reply(t);
    }
    if (txt === "📅 Ijara Muddati") {
        const u = await db.users.findOne({ userId: ctx.from.id });
        if(u) return await ctx.reply(`📅 Sizning ijara muddatingiz yakuni: ${u.endDateStr}`);
    }

    // 8. ADMIN CRUD VA DINAMIK BUXGALTERIYA INTERFEYSI
    if (await isAdmin(ctx.from.id)) {
        if (txt === "📊 STATISTIKA") {
            const akt = await db.users.find({ status: "aktiv" });
            const qrz = await db.users.find({ status: "qarz" });
            const rAll = await db.rooms.find({});
            const erkaklar = akt.filter(u => u.gender === "Erkak").length;
            const ayollar = akt.filter(u => u.gender === "Ayol").length;
            const boshYotoq = rAll.filter(r => r.isFree).length;
            let olinmagan = 0; qrz.forEach(q => olinmagan += q.totalSum);
            
            const stat = `📊 HOSTEL STATISTIKASI\n\n👥 Aktiv Kvartirantlar : ${akt.length} ta\nErkaklar — ${erkaklar}\nAyollar   — ${ayollar}\n\n🛏 Boʻsh yotoqlar : ${boshYotoq} ta\n📉 Qarzdorlar soni: ${qrz.length} kishi\n💰 Olinmagan qarzlar: ${formatSum(olinmagan)} so'm`;
            return await renderPage(ctx, stat, getAdminMenu());
        }
        if (txt === "📊 BUXGALTERIYA") {
            const trans = await db.buxgalteriya.find({});
            let jamiDaromad = 0; let jamiXarajat = 0;
            trans.forEach(t => { if(t.type==="daromad") jamiDaromad += t.sum; else jamiXarajat += t.sum; });
            const sofFoyda = jamiDaromad - jamiXarajat;

            const kb = new Keyboard().text("➕ Xarajat kiritish").text("➖ Daromad kiritish").row().text(backBtn);
            ctx.session.step = "admin_buxg_main";
            ctx.session.history.push("admin_main");
            return await renderPage(ctx, `💰 Tinchlik HOSTEL Buxgalteriya Balansi:\n\n🟢 Jami Sof Daromad: ${formatSum(jamiDaromad)} so'm\n🔴 Jami Chiqim/Xarajat: ${formatSum(jamiXarajat)} so'm\n\n💎 Sof Foyda: ${formatSum(sofFoyda)} so'm`, kb.resized());
        }
        if (step === "admin_buxg_main") {
            if (txt === "➕ Xarajat kiritish") {
                ctx.session.step = "add_xarajat_sum";
                return await renderPage(ctx, "Xarajat summasini kiriting (Faqat raqam):", new Keyboard().text(backBtn).resized());
            }
        }
        if (step === "add_xarajat_sum") {
            ctx.session.adminStateData.xSum = parseInt(txt);
            ctx.session.step = "add_xarajat_desc";
            return await renderPage(ctx, "Xarajat maqsadini yozing (Masalan: Svet to'lovi):", new Keyboard().text(backBtn).resized());
        }
        if (step === "add_xarajat_desc") {
            await db.buxgalteriya.insert({ type: "xarajat", sum: ctx.session.adminStateData.xSum, desc: txt, date: new Date() });
            ctx.session.step = "admin_main";
            return await renderPage(ctx, "✅ Xarajat buxgalteriyaga muvaffaqiyatli qo'shildi!", getAdminMenu());
        }
        if (txt === "💳 Karta Sozlamalari") {
            ctx.session.step = "adm_karta_set"; ctx.session.history.push("admin_main");
            return await renderPage(ctx, "Yangi karta ma'lumotlarini yuboring\nFormat: <code>Raqam | Egasining Ismi</code>", new Keyboard().text(backBtn).resized());
        }
        if (step === "adm_karta_set") {
            const sp = txt.split("|"); if(sp.length < 2) return;
            await setSetting("karta_raqam", sp[0].trim()); await setSetting("karta_egasi", sp[1].trim());
            ctx.session.step = "admin_main"; return await renderPage(ctx, "Karta yangilandi!", getAdminMenu());
        }
        if (txt === "🏨 HOSTEL Sozlash") {
            ctx.session.step = "adm_room_add"; ctx.session.history.push("admin_main");
            return await renderPage(ctx, "Yangi yotoq joyini qo'shish formatini yozing:\nFormat: <code>Viloyat | Filial | Xona | Yotoq | OylikNarx | KunlikNarx</code>", new Keyboard().text(backBtn).resized());
        }
        if (step === "adm_room_add") {
            const p = txt.split("|"); if(p.length < 6) return ctx.reply("Format xato!");
            await db.rooms.insert({ viloyat: p[0].trim(), filial: p[1].trim(), xona: p[2].trim(), yotoq: p[3].trim(), oylikNarx: parseInt(p[4]), kunlikNarx: parseInt(p[5]), isFree: true });
            ctx.session.step = "admin_main"; return await renderPage(ctx, "Joy tizimga kiritildi!", getAdminMenu());
        }
        if (txt === "📜 Qoida sozlash") {
            ctx.session.step = "adm_rules_set"; ctx.session.history.push("admin_main");
            return await renderPage(ctx, "Yangi qoidalar matnini yozing:", new Keyboard().text(backBtn).resized());
        }
        if (step === "adm_rules_set") {
            await setSetting("hostel_qoidalar_matn", txt);
            ctx.session.step = "admin_main"; return await renderPage(ctx, "Qoidalar yangilandi!", getAdminMenu());
        }

          // ADMIN TOMONIDAN ESBLATMA KIRITISH AMALI
        if (step === "admin_write_eslatma") {
            const targetId = ctx.session.adminStateData.targetUserId;
            await db.users.update({ userId: targetId }, { $set: { eslatma: txt } });
            
            ctx.session.step = "admin_main";
            await renderPage(ctx, "📌 Eslatma kvartirant anketasiga muvaffaqiyatli yozildi!", getAdminMenu());
            
            // Guruhlardagi anketani sinxron tahrirlash (Dinamik yangilash)
            const u = await db.users.findOne({ userId: targetId });
            const grId = await getSetting("Aktiv_Guruh");
            if (grId && u) {
                const updatedCap = `✅ AKTIV  KVARTIRANT\n\n👤 (F.I.SH) : ${u.fish}\n📅 Tugʻilgan sanasi : ${u.birth}\n🪪 Pasport Seriyasi : ${u.passport}\n🆔 JSHSHIR Raqami : ${u.jshshir}\n📞 Tel Raqami: ${u.phone}\n🚩 Viloyat : ${u.filial}\n🏨 Filial : ${u.filial}\n🚪 Xona : ${u.xona}\n🛏 Yotoq : ${u.yotoq}\n📅 Ijara Muddati : ${u.endDateStr}\n📌 Eslatma : ${txt}`;
                const actionKb = new InlineKeyboard().url("👤 Telegram Profili", `tg://user?id=${targetId}`).row().text("📌 Eslatma kiritish", `eslatma_${targetId}`).text("❌ Kvartirant ketgan", `ketgan_${targetId}`);
                try { await ctx.api.editMessageCaption(grId, ctx.session.adminStateData.groupMsgId, { caption: updatedCap, reply_markup: actionKb }); } catch(e){}
            }
        }
    }
});

// SURATLI XABARLAR MULTIMEDIA MONITORINGI (SELFI & CHEK & SHIKOYAT)
bot.on("message:photo", async (ctx) => {
    const step = ctx.session.step;
    const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;

    if (step === "reg_selfie") {
        ctx.session.regData.selfie = photoId;
        const rooms = await db.rooms.find({});
        const viloyatlar = [...new Set(rooms.map(r => r.viloyat))];
        const kb = new Keyboard(); viloyatlar.forEach(v => kb.text(v).row()); kb.text(backBtn);
        ctx.session.step = "reg_select_viloyat";
        return await renderPage(ctx, "8. Istalgan Viloyatni tanlang:", kb.resized());
    }
    if (step === "reg_send_chek") {
        ctx.session.regData.chek = photoId;
        await createRequest(ctx, "karta");
        ctx.session.step = "idle";
        return await renderPage(ctx, "Soʻrovingiz Adminga yuborildi iltimos Admin javobini kuting.", getMainMenu(false));
    }
    if (step === "murojaat_get_photo") {
        await sendMurojaatToAdmins(ctx, photoId);
        ctx.session.step = "idle";
        return await renderPage(ctx, "Murojaatingiz rasmga asosan barcha adminlarga sinxron yuborildi.", getMainMenu(true));
    }
});

// 9. ADMINGA TO'LOV ARIZALARINI MULTI-MEDIA GROUP SHAKLIDA JO'NATISH
async function createRequest(ctx, type) {
    const rId = "req_" + Date.now();
    const d = ctx.session.regData;
    
    await db.requests.insert({ rId, userId: ctx.from.id, data: d, type, status: "pending", adminMsgIds: [] });
    const admins = [SUPER_ADMIN, ...(await getSetting("admins_list", []))];

    let cap = `🔔 YANGI KVARTIRANT TOʻLOVI\n\n💵 Toʻlov turi : ${type === "karta" ? "💳 Karta orqali" : "💵 Naqd pul bilan"}\n🤝 Toʻlov Summasi : ${formatSum(d.totalSum)} so'm\n👤 (F.I.SH) : ${d.fish}\n📅 Tugʻilgan sanasi : ${d.birth}\n🪪 Pasport Seriyasi : ${d.passport}\n🆔 JSHSHIR Raqami : ${d.jshshir}\n📞 Tel Raqami: ${d.phone}\n🚩 Viloyat : ${ctx.session.currentBranch}\n🏨 Filial : ${d.filial}\n🚪 Xona : ${d.xona}\n🛏 Yotoq : ${d.yotoq}\n📅 Ijara Muddati : ${d.endDateStr}\n📌 Eslatma : -`;
    if(type === "naqd") cap += "\n\n😎 Pulni Qoʻlingizga olgandan soʻng 🤝\n ✅ Tasdiqlang...❕";

    const ikb = new InlineKeyboard().url("👤 Telegram Profili", `tg://user?id=${ctx.from.id}`).row().text("✅ Tasdiqlash", `approve_${rId}`).text("❌ Rad etish", `reject_${rId}`);

    for (const adm of admins) {
        try {
            if (type === "karta" && d.chek) {
                await ctx.api.sendMediaGroup(adm, [{ type: "photo", media: d.selfie }, { type: "photo", media: d.chek }]);
            } else {
                await ctx.api.sendPhoto(adm, d.selfie);
            }
            const m = await ctx.api.sendMessage(adm, cap, { reply_markup: ikb, parse_mode: "HTML" });
            await db.requests.update({ rId }, { $push: { adminMsgIds: { adminId: adm, msgId: m.message_id } } });
        } catch(e) {}
    }
}

// ADMINGA MUTLAQ RASMLI MUROJAAT Yo'LLASH ARXITEKTURASI
async function sendMurojaatToAdmins(ctx, rasmId) {
    const u = await db.users.findOne({ userId: ctx.from.id });
    if (!u) return;

    const mId = "mur_" + Date.now();
    const admins = [SUPER_ADMIN, ...(await getSetting("admins_list", []))];
    
    let cap = `📨 MUROJAT NOMA\n\n👤 (F.I.SH) : ${u.fish}\n📅 Tugʻilgan sanasi : ${u.birth}\n🪪 Pasport Seriyasi : ${u.passport}\n🆔 JSHSHIR Raqami : ${u.jshshir}\n📞 Tel Raqami: ${u.phone}\n🚩 Viloyat : ${u.filial}\n🏨 Filial : ${u.filial}\n🚪 Xona : ${u.xona}\n🛏 Yotoq : ${u.yotoq}\n📅 Ijara Muddati : ${u.endDateStr}\n📌 Eslatma : ${u.eslatma || "-"}\n📨 Murojat noma : ${ctx.session.murojaatData.text}`;

    const ikb = new InlineKeyboard().url("👤 Telegram Profili", `tg://user?id=${ctx.from.id}`).row().text("✅ Murojat noma qabul qilindi", `murack_${mId}`);

    await db.requests.insert({ rId: mId, status: "pending", adminMsgIds: [] });

    for (const adm of admins) {
        try {
            if (rasmId && u.selfie) {
                await ctx.api.sendMediaGroup(adm, [{ type: "photo", media: u.selfie }, { type: "photo", media: rasmId }]);
            } else {
                await ctx.api.sendPhoto(adm, u.selfie);
            }
            const m = await ctx.api.sendMessage(adm, cap, { reply_markup: ikb, parse_mode: "HTML" });
            await db.requests.update({ rId: mId }, { $push: { adminMsgIds: { adminId: adm, msgId: m.message_id } } });
        } catch(e) {}
    }
}

// 10. CALLBACK INLINE TUGMALARINI SINXRON TOZALASH MEXANIZMI
bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    await ctx.answerCallbackQuery();

    if (data.startsWith("approve_")) {
        const id = data.replace("approve_", "");
        const req = await db.requests.findOne({ rId: id });
        if(!req || req.status !== "pending") return;

        // BARCHA ADMINLARDAN XABARNI BIR VAQTDA O'CHIRISH (KONFLIKTSIZ)
        for(const t of req.adminMsgIds) { try { await ctx.api.deleteMessage(t.adminId, t.msgId); } catch(e){} }

        const u = req.data; u.userId = req.userId; u.status = "aktiv"; u.eslatma = "Yo'q";
        await db.users.insert(u);
        
        // BUXGALTERIYAGA DAROMAD SIFATIDA AVTOMATIK YOZISH TIZIMI
        await db.buxgalteriya.insert({ type: "daromad", sum: u.totalSum, desc: `Kvartirant to'lovi: ${u.fish}`, date: new Date() });

        await db.rooms.update({ viloyat: u.filial, filial: u.filial, xona: u.xona, yotoq: u.yotoq }, { $set: { isFree: false } });
        await db.requests.update({ rId: id }, { $set: { status: "approved" } });

        const akId = await getSetting("Aktiv_Guruh");
        if(akId) {
            const cap = `✅ AKTIV  KVARTIRANT\n\n👤 (F.I.SH) : ${u.fish}\n📅 Tugʻilgan sanasi : ${u.birth}\n🪪 Pasport Seriyasi : ${u.passport}\n🆔 JSHSHIR Raqami : ${u.jshshir}\n📞 Tel Raqami: ${u.phone}\n🚩 Viloyat : ${u.filial}\n🏨 Filial : ${u.filial}\n🚪 Xona : ${u.xona}\n🛏 Yotoq : ${u.yotoq}\n📅 Ijara Muddati : ${u.endDateStr}\n📌 Eslatma : ${u.eslatma}`;
            const ikb = new InlineKeyboard().url("👤 Telegram Profili", `tg://user?id=${req.userId}`).row().text("📌 Eslatma kiritish", `eslatma_${req.userId}`).text("❌ Kvartirant ketgan", `ketgan_${req.userId}`);
            await ctx.api.sendPhoto(akId, u.selfie, { caption: cap, reply_markup: ikb });
        }
        await ctx.api.sendMessage(req.userId, "Sizning to'lovingiz tasdiqlandi va a'zolikka qabul qilindingiz!");
    }

    if (data.startsWith("reject_")) {
        const id = data.replace("reject_", "");
        const req = await db.requests.findOne({ rId: id });
        if(!req) return;
        for(const t of req.adminMsgIds) { try { await ctx.api.deleteMessage(t.adminId, t.msgId); } catch(e){} }
        await db.requests.update({ rId: id }, { $set: { status: "rejected" } });
        await ctx.api.sendMessage(req.userId, "Sizning arizangiz yoki to'lovingiz admin tomonidan rad etildi.");
    }

    if (data.startsWith("murack_")) {
        const id = data.replace("murack_", "");
        const req = await db.requests.findOne({ rId: id });
        if(!req) return;
        for(const t of req.adminMsgIds) { try { await ctx.api.deleteMessage(t.adminId, t.msgId); } catch(e){} }
        await db.requests.update({ rId: id }, { $set: { status: "resolved" } });
    }

    // DINAMIK AKTIV, QARZ, ARXIV INTERFAOL TUGMALARI
    if (data.startsWith("eslatma_")) {
        const tId = parseInt(data.replace("eslatma_", ""));
        ctx.session.step = "admin_write_eslatma";
        ctx.session.adminStateData.targetUserId = tId;
        ctx.session.adminStateData.groupMsgId = ctx.callbackQuery.message.message_id;
        await ctx.api.sendMessage(ctx.from.id, "«Kiritmoqchi boʻlgan 📌 Eslatma xabaringizni Chatga yozib yuboring»");
    }

    if (data.startsWith("ketgan_")) {
        const tId = parseInt(data.replace("ketgan_", ""));
        const u = await db.users.findOne({ userId: tId });
        if(!u) return;

        try { await ctx.api.deleteMessage(ctx.chat.id, ctx.callbackQuery.message.message_id); } catch(e){}
        
        await db.users.update({ userId: tId }, { $set: { status: "arxiv", ketganSana: new Date().toLocaleDateString() } });
        await db.rooms.update({ viloyat: u.filial, filial: u.filial, xona: u.xona, yotoq: u.yotoq }, { $set: { isFree: true } });

        const arId = await getSetting("Ketgan_Guruh");
        if (arId) {
            const cap = `⛔️ KETGAN Kvartirant\n\n👤 (F.I.SH) : ${u.fish}\n📅 Tugʻilgan sanasi : ${u.birth}\n🪪 Pasport Seriyasi : ${u.passport}\n🆔 JSHSHIR Raqami : ${u.jshshir}\n📞 Tel Raqami: ${u.phone}\n🚩 Viloyat : ${u.filial}\n🏨 Filial : ${u.filial}\n🚪 Xona : ${u.xona}\n🛏 Yotoq : ${u.yotoq}\n📅 Kelgan muddati : ${u.birth}\n📅 Ketgan muddati : ${new Date().toLocaleDateString()}\n📌 Eslatma : ${u.eslatma}`;
            const ikb = new InlineKeyboard().url("👤 Telegram Profili", `tg://user?id=${tId}`).row().text("📌 Eslatma kiritish", `eslatma_${tId}`).text("✅ AKTIV qilish", `reactivate_${tId}`);
            await ctx.api.sendPhoto(arId, u.selfie, { caption: cap, reply_markup: ikb });
        }
    }
});

// 11. CRON JOB: KUNIGA 3 MAHAL AVTOMAT QARZDORLIK MONITORINGI (08:00, 14:00, 20:00)
cron.schedule("0 8,14,20 * * *", async () => {
    const users = await db.users.find({ status: "aktiv" });
    const now = new Date();
    const qGuruh = await getSetting("Qarz_Guruh");
    const admins = [SUPER_ADMIN, ...(await getSetting("admins_list", []))];

    for (const u of users) {
        const [day, month, year] = u.endDateStr.split(".");
        const endData = new Date(year, month - 1, day);
        const diff = Math.ceil((endData.getTime() - now.getTime()) / (1000 * 3600 * 24));

        if (diff <= 3 && diff > 0) {
            const txt = `⚠️ Diqqat! Tinchlik Hostel kvartiranti: ${u.fish} ning ijara muddati tugashiga ${diff} kun qoldi!`;
            try { await bot.api.sendMessage(u.userId, `Ijara muddati tugashiga ${diff} kun qoldi. Iltimos, hisobni yangilang.`); } catch(e){}
            for(const a of admins) { try { await bot.api.sendMessage(a, txt); } catch(e){} }
        } else if (diff <= 0) {
            await db.users.update({ userId: u.userId }, { $set: { status: "qarz" } });
            if (qGuruh) {
                const cap = `⚠️ QARZDOR Kvartirant\n\n👤 (F.I.SH) : ${u.fish}\n📅 Tugʻilgan sanasi : ${u.birth}\n🪪 Pasport Seriyasi : ${u.passport}\n🆔 JSHSHIR Raqami : ${u.jshshir}\n📞 Tel Raqami: ${u.phone}\n🚩 Viloyat : ${u.filial}\n🏨 Filial : ${u.filial}\n🚪 Xona : ${u.xona}\n🛏 Yotoq : ${u.yotoq}\n📅 Muddati tugagan : ${u.endDateStr}\n📌 Eslatma : ${u.eslatma}`;
                const ikb = new InlineKeyboard().url("👤 Telegram Profili", `tg://user?id=${u.userId}`).row().text("📌 Eslatma kiritish", `eslatma_${u.userId}`).text("❌ Kvartirant ketgan", `ketgan_${u.userId}`);
                await bot.api.sendPhoto(qGuruh, u.selfie, { caption: cap, reply_markup: ikb });
            }
        }
    }
});

bot.start();
