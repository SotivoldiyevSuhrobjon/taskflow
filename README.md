# Taskflow — Real-time Task & Notification System

Foydalanuvchilar bir-biriga vazifa biriktiradi; yangi vazifa yaratilganda yoki statusi o'zgarganda
tegishli foydalanuvchiga bildirishnoma boradi.

- **Backend:** Python 3.12, Django 5, Django REST Framework, JWT (simplejwt), Celery + Redis, PostgreSQL yoki SQLite
- **Frontend:** oddiy HTML + CSS + JavaScript (framework va build bosqichi yo'q)

```
taskflow/
├── backend/        # Django loyihasi (config, accounts, todos, notifications)
├── frontend/       # index.html, css/, js/
└── .env.example
```

## 1. Ishga tushirish (PyCharm yoki terminal)

```bash
cp .env.example .env            # Windows: copy .env.example .env
```
`.env` ichida: `POSTGRES_DB` qatorini o'chiring (SQLite ishlaydi) va Redis'siz sinash uchun `CELERY_EAGER=True` qiling.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver      # http://localhost:8000
```

Frontend (alohida terminal):

```bash
cd frontend
python -m http.server 3000      # http://localhost:3000
```

Backend manzili boshqacha bo'lsa, `frontend/js/config.js` ichidagi `API_URL` ni o'zgartiring.

## 2. Celery + Redis (haqiqiy fon rejimi)

`.env` da `CELERY_EAGER=False`, Redis ishga tushgan bo'lishi kerak (`REDIS_URL`). Keyin alohida terminalda:

```bash
cd backend
celery -A config worker -l info          # Windows: qo'shing  -P solo
```

## 3. PostgreSQL (ixtiyoriy)

`.env` da `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT` ni to'ldiring,
so'ng `python manage.py migrate`.

## 4. Testlar

```bash
cd backend && python manage.py test
```

## 5. API

Barcha endpointlar (register/login dan tashqari) `Authorization: Bearer <access_token>` talab qiladi.

| Metod | URL | Tavsif | Status kodlar |
|---|---|---|---|
| POST | `/api/auth/register/` | Ro'yxatdan o'tish (`username`, `password`, `email?`) | 201, 400 |
| POST | `/api/auth/login/` | Kirish → `access`, `refresh` | 200, 401 |
| POST | `/api/auth/refresh/` | Access tokenni yangilash | 200, 401 |
| GET | `/api/auth/me/` | Joriy foydalanuvchi | 200 |
| GET | `/api/users/` | Foydalanuvchilar (biriktirish uchun) | 200 |
| POST | `/api/tasks/` | Vazifa yaratish + biriktirish | 201, 400 |
| GET | `/api/tasks/?status=&title=` | Mening (yaratgan yoki menga biriktirilgan) vazifalarim | 200, 400 |
| PATCH | `/api/tasks/<id>/` | Status o'zgartirish (`pending → in_progress → completed`) | 200, 400, 403, 404 |
| DELETE | `/api/tasks/<id>/` | O'chirish (faqat yaratgan) | 204, 403, 404 |
| GET | `/api/notifications/` | Mening bildirishnomalarim (`?unread=1`) | 200 |
| PATCH | `/api/notifications/<id>/read/` | O'qildi deb belgilash | 200, 404 |
| PATCH | `/api/notifications/read-all/` | Hammasini o'qildi qilish | 200 |

**Qoidalar**
- Foydalanuvchi faqat o'zi yaratgan yoki o'ziga biriktirilgan vazifalarni ko'radi (boshqasiniki — 404).
- Status faqat bir qadam o'zgaradi (oldinga yoki orqaga); sakrash → 400.
- Biriktirilgan foydalanuvchi faqat statusni o'zgartira oladi; qolgan maydonlarni faqat yaratuvchi (aks holda 403).
- Bildirishnoma: vazifa biriktirilganda va status o'zgarganda (o'zgartirgan odamdan boshqa tomonga).
  Celery task `notifications.tasks.create_notification` bazaga yozadi, so'ng (ixtiyoriy) Email / Telegram yuboradi.

## 6. Frontend imkoniyatlari

- Login / Register, JWT `localStorage` da, har so'rovda `Authorization: Bearer ...`, 401 da avtomatik refresh.
- Kanban / Cards / Table ko'rinishlari, status filtri, sarlavha bo'yicha qidiruv.
- Yangi vazifa modali, status tugmalari, o'chirish.
- Qo'ng'iroqcha + o'qilmaganlar soni, "Mark as read" / "Mark all as read".
- Har 10 soniyada polling (`frontend/js/config.js` → `POLL_INTERVAL_MS`).
- Xatolar toast va forma ostida ko'rsatiladi.

## 7. Git jarayoni

```bash
git remote add origin <repo-url>
git push -u origin main feature/backend feature/frontend
```
