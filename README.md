# Yangiariq Yuridik Senter — Onlayn test platformasi

React + Vite + Supabase asosida ishlaydigan oddiy va to'liq ishlaydigan test platformasi. Butun interfeys o'zbek tilida.

- Administrator talabalarni va testlarni boshqaradi, ochiq savollarga berilgan javoblarni baholaydi.
- Talabalar tizimga kiradi, vaqt hisoblagichi bilan test topshiradi va natijalarini ko'radi.
- Barcha ma'lumotlar Supabase (Postgres) da saqlanadi va Row Level Security bilan himoyalangan.

---

## 1. Node.js o'rnatish

https://nodejs.org saytidan Node.js 18 yoki undan yangi versiyasini o'rnating.

---

## 2. Supabase loyihasini yaratish

1. https://supabase.com da hisob va yangi loyiha yarating.
2. Loyiha tayyor bo'lgach, **Project Settings > API** bo'limiga kiring:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_ANON_KEY`

`service_role` kalitini hech qachon frontend kodiga qo'ymang.

---

## 3. Ma'lumotlar bazasi sxemasini ishga tushirish

1. Supabase panelida **SQL Editor** ni oching.
2. `supabase/schema.sql` faylining barcha mazmunini nusxalab, tahrirlovchiga joylang va **Run** bosing.

> **Xatolik: "Could not find the 'access' column" yoki "column tests.access does not exist"?** Demak, baza hali yangilanmagan. `supabase/migration_access.sql` faylini SQL Editor'da to'liq ishga tushiring (bir marta Run). U ustunni qo'shadi, mavjud testlarni "Ruxsat berilgan" qiladi va API keshini yangilaydi.

> **v2 yangilanishi (MUHIM):** yangi imkoniyatlar (test jadvali, aralashtirish, reyting, tanlangan talabalarga ruxsat) ishlashi uchun `supabase/migration_v2.sql` faylini SQL Editor'da bir marta to'liq ishga tushiring. Qayta ishga tushirsangiz ham xavfsiz, ma'lumotlar o'chmaydi. Yangi o'rnatishda buni `schema.sql` o'zi bajaradi.

> **Talaba parollarini ko'rish uchun** (admin → Talabalar → talaba profili) `supabase/migration_student_passwords.sql` faylini ham SQL Editor'da bir marta ishga tushiring. Parollar oddiy matn ko'rinishida saqlanadi va faqat administrator o'qiy oladi.

> **v3 yangilanishi (MUHIM):** profil, parolni o'zgartirish, "Yangi natija" belgisi va e'lonlar ishlashi uchun `supabase/migration_v3.sql` faylini SQL Editor'da bir marta to'liq ishga tushiring. Qayta ishga tushirsangiz ham xavfsiz, ma'lumotlar o'chmaydi.

> **Eski baza uchun (yangilash):** agar ilovani avval ishlatgan bo'lsangiz, shu `schema.sql` faylini yana bir marta to'liq ishga tushiring. Fayl qayta ishga tushirilganda ma'lumotlarni o'chirmaydi: testlar jadvaliga `access` (kirish huquqi) ustunini qo'shadi va yangi qoidalarni o'rnatadi. **Mavjud testlar avtomatik "Ruxsat berilgan" holatda qoladi**, ya'ni talabalarga ko'rinishda davom etadi.

---

## 4. Muhit o'zgaruvchilarini sozlash

```bash
cp .env.example .env
```

`.env` faylini oching va 2-qadamdagi ikki qiymatni yozing:

```
VITE_SUPABASE_URL=https://SIZNING-LOYIHANGIZ.supabase.co
VITE_SUPABASE_ANON_KEY=SIZNING-ANON-KALITINGIZ
```

---

## 5. Administrator hisobini yaratish

1. Supabase'da **Authentication > Providers > Email** bo'limida "Confirm email" ni **o'chiring**.
2. **Authentication > Users** bo'limida **Add user** bosing:
   - Email: `admin@testplatform-users.com`
   - Parol: o'zingiz belgilagan parol
   - "Auto Confirm User" ni **yoqing**
3. Yaratilgan foydalanuvchining **User UID** qiymatini nusxalang.
4. **SQL Editor** da quyidagini ishga tushiring (UID ni almashtiring):

```sql
insert into public.profiles (id, username, role)
values ('UID-NI-SHU-YERGA-QOYING', 'admin', 'admin');
```

Endi ilovaga foydalanuvchi nomi `admin` va o'zingiz belgilagan parol bilan kirasiz.

> Eslatma: ilova ichkarida foydalanuvchi nomini `nom@testplatform-users.com` ko'rinishidagi emailga aylantiradi (Supabase Auth email talab qilgani uchun). Foydalanuvchi buni ko'rmaydi.

---

## 6. Talabalarni yaratish uchun Edge Function

Talabalar `create-student` Edge Function orqali yaratiladi. Uni Supabase'ga yuklang:

```bash
npx supabase login
npx supabase link --project-ref SIZNING-PROJECT-REF
npx supabase functions deploy create-student
npx supabase functions deploy set-student-password
```

Funksiya kodini o'zgartirsangiz (masalan, xabarlar tarjimasi), shu buyruq bilan qayta yuklash kerak.

---

## 7. Lokal ishga tushirish

```bash
npm install
npm run dev
```

Chop etilgan manzilni (odatda `http://localhost:5173`) oching va administrator sifatida kiring.

---

## 8. Ilovadan foydalanish

**Administrator:**
- **Talabalar** — foydalanuvchi nomi va parol kiriting, "Talabani saqlash" bosing. Talabaning nomi yoki **"Profil"** tugmasini bosing: butun vaqt bo'yicha umumiy foiz, yakunlangan testlar soni, barcha urinishlar va natijalar (har biri uchun "Ko'rish" / "Baholash") ko'rinadi. Profilda **"Parolni ko'rish"** tugmasi talaba parolini ko'rsatadi, **"Parolni o'zgartirish"** esa yangi parol o'rnatadi. Parollar saqlanishi qo'shilishidan oldin yaratilgan talabalar uchun parol ko'rinmaydi: yangi parol o'rnatsangiz, keyin uni ko'ra olasiz.
- **Testlar** — test JSON'ini joylang va "Testni import qilish" bosing. "Test nomi" va "Davomiyligi (daqiqa)" maydonlari bo'sh bo'lsa, JSON ichidagi `testTitle` va `durationMinutes` olinadi; to'ldirilsa, maydondagi qiymat ustun turadi.
  - **Qalam belgisi (test nomi oldida)** — testni tahrirlash: nom, davomiylik va savollar (JSON). Testni allaqachon topshirgan talabalar bo'lsa, ogohlantirish chiqadi.
  - **Axlat qutisi belgisi** — testni o'chirish (tasdiqlash so'raladi).
  - **Import qilingan test avval "Yopiq" bo'ladi** va talabalarga ko'rinmaydi.
  - **Ruxsat berish** — test barcha talabalarga ko'rinadi va istagancha marta topshirish mumkin.
  - **Bir martalik** — test barcha talabalarga ko'rinadi, lekin har bir talaba uni topshirgach, bu test uning ro'yxatidan yo'qoladi (natijasi "Natijalar" bo'limida qoladi).
  - **Ko'rish** — testni talaba hisobisiz ko'rib chiqish: barcha savollar, variantlar va to'g'ri javoblar. Hech narsa yechilmaydi va saqlanmaydi. "Javoblarni yashirish" tugmasi testni talaba ko'radigan ko'rinishda ko'rsatadi; chap / o'ng strelka va "Barcha savollar" ham ishlaydi.
  - **Yopish** — testni yana talabalardan yashiradi. Testni allaqachon topshirgan talabalar o'z natijalarini ko'rishda davom etadi.
- **Natijalar** — barcha topshirilgan urinishlar. **"Filtr"** tugmasi orqali test bo'yicha (ro'yxatda yopiq va bir martalik testlar ham bor), talaba nomi bo'yicha va sana oralig'i bo'yicha saralash mumkin. Istalgan urinish uchun **"Ko'rish"** tugmasi talabaning barcha javoblarini savolma-savol ko'rsatadi (to'g'ri javob, talaba javobi, natija). Savollar orasida **chap / o'ng strelka** tugmalari bilan yurish mumkin. "Tekshiruvni kutmoqda" holatidagi urinish uchun "Baholash" tugmasini bosing va har bir ochiq javobni "To'g'ri" yoki "Noto'g'ri" deb belgilang. Barcha javoblar baholangach, yakuniy ball avtomatik hisoblanadi.
- **Bo'sh qoldirilgan ochiq javoblar** adminga ko'rsatilmaydi — ular avtomatik "noto'g'ri" hisoblanadi.

**Yangi imkoniyatlar (hammasi ixtiyoriy):**
- **Testlar ro'yxatida qidiruv** va **bir nechta testni belgilab** birdaniga "Ruxsat berish" / "Bir martalik" / "Yopish".
- **Test nomini bosing** — statistika va undan keyin barcha savollar (to'g'ri javoblar bilan) ochiladi: topshirishlar soni, o'rtacha va eng yuqori natija, eng ko'p xato qilingan savollar va eng yaxshi 10 talaba.
- **Qo'shimcha sozlamalar** (testni tahrirlash sahifasida): savol va variantlarni har bir talaba uchun **aralashtirish**; talabalarga **reytingni ko'rsatish**; testning **ochilish va yopilish vaqti**. Vaqt qo'yilsa, test faqat shu oraliqda boshlanadi (boshlab qo'ygan talaba tugatishda davom etadi).
- **Talabalar bo'limida** talabalarni belgilab, testni tanlang va **"Testga ruxsat berish"** bosing: test faqat shu talabalarga ko'rinadi (holati "Tanlanganlarga"). "Ruxsatni olib tashlash" ham bor.
- **Talaba uchun:** oxirgi 5 daqiqada taymer qizarib ogohlantiradi; topshirishdan oldin javob berilmagan va belgilangan savollar ko'rsatiladi; savolni "qayta ko'rish uchun belgilash" mumkin (savollar oynasida sariq belgi); javoblar shu qurilmada vaqtincha saqlanadi, sahifa yangilansa yo'qolmaydi.

**v3 imkoniyatlari:**
- **E'lon (admin → Testlar, eng tepada):** qisqa xabar yozing (masalan, "Ertaga soat 10:00 da test") va "E'lonni joylash" bosing. Talabalar uni "Testlar" sahifasi tepasida ko'radi. "Olib tashlash" e'lonni yashiradi.
- **Testni vaqt bo'yicha ochish (admin → Testlar → qalam belgisi):** "Test ochiladigan vaqt" bo'limida ochilish va yopilish vaqtini qo'ying (masalan, 02.10.2026 10:00 → 12:00). Test faqat shu oraliqda boshlanadi. Test "Yopiq" bo'lsa, saqlaganda avtomatik "Ruxsat berilgan" ga o'tadi.
- **Profil (talaba, yuqori o'ngdagi odam belgisi):** umumiy foiz, natijalar grafigi, eng zaif testlar va **parolni o'zgartirish**. Yangi parol "Parolni ko'rish" tugmasida ham yangilanadi.
- **Xatolarni qayta ishlash (talaba):** natijani ko'rib chiqishda, xato qilingan savollar bo'lsa, "Xatolarni qayta ishlash" tugmasi chiqadi. Faqat shu savollar qayta beriladi; hech narsa saqlanmaydi, rasmiy natija o'zgarmaydi.
- **Yangi natija:** admin ochiq javoblarni baholab bo'lgach, talabaning "Natijalar" yorlig'ida "Yangi natija" belgisi chiqadi; talaba natijani ochgach yo'qoladi.

**Test JSON formati:**

```json
{
  "testTitle": "Namuna test",
  "durationMinutes": 30,
  "questions": [
    {
      "type": "mcq",
      "question": "2 + 2 nechiga teng?",
      "options": ["3", "4", "5", "6"],
      "correctAnswer": 1
    },
    {
      "type": "open",
      "question": "Quyidagi davlatlarning poytaxtlarini yozing:\n1. Tojikiston\n2. Urugvay\n3. Argentina\n4. Turkiya"
    }
  ]
}
```

- `mcq` uchun `correctAnswer` — `options` ro'yxatidagi to'g'ri variantning indeksi (0 dan boshlanadi).
- `open` savolda `correctAnswer` majburiy emas. Yozilsa, baholash paytida admin uchun namunaviy javob sifatida ko'rsatiladi.
- Savol matnidagi `\n` yangi qatorga o'tkazadi — rasmdan olingan ro'yxatlar va jadvallar shu tarzda chiroyli chiqadi.
- `title` / `duration` nomlari ham qabul qilinadi (`testTitle` / `durationMinutes` o'rniga).

**Talaba:**
- **Testlar** — faqat ruxsat berilgan testlar ko'rinadi, "Testni boshlash" bosing. Vaqt serverda saqlanadi, sahifani yangilash uni tiklamaydi. Test paytida **"Barcha savollar"** tugmasi javob berilgan (yashil) va berilmagan (oq) savollarni ko'rsatadi; istalgan raqamni bosib shu savolga o'tish mumkin. Chap / o'ng strelka tugmalari ham savollarni almashtiradi (javob yozilayotgan matn maydonida strelkalar kursorni siljitadi).
- **Natijalar** — topshirilgan urinishlar. Yakunlangan natijani savolma-savol ko'rib chiqish mumkin. Ko'rib chiqishda **"Barcha savollar"** oynasi to'g'ri javoblarni yashil, noto'g'rilarini qizil, javob berilmaganlarini oq rangda ko'rsatadi. Tekshirilmagan urinishlarda ball ko'rsatilmaydi.

---

## 9. Internetga joylash (Cloudflare Pages)

1. Loyihani GitHub'ga yuklang.
2. https://dash.cloudflare.com > **Workers & Pages > Create > Pages > Connect to Git**.
3. Sozlamalar: Framework preset **Vite**, build command `npm run build`, output directory `dist`.
4. Muhit o'zgaruvchilari: `VITE_SUPABASE_URL` va `VITE_SUPABASE_ANON_KEY`.
5. Deploy bosing.

---

## 10. Loyiha tuzilmasi

```
src/
  components/   Admin va talaba bo'limlari (talabalar, testlar, natijalar, test topshirish)
  pages/        Asosiy sahifalar (Login, AdminPanel, StudentPanel)
  lib/          Supabase klienti, talaba yaratish, sana/bo'sh javob yordamchilari, strelka tugmalari, brend nomi
  App.jsx       Sessiya va yo'naltirish
  styles.css    Oddiy CSS

supabase/
  schema.sql    To'liq sxema va RLS qoidalari
  functions/    create-student va set-student-password Edge Function'lari
```

Ilova nomi (`Yangiariq Yuridik Senter`) `src/lib/brand.js` va `index.html` da saqlanadi.

---

## 11. Ball berish qoidalari

Har bir savol 1 ball, qisman ball yo'q. Test savollari topshirilganda darhol tekshiriladi. Ochiq savollar admin tomonidan baholanadi; bo'sh qoldirilgani avtomatik 0 ball oladi. Yakuniy ball va "Yakunlangan" holati barcha javoblar tekshirilgach o'rnatiladi.
