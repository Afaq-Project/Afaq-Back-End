#!/usr/bin/env bash
# =============================================================================
# اختبار الأخطاء الحرجة في Opportunities API باستخدام curl
# الاستخدام:
#   BASE_URL=http://localhost:3000/api ./test-opportunities.sh
# =============================================================================

set -euo pipefail

# ملاحظة: التطبيق يستخدم global prefix = /api
BASE_URL="${BASE_URL:-http://localhost:3000/api/v1}"
OPP_ENDPOINT="$BASE_URL/opportunities"
# UUID v4 صالح للاختبار (قد لا يوجد في قاعدة البيانات، لكن الأخطاء المتعلقة بالمدخلات ستظهر قبل الوصول للـ DB)
UUID="00000000-0000-4000-8000-000000000000"

# دالة مساعدة لطباعة الطلب والرد مع كود الحالة
request() {
  local method="$1"
  local url="$2"
  shift 2
  echo "========================================"
  echo "REQUEST: $method $url"
  echo "----------------------------------------"
  # نستخدم -g لتعطيل globbing حتى لا يفسر curl الرموز مثل [] أو {}
  curl -s -g -H "Authorization: Bearer $TOKEN" -w "\nHTTP_STATUS:%{http_code}\n" -X "$method" "$url" "$@"
  echo
}

echo "### Getting Auth Token..."

TOKEN=$(curl -s -X POST "${BASE_URL}/auth/login" -H "Content-Type: application/json" -d '{"email":"user1@levora.app","password":"User1Password!"}' | grep -oP '"accessToken":"K[^"]+')

if [ -z "$TOKEN" ]; then

  echo "Failed to get auth token"

  exit 1

fi

echo "Auth Token obtained."

# التحقق من أن الخادم يعمل (نستخدم /api/health لأن / غير موجود)
echo "### التحقق من الاتصال بالخادم..."
if ! curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health" | grep -qE '^[0-9]+$'; then
  echo "تعذر الاتصال بـ $BASE_URL. تأكد من تشغيل التطبيق."
  exit 1
fi
echo "الخادم يعمل على $BASE_URL"
echo

# -----------------------------------------------------------------------------
# 1) خطأ: findById مع fields كـ array (تكرار البارامتر) -> 500
#    السبب: الكنترولر يستقبل fields كـ string لكن يصل كـ array عند التكرار
#    ثم الخدمة تنادي fields.split(',') -> TypeError
# -----------------------------------------------------------------------------
echo "### 1) findById مع fields مكرر (array) -> متوقع 500"
request GET "$OPP_ENDPOINT/$UUID?fields=id&fields=title"

# -----------------------------------------------------------------------------
# 2) خطأ: is_remote غير منطقي (boolean) -> إذا لم يكن ValidationPipe مفعلاً
#    سيمر كسلسلة نصية إلى Prisma -> خطأ أو سلوك غير متوقع
# -----------------------------------------------------------------------------
echo "### 2) is_remote=notabool -> متوقع 400 إذا كان التحقق مفعلاً، وإلا 500"
request GET "$OPP_ENDPOINT?is_remote=notabool"

# -----------------------------------------------------------------------------
# 3) خطأ: page غير رقمي -> إذا لم يكن ValidationPipe مفعلاً
#    سيصبح NaN وينتقل إلى skip -> خطأ في Prisma
# -----------------------------------------------------------------------------
echo "### 3) page=abc -> متوقع 400 إذا كان التحقق مفعلاً، وإلا 500"
request GET "$OPP_ENDPOINT?page=abc"

# -----------------------------------------------------------------------------
# 4) خطأ: source_id غير UUID -> إذا لم يكن ValidationPipe مفعلاً
#    سيمر إلى Prisma كـ string في حقل UUID -> خطأ
# -----------------------------------------------------------------------------
echo "### 4) source_id=not-a-uuid -> متوقع 400 إذا كان التحقق مفعلاً، وإلا 500"
request GET "$OPP_ENDPOINT?source_id=not-a-uuid"

# -----------------------------------------------------------------------------
# 5) خطأ: deadline_from غير تاريخ -> إذا لم يكن ValidationPipe مفعلاً
#    سيصبح Invalid Date -> خطأ في Prisma
# -----------------------------------------------------------------------------
echo "### 5) deadline_from=not-a-date -> متوقع 400 إذا كان التحقق مفعلاً، وإلا 500"
request GET "$OPP_ENDPOINT?deadline_from=not-a-date"

# -----------------------------------------------------------------------------
# 6) خطأ: study_levels فارغ -> hasSome: [] -> يعيد لا نتائج بدل تجاهل الفلتر
#    نقارن مع طلب بدون فلتر
# -----------------------------------------------------------------------------
echo "### 6) study_levels=,, (فارغ) -> يجب أن يتجاهل الفلتر"
request GET "$OPP_ENDPOINT?study_levels=,,"
echo "--- للمقارنة: بدون فلتر ---"
request GET "$OPP_ENDPOINT"

# -----------------------------------------------------------------------------
# 7) خطأ: findById مع ID غير UUID -> ParseUUIDPipe يرفض -> 400
# -----------------------------------------------------------------------------
echo "### 7) findById مع ID غير UUID -> متوقع 400"
request GET "$OPP_ENDPOINT/not-a-uuid"

# -----------------------------------------------------------------------------
# 8) خطأ: findById بدون fields -> يعيد كل الحقول (18) بدل الحقول الافتراضية
# -----------------------------------------------------------------------------
echo "### 8) findById بدون fields -> يجب أن يعيد الحقول الافتراضية (7) وليس 18"
request GET "$OPP_ENDPOINT/$UUID"

# -----------------------------------------------------------------------------
# 9) findById مع fields=id,title -> يجب أن يعيد حقلين فقط
# -----------------------------------------------------------------------------
echo "### 9) findById مع fields=id,title -> متوقع حقلين فقط"
request GET "$OPP_ENDPOINT/$UUID?fields=id,title"

# -----------------------------------------------------------------------------
# 10) findById مع fields=forbidden -> يجب أن يرفض -> 400
# -----------------------------------------------------------------------------
echo "### 10) findById مع fields=forbidden -> متوقع 400"
request GET "$OPP_ENDPOINT/$UUID?fields=forbidden"

# -----------------------------------------------------------------------------
# 11) sort=forbidden:asc -> يجب أن يرفض -> 400 INVALID_SORT_FIELD
# -----------------------------------------------------------------------------
echo "### 11) sort=forbidden:asc -> متوقع 400"
request GET "$OPP_ENDPOINT?sort=forbidden:asc"

# -----------------------------------------------------------------------------
# 12) sort=title:sideways -> اتجاه غير صالح -> 400 VALIDATION_ERROR
# -----------------------------------------------------------------------------
echo "### 12) sort=title:sideways -> متوقع 400"
request GET "$OPP_ENDPOINT?sort=title:sideways"

# -----------------------------------------------------------------------------
# 13) deadline_from > deadline_to -> يجب أن يرفض -> 400 INVALID_DATE_RANGE
# -----------------------------------------------------------------------------
echo "### 13) deadline_from > deadline_to -> متوقع 400"
request GET "$OPP_ENDPOINT?deadline_from=2027-01-01&deadline_to=2026-01-01"

# -----------------------------------------------------------------------------
# 14) حقل غير معروف -> إذا كان whitelist مفعلاً -> 400
# -----------------------------------------------------------------------------
echo "### 14) حقل غير معروف (unknown_field) -> متوقع 400 إذا كان whitelist مفعلاً"
request GET "$OPP_ENDPOINT?unknown_field=hello"

echo "========================================"
echo "انتهت جميع الاختبارات."
