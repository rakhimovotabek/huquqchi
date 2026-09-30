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
- **Talabalar** — foydalanuvchi nomi va parol kiriting, "Talabani saqlash" bosing.
- **Testlar** — test JSON'ini joylang va "Testni import qilish" bosing. "Test nomi" maydoni bo'sh bo'lsa, JSON ichidagi `testTitle` olinadi.
  - **Import qilingan test avval "Yopiq" bo'ladi** va talabalarga ko'rinmaydi.
  - **Ruxsat berish** — test barcha talabalarga ko'rinadi va istagancha marta topshirish mumkin.
  - **Bir martalik** — test barcha talabalarga ko'rinadi, lekin har bir talaba uni topshirgach, bu test uning ro'yxatidan yo'qoladi (natijasi "Natijalar" bo'limida qoladi).
  - **Yopish** — testni yana talabalardan yashiradi. Testni allaqachon topshirgan talabalar o'z natijalarini ko'rishda davom etadi.
- **Natijalar** — barcha topshirilgan urinishlar. Istalgan urinish uchun **"Ko'rish"** tugmasi talabaning barcha javoblarini savolma-savol ko'rsatadi (to'g'ri javob, talaba javobi, natija). Savollar orasida **chap / o'ng strelka** tugmalari bilan yurish mumkin. "Tekshiruvni kutmoqda" holatidagi urinish uchun "Baholash" tugmasini bosing va har bir ochiq javobni "To'g'ri" yoki "Noto'g'ri" deb belgilang. Barcha javoblar baholangach, yakuniy ball avtomatik hisoblanadi.
- **Bo'sh qoldirilgan ochiq javoblar** adminga ko'rsatilmaydi — ular avtomatik "noto'g'ri" hisoblanadi.

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
  functions/    create-student Edge Function
```

Ilova nomi (`Yangiariq Yuridik Senter`) `src/lib/brand.js` va `index.html` da saqlanadi.

---

## 11. Ball berish qoidalari

Har bir savol 1 ball, qisman ball yo'q. Test savollari topshirilganda darhol tekshiriladi. Ochiq savollar admin tomonidan baholanadi; bo'sh qoldirilgani avtomatik 0 ball oladi. Yakuniy ball va "Yakunlangan" holati barcha javoblar tekshirilgach o'rnatiladi.
