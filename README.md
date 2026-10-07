# Taskflow — Real-time Task & Notification System

Foydalanuvchilar bir-biriga vazifa biriktiradi; yangi vazifa yaratilganda yoki statusi o'zgarganda
tegishli foydalanuvchiga bildirishnoma boradi.

- **Backend:** Python 3.12, Django 5, Django REST Framework, JWT (simplejwt), Celery + Redis, PostgreSQL
- **Frontend:** React'siz — oddiy HTML + CSS + JavaScript (framework va build bosqichi yo'q)
- **DevOps:** Docker Compose, `.env`

```
taskflow/
├── backend/            # Django loyihasi (config, accounts, todos, notifications)
├── frontend/           # index.html, css/, js/ (nginx yoki istalgan statik server)
├── docker-compose.yml
└── .env.example
```

## 1. Docker bilan ishga tushirish (tavsiya etiladi)

```bash
cp .env.example .env
docker compose up --build
```

| Xizmat | Manzil |
|---|---|
| Frontend | http://localhost:3000 |
| API | http://localhost:8000/api/ |
| Admin | http://localhost:8000/admin/ |

Migratsiyalar backend konteyner ishga tushganda avtomatik bajariladi. Admin yaratish:
`docker compose exec backend python manage.py createsuperuser`

## 2. Docker'siz (lokal)

```bash
cp .env.example .env            # POSTGRES_DB qatorini o'chirsangiz SQLite ishlaydi
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver      # http://localhost:8000
```

Redis va Celery worker (bildirishnomalar fonda yoziladi):

```bash
redis-server                                  # alohida terminal
cd backend && celery -A config worker -l info # alohida terminal
```

Redis o'rnatishni xohlamasangiz, `.env` da `CELERY_EAGER=True` qo'ying — task darhol bajariladi.

Frontend (alohida terminal):

```bash
cd frontend && python -m http.server 3000     # http://localhost:3000
```

Backend manzili boshqacha bo'lsa, `frontend/js/config.js` ichidagi `API_URL` ni o'zgartiring.

## 3. Testlar

```bash
cd backend && python manage.py test
```

## 4. API

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
- Bildirishnoma yaratiladi: vazifa biriktirilganda va status o'zgarganda (o'zgartirgan odamdan boshqa tomonga).
  Celery task `notifications.tasks.create_notification` bazaga yozadi, so'ng (ixtiyoriy) Email / Telegram yuboradi.

## 5. Frontend imkoniyatlari

- Login / Register, JWT `localStorage` da, har so'rovda `Authorization: Bearer ...`, 401 da avtomatik refresh.
- Kanban / Cards / Table ko'rinishlari, status filtri (All, Pending, In progress, Completed), sarlavha bo'yicha qidiruv.
- Yangi vazifa modali (boshqa foydalanuvchiga biriktirish), status tugmalari, o'chirish.
- Qo'ng'iroqcha + o'qilmaganlar soni, ro'yxat, "Mark as read" / "Mark all as read".
- Real-time: har 10 soniyada polling (`frontend/js/config.js` → `POLL_INTERVAL_MS`).
- Xatolar toast va forma ostida ko'rsatiladi.

Sinash: ikkita brauzer oynasida (biri oddiy, biri inkognito) ikki foydalanuvchi yarating,
biridan ikkinchisiga vazifa biriktiring — 10 soniya ichida qo'ng'iroqchada badge paydo bo'ladi.

## 6. Git jarayoni

```bash
git checkout -b feature/backend    # backend ishlari
git checkout -b feature/frontend   # frontend ishlari
git push -u origin feature/backend feature/frontend   # so'ng Pull Request orqali main'ga
```
