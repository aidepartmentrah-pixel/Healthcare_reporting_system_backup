"""
VAP (Ventilator-Associated Pneumonia) AI Analysis Service
==========================================================

Provides 11 analysis methods for the VAP DOCX report.  Each method:
  1. Computes derived values from stats/history.
  2. Builds a focused Arabic prompt with exact numbers.
  3. Calls the local Qwen 2.5-7B GGUF model via llama-cpp-python.
  4. Validates output (length ≥ 30, no CJK, no list markers).
  5. Falls back to a static template.

BiDi contract for _add_bidi_para():
  - Latin tokens (VAP, ICU, CCU, ‰, %) surrounded by spaces.
  - Never returns CJK characters.
  - Arabic text flows RTL; embedded LTR tokens render LTR within runs.
"""

import re
from typing import Any, Dict, List, Optional

try:
    from loguru import logger
except ImportError:
    import logging
    logger = logging.getLogger(__name__)
    logging.basicConfig(level=logging.INFO)


FLOOR_TARGETS = {
    "ICU": 25.0, "CCU": 15.0, "CSU": 9.5,
    "Ped": 5.5,  "ICN": 10.0, "ITU": 25.0,
}


def _parse_age_display(val) -> Optional[float]:
    """Convert display age string ('45Y', '3M', '10D') back to years."""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip()
    if s == "N/A" or s == "—":
        return None
    if s.endswith("Y"):
        try: return float(s[:-1])
        except ValueError: return None
    if s.endswith("M"):
        try: return float(s[:-1]) / 12
        except ValueError: return None
    if s.endswith("D"):
        try: return float(s[:-1]) / 365
        except ValueError: return None
    try:
        return float(s)
    except ValueError:
        return None

SYSTEM_PROMPT = (
    "أنت متخصص في الجودة والسلامة في المستشفيات. "
    "تكتب جمل تحليلية قصيرة باللغة العربية الفصحى. "
    "يمكنك استخدام المصطلحات الطبية باللغة الإنجليزية (مثل VAP, ICU, CCU, ICN, DTA, ESBL, CRE). "
    "استخدم الأرقام الغربية دائماً (1 2 3) وليس الأرقام العربية. "
    "لا تضع نقاط أو أرقام في بداية الجمل. "
    "لا تكتب أي نص باللغة الصينية أو اليابانية أو الكورية. "
    "اكتب الجمل متصلة بدون قوائم."
)


class VAPAIService:

    def __init__(self):
        self._llm = None
        self._load_failed = False  # don't retry after first failure

    # =========================================================================
    # PUBLIC METHODS
    # =========================================================================

    def analyze_summary(self, quarter, year, total_cases, total_vent_days,
                        overall_rate, floor_stats, prev_quarter="",
                        prev_total_cases=0, prev_overall_rate=0.0):
        """3 lines for Page 1 analysis box."""
        exceeded = [f" {f} " for f, d in floor_stats.items()
                    if d.get("rate", 0) > d.get("target", 99)]
        zero_fl  = [f" {f} " for f, d in floor_stats.items()
                    if d.get("cases", 0) == 0]

        rate_change = ""
        if prev_overall_rate and overall_rate:
            diff  = abs(overall_rate - prev_overall_rate)
            trend = "ارتفع" if overall_rate > prev_overall_rate else "انخفض"
            rate_change = f"{trend} بمقدار {diff:.2f}‰ مقارنةً مع {prev_quarter}"

        prompt = (
            f"اكتب 3 جمل تحليلية (كل جملة في سطر مستقل) عن نتائج VAP لـ {quarter} {year}:\n"
            f"- إجمالي الحالات: {total_cases}\n"
            f"- أيام التنفس: {total_vent_days:,}\n"
            f"- المعدل الإجمالي: {overall_rate:.2f}‰\n"
            f"- التغيير: {rate_change or 'لا بيانات سابقة'}\n"
            f"- أقسام تجاوزت الهدف: {'و'.join(exceeded) or 'لا شيء'}\n"
            f"- أقسام بدون إصابات: {'و'.join(zero_fl) or 'لا شيء'}\n"
            "3 جمل فقط، مفصولة بسطر جديد."
        )

        fallback = "\n".join([
            f"بلغ إجمالي حالات ال VAP خلال {quarter} من العام {year} "
            f"ما يعادل {total_cases} حالة من أصل {total_vent_days:,} يوم تنفس اصطناعي، "
            f"بمعدل إجمالي {overall_rate:.2f}‰.",
            (f"مقارنةً مع {prev_quarter} فإن معدل ال VAP الإجمالي قد {rate_change}."
             if rate_change else
             "تُعدّ هذه النتيجة ضمن النسب المرجعية المعتمدة."),
            (f"الأقسام التالية لم تُسجّل أي حالات VAP : {'و'.join(zero_fl)}."
             if zero_fl else
             "يستلزم الأمر مراجعة بروتوكولات الوقاية في الأقسام ذات المعدلات المرتفعة.")
        ])

        result = self._safe(prompt, 350)
        if result:
            lines = [l.strip() for l in result.split("\n") if l.strip()]
            if len(lines) >= 2:
                return "\n".join(lines[:3])
        return fallback

    # ─────────────────────────────────────────────────────────────────────────

    def analyze_floor_comparison(self, quarter, year, floor_stats, history_desc=""):
        rows = []
        for fl, d in floor_stats.items():
            rate   = d.get("rate",   0.0)
            target = d.get("target", 0.0)
            cases  = d.get("cases",  0)
            status = "أعلى من الهدف" if rate > target else "ضمن الهدف"
            rows.append(f"  {fl}: {rate:.2f}‰ ({cases} حالة) — {status} ({target}‰)")

        prompt = (
            f"اكتب جملة تحليلية أو جملتين عن جدول VAP بحسب الأقسام "
            f"خلال {history_desc or (quarter + ' ' + str(year))}:\n"
            + "\n".join(rows)
            + "\nبدون نقاط أو أرقام في البداية."
        )

        exceeded  = [f" {f} " for f, d in floor_stats.items()
                     if d.get("rate", 0) > d.get("target", 99)]
        good      = [f" {f} " for f, d in floor_stats.items()
                     if d.get("cases", 0) == 0]

        fallback = (
            f"إن الجدول يظهر مقارنة نتائج ال VAP بحسب الأقسام"
            + (f" خلال {history_desc}" if history_desc else f" خلال {quarter} {year}")
            + " من حيث عدد الأيام والحالات والنسبة لكل قسم."
            + (f" الأقسام {'و'.join(exceeded)} تجاوزت الهدف المحدد." if exceeded else "")
            + (f" الأقسام {'و'.join(good)} لم تُسجّل أي حالات VAP ." if good else "")
        )

        return self._safe(prompt, 220) or fallback

    # ─────────────────────────────────────────────────────────────────────────

    def analyze_icu_trend(self, quarter, year, icu_stats, history_rates=None, all_desc=""):
        rate = icu_stats.get("rate", 0.0)
        target = icu_stats.get("target", 25.0)
        cases = icu_stats.get("cases", 0)
        history_rates = history_rates or []
        
        # Determine if rate is below or above target
        is_below_target = rate <= target
        status_text = "مشجعة" if is_below_target else "تستدعي المتابعة"
        comparison_text = "لم تتعدَّ" if is_below_target else "تجاوزت"
        
        compare_parts = []
        for h in history_rates[-4:]:
            diff = abs(rate - h.get("rate", rate))
            trend = "انخفضت" if rate < h.get("rate", rate) else "ارتفعت"
            compare_parts.append(
                f"  {trend} عن {h.get('quarter','')} {h.get('year','')} بمقدار {diff:.2f}‰"
            )
        compare_str = "\n".join(compare_parts)
        
        # Enhanced prompt with clearer instructions
        prompt = (
            f"اكتب 2-3 جمل تحليلية عن رسم VAP لقسم ICU خلال {quarter} {year}:\n"
            f"- معدل VAP : {rate:.2f}‰ (الهدف: {target}‰)\n"
            f"- عدد الحالات: {cases}\n"
            f"- المقارنة مع السابق:\n{compare_str or '  لا بيانات'}\n"
            f"ملاحظة مهمة: المعدل الحالي {'أقل من' if is_below_target else 'أعلى من'} الهدف "
            f"({rate:.2f}‰ vs {target}‰)\n"
            "يجب أن تعكس الجمل هذا التحليل بدقة.\n"
            "بدون نقاط في البداية."
        )
        
        last = history_rates[-1] if history_rates else {}
        last_rate = last.get("rate", rate)
        diff = abs(rate - last_rate)
        trend = "انخفضت" if rate < last_rate else "ارتفعت"
        
        # Improved fallback text with correct logic
        if history_rates:
            cmp = (f" وقد {trend} مقارنةً مع {last.get('quarter','')} من العام {last.get('year','')} "
                f"بمقدار {diff:.2f}‰")
        else:
            cmp = ""
        
        # Check if there's improvement compared to previous periods
        improving_trend = False
        if len(history_rates) >= 2:
            older_rates = [h.get("rate", rate) for h in history_rates[-3:-1]]
            if older_rates and rate < min(older_rates):
                improving_trend = True
        
        cases_text = f"\nلقد سُجّلت {cases} {'حالة' if cases == 1 else 'حالات'} VAP في قسم ال ICU (راجع الجدول المفصل)." if cases else ""
        
        if is_below_target:
            # Case when rate is below target
            if improving_trend and history_rates:
                fallback = (
                    f"إن الرسم البياني يظهر أن نسبة ال VAP في قسم ال ICU خلال {quarter} "
                    f"من العام {year} بلغت {rate:.2f}‰{cmp}.\n"
                    f"النتيجة أعلاه جداً \"مشجعة\" كونها لم تتعدَّ النسبة المسموح بها وهي {target}‰. "
                    f"وهناك تحسُّن ملحوظ مقارنة مع الفصول المذكورة أعلاه.{cases_text}"
                )
            else:
                fallback = (
                    f"إن الرسم البياني يظهر أن نسبة ال VAP في قسم ال ICU خلال {quarter} "
                    f"من العام {year} بلغت {rate:.2f}‰{cmp}.\n"
                    f"هذه النتيجة مشجعة كونها لم تتعدَّ الهدف المحدد وهو {target}‰.{cases_text}"
                )
        else:
            # Case when rate is above target
            fallback = (
                f"إن الرسم البياني يظهر أن نسبة ال VAP في قسم ال ICU خلال {quarter} "
                f"من العام {year} بلغت {rate:.2f}‰{cmp}.\n"
                f"هذه النتيجة تستدعي المتابعة كونها تجاوزت الهدف المحدد وهو {target}‰، "
                f"مما يتطلب مزيداً من الجهود لتحسين ممارسات الوقاية من العدوى.{cases_text}"
            )
        
        result = self._safe(prompt, 280)
        
        # If AI response contains incorrect statement about being above target when it's below,
        # use the fallback instead
        if result and is_below_target and "أعلى من الهدف" in result:
            return fallback
        
        return result or fallback
    # ─────────────────────────────────────────────────────────────────────────

    def analyze_icu_germs(self, quarter, year, icu_germs, two_desc=""):
        counts = icu_germs.get("counts", {})
        total  = icu_germs.get("total", 0)
        pcts   = icu_germs.get("percentages", {})
        top    = list(counts.items())[:3]

        germ_lines = "\n".join(f"  {g}: {c} حالة ({pcts.get(g,0):.1f}%)" for g, c in top)

        prompt = (
            f"اكتب جملة أو جملتين عن الجراثيم المسببة لـ VAP في قسم ICU "
            f"خلال {two_desc or quarter + ' ' + str(year)}:\n"
            f"- إجمالي الحالات: {total}\n"
            f"- الجراثيم:\n{germ_lines or '  لا بيانات'}\n"
            "اذكر اسم الجرثومة الأبرز بالإنجليزية مع نسبتها. بدون نقاط."
            "اذكر اسم الجرثومة الأقل ظهورا  بالإنجليزية مع نسبتها. بدون نقاط."
        )

        top1 = top[0] if top else None
        fallback = (
            f"إن الرسم البياني يظهر نوع ال Germs في ال DTA "
            "(Deep tracheal aspiration) culture "
            f"في قسم ال ICU خلال {two_desc or quarter + ' ' + str(year)}."
            + (f"\nالجرثومة الأكثر شيوعاً كانت {top1[0]} "
               f"بنسبة {pcts.get(top1[0],0):.0f}% من مجمل الحالات." if top1 else "")
        )

        return self._safe(prompt, 220) or fallback

    # ─────────────────────────────────────────────────────────────────────────

    def analyze_icu_cases(self, quarter, year, cases):
        n = len(cases)
        if n == 0:
            return (f"لم تُسجَّل أي حالات VAP في قسم ال ICU "
                    f"خلال {quarter} من العام {year}.")

        ages  = [_parse_age_display(c.get("age")) for c in cases]
        ages  = [a for a in ages if a is not None]
        germs = [c.get("germs", "") for c in cases if c.get("germs")]
        avg_age = round(sum(ages) / len(ages)) if ages else None

        rf_counts: Dict[str, int] = {}
        for case in cases:
            for item in (case.get("risk_factors") or "").split(","):
                item = item.strip()
                if item and item.lower() != "none":
                    rf_counts[item] = rf_counts.get(item, 0) + 1
        top_rf     = sorted(rf_counts.items(), key=lambda x: x[1], reverse=True)[:3]
        top_rf_str = "، ".join(r[0] for r in top_rf) if top_rf else "لا"
        germ_str   = (germs[0] if len(germs) == 1
                      else (", ".join(germs[:2]) if germs else "غير محدد"))

        prompt = (
            f"اكتب 2 جمل تحليلية عن جدول حالات VAP في قسم ICU خلال {quarter} {year}:\n"
            f"- عدد الحالات: {n}\n"
            f"- متوسط العمر: {avg_age if avg_age else 'غير محدد'}\n"
            f"- الجراثيم: {germ_str}\n"
            f"- عوامل الخطر الأبرز: {top_rf_str}\n"
            "اذكر عوامل الخطر بالإنجليزية. بدون نقاط في البداية."
        )

        fallback = (
            f"إن الجدول يظهر شرحاً مفصلاً عن "
            f"{'حالة ال VAP المكتسبة' if n == 1 else f'حالات ال VAP الـ {n} المكتسبة'} "
            f"في قسم ال ICU خلال {quarter} من العام {year}، "
            f"ويتضمن التشخيص عند الدخول وتاريخ وضع المريض على جهاز التنفس وتاريخ الإصابة "
            f"واسم الجرثومة المسببة ( {germ_str} ) والعوامل الصحية المساعدة.\n"
            + (f"أبرز عوامل الخطر الموثقة: {top_rf_str}." if top_rf else "")
        )

        return self._safe(prompt, 280) or fallback

    # ─────────────────────────────────────────────────────────────────────────

    def analyze_ccu_trend(self, quarter, year, ccu_stats, history_rates=None, two_desc=""):
        rate   = ccu_stats.get("rate",   0.0)
        target = ccu_stats.get("target", 15.0)
        cases  = ccu_stats.get("cases",  0)
        history_rates = history_rates or []

        compare_parts = []
        for h in history_rates[-4:]:
            diff  = abs(rate - h.get("rate", rate))
            trend = "انخفضت" if rate < h.get("rate", rate) else "ارتفعت"
            compare_parts.append(
                f"  {trend} عن {h.get('quarter','')} {h.get('year','')} بمقدار {diff:.2f}‰"
            )

        prompt = (
            f"اكتب جملتين تحليليتين عن رسم VAP لقسم CCU خلال {quarter} {year}:\n"
            f"- معدل VAP : {rate:.2f}‰ (الهدف: {target}‰)\n"
            f"- عدد الحالات: {cases}\n"
            f"- المقارنة:\n" + ("\n".join(compare_parts) or "  لا بيانات") + "\n"
            "بدون نقاط في البداية."
        )

        last = history_rates[-1] if history_rates else {}
        diff  = abs(rate - last.get("rate", rate))
        trend = "انخفضت" if rate < last.get("rate", rate) else "ارتفعت"
        cmp   = (f" وقد {trend} مقارنةً مع {last.get('quarter','')} من العام {last.get('year','')} "
                 f"بمقدار {diff:.2f}‰") if last else ""

        fallback = (
            f"إن الرسم البياني يظهر أن نسبة ال VAP في قسم ال CCU خلال {quarter} "
            f"من العام {year} بلغت {rate:.2f}‰{cmp}.\n"
            f"هذه النتيجة {'مشجعة' if rate <= target else 'تستدعي المراجعة'} "
            f"كونها {'لم تتعدَّ' if rate <= target else 'تجاوزت'} الهدف المحدد وهو {target}‰."
        )

        return self._safe(prompt, 240) or fallback

    # ─────────────────────────────────────────────────────────────────────────

    def analyze_ccu_germs(self, quarter, year, ccu_germs, two_desc=""):
        counts = ccu_germs.get("counts", {})
        total  = ccu_germs.get("total", 0)
        pcts   = ccu_germs.get("percentages", {})
        top    = list(counts.items())[:3]

        germ_lines = "\n".join(f"  {g}: {c} ({pcts.get(g,0):.1f}%)" for g, c in top)

        prompt = (
            f"اكتب جملة أو جملتين عن الجراثيم في CCU "
            f"خلال {two_desc or quarter + ' ' + str(year)}:\n"
            + germ_lines + "\nاذكر الجرثومة الأبرز بالإنجليزية. بدون نقاط."
        )

        top1 = top[0] if top else None
        fallback = (
            f"إن الرسم البياني يظهر نوع ال Germs في ال DTA culture "
            f"في قسم ال CCU خلال {two_desc or quarter + ' ' + str(year)}."
            + (f"\nالجرثومة الرئيسية كانت {top1[0]} "
               f"بنسبة {pcts.get(top1[0],0):.0f}% من إجمالي الحالات." if top1 else "")
        )

        return self._safe(prompt, 200) or fallback

    # ─────────────────────────────────────────────────────────────────────────

    def analyze_ccu_cases(self, quarter, year, cases):
        n = len(cases)
        if n == 0:
            return (f"لم تُسجَّل أي حالات VAP في قسم ال CCU "
                    f"خلال {quarter} من العام {year}.")

        ages  = [_parse_age_display(c.get("age")) for c in cases]
        ages  = [a for a in ages if a is not None]
        germs = [c.get("germs", "") for c in cases if c.get("germs")]
        avg_age = round(sum(ages) / len(ages)) if ages else None

        rf_counts: Dict[str, int] = {}
        for case in cases:
            for item in (case.get("risk_factors") or "").split(","):
                item = item.strip()
                if item and item.lower() != "none":
                    rf_counts[item] = rf_counts.get(item, 0) + 1
        top_rf     = sorted(rf_counts.items(), key=lambda x: x[1], reverse=True)[:2]
        top_rf_str = "، ".join(r[0] for r in top_rf) if top_rf else ""
        germ_str   = (germs[0] if len(germs) == 1
                      else (", ".join(germs[:2]) if germs else "غير محدد"))

        prompt = (
            f"اكتب جملتين عن جدول حالات VAP في قسم CCU خلال {quarter} {year}:\n"
            f"- عدد الحالات: {n}، الجراثيم: {germ_str}\n"
            f"- عوامل الخطر: {top_rf_str or 'غير محدد'}\n"
            "بدون نقاط."
        )

        fallback = (
            f"إن الجدول يبيّن تفاصيل "
            f"{'حالة ال VAP' if n == 1 else f'حالات ال VAP الـ {n}'} "
            f"في قسم ال CCU خلال {quarter} من العام {year}، "
            "يشمل تاريخ الدخول والتنبيب والإصابة "
            f"واسم الجرثومة المسببة ( {germ_str} ) والعوامل الصحية المساهمة.\n"
            + (f"أبرز عوامل الخطر الموثقة: {top_rf_str}." if top_rf_str else "")
        )

        return self._safe(prompt, 250) or fallback

    # ─────────────────────────────────────────────────────────────────────────

    def analyze_icn_trend(self, quarter, year, icn_stats, history_rates=None, two_desc=""):
        rate   = icn_stats.get("rate",   0.0)
        target = icn_stats.get("target", 10.0)
        cases  = icn_stats.get("cases",  0)
        history_rates = history_rates or []

        compare_parts = []
        for h in history_rates[-4:]:
            diff  = abs(rate - h.get("rate", rate))
            trend = "انخفضت" if rate < h.get("rate", rate) else "ارتفعت"
            compare_parts.append(
                f"  {trend} عن {h.get('quarter','')} {h.get('year','')} بمقدار {diff:.2f}‰"
            )

        prompt = (
            f"اكتب 2-3 جمل عن رسم VAP لقسم ICN خلال {quarter} {year}:\n"
            f"- معدل VAP : {rate:.2f}‰ (الهدف: {target}‰)\n"
            f"- عدد الحالات: {cases}\n"
            f"- المقارنة:\n" + ("\n".join(compare_parts) or "  لا بيانات") + "\n"
            "بدون نقاط."
        )

        last = history_rates[-1] if history_rates else {}
        diff  = abs(rate - last.get("rate", rate))
        trend = "انخفضت" if rate < last.get("rate", rate) else "ارتفعت"
        cmp   = (f"، وقد {trend} مقارنةً مع {last.get('quarter','')} من العام {last.get('year','')} "
                 f"بمقدار {diff:.2f}‰") if last else ""

        fallback = (
            f"إن الرسم البياني يظهر أن نسبة ال VAP في قسم ال ICN خلال {quarter} "
            f"من العام {year} بلغت {rate:.2f}‰{cmp}.\n"
            f"هذه النتيجة {'مقبولة' if rate <= target else 'تستدعي المتابعة'} "
            f"كونها {'لم تتعدَّ' if rate <= target else 'تجاوزت'} الهدف المحدد وهو {target}‰."
            + (f"\nلقد سُجّلت {cases} {'حالة' if cases == 1 else 'حالات'} VAP في قسم ال ICN "
               f"(راجع الجدول المفصل)." if cases else "")
        )

        return self._safe(prompt, 260) or fallback

    # ─────────────────────────────────────────────────────────────────────────

    def analyze_icn_germs(self, quarter, year, icn_germs, two_desc=""):
        counts = icn_germs.get("counts", {})
        total  = icn_germs.get("total", 0)
        pcts   = icn_germs.get("percentages", {})
        top    = list(counts.items())[:3]

        germ_lines = "\n".join(f"  {g}: {c} ({pcts.get(g,0):.1f}%)" for g, c in top)

        prompt = (
            f"اكتب جملة أو جملتين عن الجراثيم في ICN "
            f"خلال {two_desc or quarter + ' ' + str(year)}:\n"
            + germ_lines + "\nاذكر الجرثومة الأبرز بالإنجليزية."
        )

        top1 = top[0] if top else None
        fallback = (
            f"إن الرسم البياني يظهر نوع ال Germs في ال DTA culture "
            f"في قسم ال ICN خلال {two_desc or quarter + ' ' + str(year)}."
            + (f"\nالجرثومة الرئيسية كانت {top1[0]} "
               f"بنسبة {pcts.get(top1[0],0):.0f}% من إجمالي الحالات." if top1 else "")
        )

        return self._safe(prompt, 200) or fallback

    # ─────────────────────────────────────────────────────────────────────────

    def analyze_icn_cases(self, quarter, year, cases):
        n = len(cases)
        if n == 0:
            return (
                f"لم تُسجَّل أي حالات VAP في قسم ال ICN خلال {quarter} من العام {year}.\n"
                "*النتيجة في أقسام ال Pediatric و CSU و ITU جاءت مشجعة جداً بمعدل 0‰."
            )

        ages  = [_parse_age_display(c.get("age")) for c in cases]
        ages  = [a for a in ages if a is not None]
        germs = [c.get("germs", "") for c in cases if c.get("germs")]
        dov   = [c.get("duration_of_ventilation") for c in cases
                 if isinstance(c.get("duration_of_ventilation"), (int, float))]

        avg_age = round(sum(ages) / len(ages)) if ages else None
        avg_dov = round(sum(dov) / len(dov), 1) if dov else None
        germ_str = (germs[0] if len(germs) == 1
                    else (", ".join(germs[:2]) if germs else "غير محدد"))

        rf_counts: Dict[str, int] = {}
        for case in cases:
            for item in (case.get("risk_factors") or "").split(","):
                item = item.strip()
                if item and item.lower() != "none":
                    rf_counts[item] = rf_counts.get(item, 0) + 1
        top_rf     = sorted(rf_counts.items(), key=lambda x: x[1], reverse=True)[:2]
        top_rf_str = "، ".join(r[0] for r in top_rf) if top_rf else ""

        prompt = (
            f"اكتب جملتين عن جدول حالات VAP في قسم ICN خلال {quarter} {year}:\n"
            f"- عدد الحالات: {n}\n"
            + (f"- متوسط مدة التنفس: {avg_dov} يوم\n" if avg_dov else "")
            + f"- الجراثيم: {germ_str}\n"
            + (f"- عوامل الخطر: {top_rf_str}\n" if top_rf_str else "")
            + "بدون نقاط في البداية."
        )

        fallback = (
            f"إن الجدول يبيّن تفاصيل "
            f"{'حالة ال VAP' if n == 1 else f'حالات ال VAP الـ {n}'} "
            f"في قسم ال ICN خلال {quarter} من العام {year}، "
            f"يشمل التشخيص وتواريخ الدخول والتنبيب والإصابة "
            f"واسم الجرثومة ( {germ_str} ) والعوامل المساهمة"
            + (f"، أبرزها: {top_rf_str}" if top_rf_str else "")
            + ".\n"
            "*النتيجة في أقسام ال Pediatric و CSU و ITU جاءت مشجعة جداً بمعدل 0‰ في جميع الفصول."
        )

        return self._safe(prompt, 260) or fallback

    def unload(self):
        """Release the LLM from memory after report generation is done."""
        if self._llm is not None:
            try:
                del self._llm
            except Exception:
                pass
            self._llm = None
            self._load_failed = False   # allow reload next time
            try:
                import gc
                gc.collect()
            except Exception:
                pass
            logger.info("VAPAIService: model unloaded from memory")

    # =========================================================================
    # INTERNAL HELPERS
    # =========================================================================

    def _load_llm(self):
        if self._llm is not None:
            return True
        if self._load_failed:          # don't retry — already failed once
            return False
        try:
            from llama_cpp import Llama
            import glob
            import os

            candidates = []
            for pattern in [
                "C:/models/*.gguf",
                "models/*.gguf", "models/qwen*.gguf",
                "/models/*.gguf", "/app/models/*.gguf",
                "python-service/models/*.gguf",
            ]:
                candidates.extend(glob.glob(pattern))
            if not candidates:
                raise FileNotFoundError("No GGUF model file found")

            qwen = [p for p in candidates if "qwen" in p.lower()]
            # normalize path to avoid mixed separators on Windows
            model_path = os.path.normpath(qwen[0] if qwen else candidates[0])

            self._llm = Llama(
                model_path=model_path,
                n_ctx=1024,
                n_threads=4,
                n_threads_batch=4,
                n_batch=2048,
                use_mlock=False,
                n_gpu_layers=-1,
                verbose=False,
            )
            logger.info(f"VAPAIService: loaded {model_path}")
            return True
        except Exception as exc:
            logger.warning(f"VAPAIService: could not load LLM — {exc}")
            self._load_failed = True   # mark so we skip all future retries
            return False

    def _call_llm(self, prompt: str, max_tokens: int = 250) -> Optional[str]:
        if not self._load_llm():
            return None
        try:
            out = self._llm.create_chat_completion(
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user",   "content": prompt},
                ],
                max_tokens=max_tokens,
                temperature=0.3,
                stop=["###", "---"],
            )
            return out["choices"][0]["message"]["content"].strip()
        except Exception as exc:
            logger.warning(f"VAPAIService LLM call failed: {exc}")
            return None

    def _clean(self, text: str) -> str:
        """Remove CJK characters and collapse spaces."""
        CJK = re.compile(
            r"[\u4e00-\u9fff\u3040-\u30ff\u3400-\u4dbf"
            r"\uf900-\ufaff\u31f0-\u31ff\ufe30-\ufe4f]+"
        )
        return re.sub(r" {2,}", " ", CJK.sub(" ", text)).strip()

    def _validate(self, text: str) -> bool:
        if not text or len(text) < 30:
            return False
        if re.match(r"^\s*[\d\-\*\u2022\u00b7]+[\.\)\:]\s", text):
            return False
        ar_lat = sum(1 for c in text
                     if "\u0600" <= c <= "\u06FF"
                     or (c.isascii() and c.isalpha()))
        return ar_lat >= 10

    def _safe(self, prompt: str, max_tokens: int = 250) -> Optional[str]:
        raw = self._call_llm(prompt, max_tokens=max_tokens)
        if not raw:
            return None
        cleaned = self._clean(raw)
        return cleaned if self._validate(cleaned) else None


# ─── Singleton ────────────────────────────────────────────────────────────────
vap_ai_service = VAPAIService()