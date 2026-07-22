# Khadra Workshop

## تشغيل المشروع

1. تثبيت التبعيات:
   ```bash
   npm install
   ```
2. بناء واجهة المستخدم (React) من داخل مجلد `client`:
   ```bash
   cd client && npm install && npm run build
   ```
3. تشغيل السيرفر:
   ```bash
   npm start
   ```
4. فتح المتصفح على:
   ```text
   http://127.0.0.1:3000/
   ```

> للمطورين: إذا كنت تريد تشغيل الواجهة في وضع التطوير مع إعادة التحميل الحي، استخدم:
> ```bash
> npm run fullstack
> ```
4. بيانات الدخول الافتراضية:
   - المستخدم: `admin`
   - كلمة المرور: `admin123`

## ما تم تنفيذه

- Backend Express مع قاعدة بيانات SQLite محلية
- مصادقة JWT
- API للأصناف واستخدامها وسجلات الدوام
- واجهة ويب بسيطة بالعربية
- اختبارات أساسية للتأكد من تسجيل الدخول والـ API

## صفحات جديدة

- `attendance.html` — صفحة تسجيل الحضور (Admin فقط)
- `boxes.html` — صفحة تسجيل عدد العلب من قبل الـ Host/منسق
- `workers.html` — صفحة عرض قائمة العمال (عرض فقط للمضيفين)

## إدارة المستخدمين

- يمكنك إنشاء مضيف (Host) جديد عبر تنفيذ POST إلى `/api/users` باستخدام حساب Admin.

مثال سريع لإنشاء مضيف جديد (استبدل القيم المناسبة):

```bash
curl -X POST http://127.0.0.1:3000/api/users \
   -H "Content-Type: application/json" \
   -H "Authorization: Bearer <ADMIN_TOKEN>" \
   -d '{"full_name":"منسق جديد","username":"host1","password":"secret","role":"host"}'
```

