# Khabarnama360 (خبرنامہ 360)

A modern, production-oriented bilingual digital news, public information directory, education examination results platform, live sports portal, financial rates service, Islamic resources suite, and everyday citizen tools web application.

---

## 1. Project Overview & Architecture

- **Working Project Name:** Khabarnama360 (خبرنامہ 360)
- **Target Audience:** Pakistani citizens and overseas diaspora worldwide.
- **Languages Supported:**
  - **English:** Left-to-Right (LTR) interface with clean editorial typography.
  - **Urdu:** Right-to-Left (RTL) interface with Noto Nastaliq Urdu typography.
- **Frontend Framework:** React 19 SPA with Tailwind CSS v4, Motion, Lucide icons.
- **Backend Server:** Express.js running on Node.js / `tsx server.ts` with Vite middlewares mounted in dev.
- **Database & Persistence:** Production filesystem-backed JSON database (`data/portal_database.json`) with transactions, audit logs, and rich Pakistani seed datasets.
- **AI Integration:** Google Gemini (`gemini-3.8-flash` via `@google/genai`) on the server for editorial assistance (headline generator, auto-translation draft, SEO meta descriptions) and semantic reader inquiry grounding.

---

## 2. Implemented Modules Checklist

| Module | Status | Features Included |
| :--- | :---: | :--- |
| **A. News & Articles** | ✅ Complete | Latest, Breaking, Pakistan, Politics, Business, Tech, World; full article detail view with font size controls, audio simulation, reader comments, and WhatsApp/FB sharing. |
| **B. Bilingual System** | ✅ Complete | Dynamic RTL/LTR switching, persistent language choice, Urdu Nastaliq typography, bilingual search query normalization. |
| **C. Education Hub** | ✅ Complete | 10 BISE educational boards (Lahore, Karachi, Islamabad FBISE, Rawalpindi, Peshawar, etc.), live roll number search, official marks certificate breakdown with print mode. |
| **D. Weather & AQI** | ✅ Complete | Major cities (Karachi, Lahore, Islamabad, Peshawar, Quetta), AQI smog indicators, hourly forecast, 5-day outlook, sunrise/sunset times. |
| **E. Business & Finance** | ✅ Complete | 24K, 22K, 21K, 18K Gold & Silver rates (per tola & 10g), Open market & interbank currencies (USD, SAR, AED, GBP, EUR), interactive currency converter, POL fuel prices (Petrol/Diesel), PSX KSE-100 index with top gainers/losers. |
| **F. Cricket & Sports** | ✅ Complete | Live cricket match card, tournament fixtures, ball-by-ball overview, star player profiles (Babar Azam, Shaheen Afridi, Rizwan). |
| **G. Islamic Resources** | ✅ Complete | Daily prayer times for all major cities (Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha), Sehri & Iftar timetable, Hijri calendar 1447 AH, interactive Zakat calculator in PKR based on silver nisab, verified daily Duas. |
| **H. Mobiles & Tech** | ✅ Complete | Pakistani smartphone directory with PKR prices (Samsung, Apple, Xiaomi, Infinix), full specifications, and side-by-side device comparison tool. |
| **I. Cars & Bikes** | ✅ Complete | Automobile & motorbike directory (Civic, Corolla, Alto, YBR 125, CD70), engine cc, transmission, fuel mileage (km/l), and on-road prices. |
| **J. Prize Bonds** | ✅ Complete | Rs. 100, 200, 750, 1500, 25000, 40000 official draw schedules, 1st/2nd/3rd prize amounts, and instant 6-digit number checker. |
| **K. Dictionary & Names** | ✅ Complete | English ↔ Urdu dictionary with Roman Urdu transliterations, plus Islamic baby boy & girl names directory with meanings and lucky numbers. |
| **L. Poetry & Literature** | ✅ Complete | Ghazals and Nazms by Allama Iqbal, Mirza Ghalib, and Faiz Ahmad Faiz in Nastaliq script with poetic English translations. |
| **M. Authentic Recipes** | ✅ Complete | Traditional Pakistani dishes (Karachi Chicken Dum Biryani, Lahori Highway Mutton Karahi) with ingredient checklists and step-by-step bilingual cooking steps. |
| **N. Online Utilities** | ✅ Complete | Pakistan electricity bill estimator (NEPRA slabs, FPA & 18% GST for LESCO, K-Electric, FESCO), precise age calculator, BMI health index, academic percentage calculator, and car/bank loan EMI estimator. |
| **O. Career & Jobs** | ✅ Complete | Federal & Provincial Government jobs (FPSC, PPSC, State Bank of Pakistan, IT Software firms) with eligibility criteria, vacancies, and application deadlines. |
| **P. Digital E-Paper** | ✅ Complete | Interactive newspaper broadsheet viewer with page flipping, zoom in/out, and date selector. |
| **Q. Editorial CMS Admin** | ✅ Complete | Role switcher (Super Admin, Editor, Reporter, Contributor), article CRUD, dual-language tabs, Gemini AI tools (Headline, Auto-translate, SEO), site branding config, and security audit logs. |
| **R. Unified Search** | ✅ Complete | Global search with Roman Urdu keyword normalization (`khabar` -> `news`, `sona` -> `gold`, `imtihan` -> `result`). |

---

## 3. Environment Variables

Defined in `.env.example`:
```env
# GEMINI_API_KEY: Injected automatically by AI Studio for Gemini AI features.
GEMINI_API_KEY="MY_GEMINI_API_KEY"

# APP_URL: Current service URL
APP_URL="MY_APP_URL"
```

---

## 4. Running & Deployment

### Development
```bash
npm run dev
# Launches full-stack Express server at http://0.0.0.0:3000 with Vite middleware
```

### Production Build
```bash
npm run build
npm start
```
