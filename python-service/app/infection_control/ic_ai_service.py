"""
Infection Control (CLABSI / CAUTI) AI Analysis Service
=======================================================
Shared AI service for CLABSI and CAUTI DOCX reports.
Each of the 4 public methods:
  1. Computes derived values from the data.
  2. Builds a focused Arabic prompt with exact numbers.
  3. Calls the local Qwen GGUF model via llama-cpp-python.
  4. Validates output (length >= 30, no CJK, no list markers).
  5. Falls back to a detailed static template.
"""

import re
from collections import Counter
from typing import Dict, List, Optional

try:
    from loguru import logger
except ImportError:
    import logging
    logger = logging.getLogger(__name__)
    logging.basicConfig(level=logging.INFO)


SYSTEM_PROMPT = (
    "أنت متخصص في الجودة والسلامة في المستشفيات. "
    "اكتب جميع الجمل باللغة العربية الفصحى فقط. "
    "يُسمح فقط باستخدام المصطلحات الطبية الإنجليزية كأسماء علم "
    "مثل CLABSI وCAUTI وICU وCCU وICN وCRE وESBL وCV line وFoley catheter وMRSA وKlebsiella. "
    "اكتب هذه المصطلحات مباشرة بدون أقواس ولا تضع ترجمة عربية بجانبها. "
    "لا تكتب جملاً كاملة بالإنجليزية أبداً. "
    "استخدم الأرقام الغربية دائماً (1 2 3) وليس الأرقام العربية. "
    "لا تضع نقاط أو أرقام في بداية الجمل. "
    "لا تكتب أي نص باللغة الصينية أو اليابانية أو الكورية. "
    "اكتب الجمل متصلة بدون قوائم."
)

_N_STR = {
    1: "الواحد", 2: "الاثنين", 3: "الثلاثة",
    4: "الأربعة", 5: "الخمسة", 6: "الستة",
}


class ICAIService:

    def __init__(self):
        self._llm = None
        self._load_failed = False

    # =========================================================================
    # PUBLIC METHODS
    # =========================================================================

    def analyze_floor_comparison_table(
        self,
        indicator: str,
        desc: str,
        floor_stats: Dict[str, dict],
        n_floors: int,
        quarter: str = "",
        year: str = "",
    ) -> str:
        """
        Analysis paragraph for the all-floors comparison table (Table 1).

        floor_stats: {floor_name: {rate, cases, days, target}}  — current quarter only.
        """
        catheter_ar = (
            "قسطرة وريدية"
            if indicator == "CLABSI"
            else "قسطرة بولية (Foley catheter)"
        )

        # Classify floors for current quarter
        above_floors = {fl: d for fl, d in floor_stats.items() if d.get("rate", 0.0) > d.get("target", 999.0)}
        below_floors = {fl: d for fl, d in floor_stats.items() if d.get("rate", 0.0) <= d.get("target", 999.0)}

        curr_label = f"{quarter} من العام {year}" if quarter and year else "الفصل الحالي"

        # Build prompt rows for current quarter
        rows = []
        for fl, d in floor_stats.items():
            rate   = d.get("rate", 0.0)
            target = d.get("target", 0.0)
            status = "تجاوز الهدف" if rate > target else "ضمن الهدف"
            rows.append(f"  {fl}: {rate:.2f}‰، الهدف: {target}‰، {status}")

        prompt = (
            f"اكتب جملة واحدة تذكر أن الجدول يظهر مقارنة {indicator} خلال {desc}، "
            f"ثم اذكر فقط نتائج {curr_label}: أي الأقسام تجاوزت الهدف وأيها ضمن الهدف.\n"
            + "\n".join(rows)
            + "\nجملة واحدة أو جملتان فقط، بدون قوائم."
        )

        # Static fallback
        curr_quarter_ref = f"خلال {curr_label}"
        fallback = (
            f"يظهر الجدول مقارنة نتائج ال {indicator} خلال {desc} بحسب الأقسام، "
            f"وفيما يخص {curr_quarter_ref}"
        )

        if above_floors:
            above_parts = []
            for fl, d in above_floors.items():
                diff = round(d.get("rate", 0.0) - d.get("target", 0.0), 2)
                above_parts.append(f"{fl} بـ {diff}‰")
            fallback += f" فقد تجاوزت أقسام {' و'.join(above_parts)} الهدف"
            if below_floors:
                below_names = " و".join(below_floors.keys())
                fallback += f"، بينما حققت {below_names} أداءً ضمن الهدف"
        else:
            all_names = " و".join(floor_stats.keys())
            fallback += f" فقد حققت جميع الأقسام ({all_names}) أداءً ضمن الهدف"

        fallback += "."

        return self._safe(prompt, 150) or fallback

    # -------------------------------------------------------------------------

    def analyze_floor_trend(
        self,
        indicator: str,
        quarter: str,
        year: str,
        floor: str,
        floor_data: dict,
        history_rates: List[dict],
        chart_num: int,
        cases: List[dict],
        all_floors_above: Optional[str] = None,
    ) -> str:
        """
        Analysis paragraph for the per-floor trend chart.

        history_rates: list of {quarter, year, rate} — previous quarters only,
                       sorted oldest → newest.
        cases:         raw case dicts for this floor this quarter.
        all_floors_above: name of a floor (other than this one) that exceeded
                          its target this quarter — used for the note.
        """
        rate     = floor_data.get("rate", 0.0)
        target   = floor_data.get("target", 0.0)
        n_cases  = floor_data.get("cases", 0)
        is_below = rate <= target

        # Build comparisons newest → oldest so the most recent quarter comes first
        rev_history = list(reversed(history_rates))

        # Each entry: (verb, phrase, h_year)
        comps = []
        same_year_count = 0     # how many same-year comparisons already seen
        cross_year_seen = {}    # h_year → True once first mentioned

        for h in rev_history:
            h_rate = h.get("rate", rate)
            diff   = round(abs(rate - h_rate), 2)
            verb   = "انخفضت" if rate < h_rate else "ارتفعت"
            h_q    = h.get("quarter", "")
            h_y    = str(h.get("year", ""))

            if h_y == year:
                # Same year as current quarter — year is introduced in the opening
                ref = f"عن {h_q} منه" if same_year_count == 0 else f"وعن {h_q} من العام نفسه"
                same_year_count += 1
            else:
                if h_y not in cross_year_seen:
                    ref = f"عن {h_q} من العام {h_y}"
                    cross_year_seen[h_y] = True
                else:
                    ref = f"عن {h_q} من العام نفسه"

            comps.append({"verb": verb, "ref": ref, "diff": diff, "year": h_y})

        # CLABSI-specific: type_of_line breakdown
        line_text = ""
        if indicator == "CLABSI" and cases:
            lines = Counter(
                c.get("type_of_line", "").strip()
                for c in cases
                if c.get("type_of_line", "").strip()
            )
            total_l = sum(lines.values())
            if total_l > 0:
                parts = []
                for lt, cnt in lines.most_common():
                    pct = round(cnt / total_l * 100)
                    cnt_ar = "حالة واحدة" if cnt == 1 else f"{cnt} حالات"
                    parts.append(
                        f"{cnt_ar} عبر ال {lt} أي ما يعادل ما نسبته {pct}% من مجمل الحالات"
                    )
                line_text = "\n_ ".join(parts)

        # Check for children (CLABSI)
        children = (
            [c for c in cases if _age_years(c.get("age_display") or c.get("age")) is not None
             and _age_years(c.get("age_display") or c.get("age")) < 18]
            if indicator == "CLABSI" else []
        )

        prompt = (
            f"اكتب جملة تحليلية عن معدل {indicator} في قسم ال {floor} "
            f"خلال {quarter} {year}.\n"
            f"المعدل الحالي: {rate:.2f}‰، الهدف: {target}‰.\n"
            f"الفرق عن الفصول السابقة (كل رقم هو الفرق وليس المعدل):\n"
            + ("\n".join(f"  {c['verb']} {c['ref']} بـ {c['diff']:.2f}‰" for c in comps)
               if comps else "  لا بيانات سابقة")
            + f"\nاذكر المعدل {rate:.2f}‰ أولاً ثم الفروقات. لا تذكر أرقام الرسوم. جملة واحدة فقط."
        )

        # --- Fallback ---
        if comps:
            # State current rate first, then list diffs from previous quarters
            open_sent = (
                f"بلغت نسبة ال {indicator} في قسم ال {floor} {rate:.2f}‰ "
                f"خلال {quarter} من العام {year}، "
                f"حيث {comps[0]['verb']} {comps[0]['ref']} بـ {comps[0]['diff']:.2f}‰"
            )
            prev_verb = comps[0]["verb"]
            for comp in comps[1:]:
                if comp["ref"].startswith("وعن"):
                    open_sent += f" {comp['ref']} بـ {comp['diff']:.2f}‰"
                elif comp["verb"] != prev_verb:
                    open_sent += f"، في حين {comp['verb']} {comp['ref']} بـ {comp['diff']:.2f}‰"
                else:
                    open_sent += f"، و{comp['verb']} {comp['ref']} بـ {comp['diff']:.2f}‰"
                prev_verb = comp["verb"]
            open_sent += "."
        else:
            open_sent = (
                f"بلغت نسبة ال {indicator} في قسم ال {floor} {rate:.2f}‰ "
                f"خلال {quarter} من العام {year}."
            )

        accept_word = "مقبولة"   if is_below else "غير مقبولة"
        exceed_word = "لم تتعدى" if is_below else "تعدت"
        result_sent = (
            f"النتيجة أعلاه {accept_word} كونها {exceed_word} "
            f"النسبة المسموح بها وهي {target}‰"
        )

        fallback = open_sent + "\n" + result_sent

        if n_cases > 0:
            n_ar = "حالة واحدة" if n_cases == 1 else f"{n_cases} حالات"
            fallback += f"\nلقد سُجّلت {n_ar} {indicator} في قسم ال {floor}"
            if line_text:
                fallback += f":\n_ {line_text}"
            else:
                fallback += "."

        if children:
            n_ch  = len(children)
            ch_ar = "طفل" if n_ch == 1 else f"{n_ch} أطفال"
            fallback += f"\nتجدر الإشارة إلى أن {ch_ar} قد التقطوا العدوى المكتسبة {indicator}."

        if all_floors_above:
            fallback += (
                f"\nملاحظة: إن ارتفاع نسبة المؤشر سببه عائد إلى ارتفاعه في قسم ال {all_floors_above}."
            )

        return self._safe(prompt, 200) or fallback

    # -------------------------------------------------------------------------

    def analyze_floor_germs(
        self,
        indicator: str,
        quarter: str,
        year: str,
        floor: str,
        current_germs: Dict[str, int],
        prev_germs: Dict[str, int],
        prev_quarter_label: str,
        prev_year_label: str,
        chart_num: int,
        total_cases: int,
    ) -> str:
        """
        Analysis paragraph for the per-floor germs chart.

        current_germs / prev_germs: {germ_name: count}
        """
        culture_ar = "Blood culture" if indicator == "CLABSI" else "Urine culture"

        persistent = [g for g in current_germs if g in prev_germs]
        gone_germs = [g for g in prev_germs    if g not in current_germs]

        # Two-quarter description for opening — only say "الفصلين" if prev actually has data
        has_prev = bool(prev_germs)
        if has_prev and prev_quarter_label:
            if prev_year_label == year:
                two_desc = f"الفصلين {prev_quarter_label} و{quarter} من العام {year}"
            else:
                two_desc = (
                    f"الفصلين {prev_quarter_label} من العام {prev_year_label} "
                    f"و{quarter} من العام {year}"
                )
        else:
            two_desc = f"{quarter} من العام {year}"

        # Per-germ percentage breakdown — denominator is total CLABSI/CAUTI cases
        denom = total_cases or sum(current_germs.values()) or 1
        breakdown_parts = []
        for germ, cnt in sorted(current_germs.items(), key=lambda x: -x[1]):
            pct   = round(cnt / denom * 100)
            cnt_s = "حالة واحدة" if cnt == 1 else f"{cnt} حالات"
            breakdown_parts.append(
                f"{cnt_s} سببها ال {germ} أي ما يعادل ما نسبته {pct}% من مجمل الحالات"
            )

        prompt = (
            f"جملة واحدة عن جراثيم {indicator} في قسم ال {floor} خلال {two_desc}.\n"
            f"حالية: {', '.join(current_germs.keys()) or '-'} | "
            f"مستمرة: {', '.join(persistent) or '-'} | "
            f"اختفت: {', '.join(gone_germs) or '-'}.\n"
            "لا تذكر أرقام الرسوم أو الجداول. جملة واحدة فقط، بدون قوائم."
        )

        # --- Fallback ---
        fallback = (
            f"يظهر الرسم البياني نوع ال Germs التي ظهرت "
            f"في ال {culture_ar} في قسم ال {floor} ونسبتهم خلال {two_desc}"
        )

        if has_prev and persistent:
            pers_str = "، ".join(f"ال {g}" for g in persistent)
            fallback += f" حيث يتبين لنا أن {pers_str} ما زالوا متواجدين خلال الفصلين"

        if has_prev and gone_germs:
            gone_str = "، ".join(f"ال {g}" for g in gone_germs)
            fallback += f"، في حين لم تظهر {gone_str}"

        fallback += "."

        if breakdown_parts and total_cases > 0:
            open_br = f"من أصل ال {total_cases} حالات {indicator} لدينا "
            fallback += "\n" + open_br + "، ".join(breakdown_parts) + "."

        return self._safe(prompt, 180) or fallback

    # -------------------------------------------------------------------------

    def analyze_floor_cases(
        self,
        indicator: str,
        quarter: str,
        year: str,
        floor: str,
        cases: List[dict],
        table_num: int,
    ) -> str:
        """
        Analysis paragraph for the per-floor detailed cases table.
        """
        if not cases:
            return ""

        n = len(cases)

        # Risk factor counting
        # CLABSI: uses catheter_duration (days); threshold 7d = long stay, 14d = long cath
        # CAUTI:  boolean fields length_of_stay / duration_of_catheter
        # VAP:    boolean risk_factor fields; duration_of_ventilation for avg ventilation
        if indicator == "CLABSI":
            long_stay = sum(1 for c in cases if (c.get("catheter_duration") or 0) >= 7)
            long_cath = sum(1 for c in cases if (c.get("catheter_duration") or 0) >= 14)
        elif indicator == "VAP":
            long_stay = 0   # not applicable for VAP (ventilation duration handled separately)
            long_cath = 0
        else:
            long_stay = sum(1 for c in cases if c.get("length_of_stay"))
            long_cath = sum(1 for c in cases if c.get("duration_of_catheter"))
        adv_age  = sum(1 for c in cases if (_age_years(c.get("age_display") or c.get("age")) or 0) > 70)
        diabetic = sum(1 for c in cases if c.get("diabetic") or
                       "Diabetic" in (c.get("risk_factors") or ""))

        # CLABSI extras
        line_text  = ""
        child_note = ""
        if indicator == "CLABSI":
            lines = Counter(
                c.get("type_of_line", "").strip()
                for c in cases
                if c.get("type_of_line", "").strip()
            )
            total_l = sum(lines.values())
            if total_l > 0:
                parts = []
                for lt, cnt in lines.most_common():
                    pct = round(cnt / total_l * 100)
                    cnt_s = "حالة واحدة" if cnt == 1 else f"{cnt} حالات"
                    parts.append(
                        f"{cnt_s} عبر ال {lt} أي ما يعادل ما نسبته {pct}% من مجمل الحالات"
                    )
                line_text = "\n_ ".join(parts)

            children = [
                c for c in cases
                if _age_years(c.get("age_display") or c.get("age")) is not None
                and _age_years(c.get("age_display") or c.get("age")) < 18
            ]
            if children:
                n_ch   = len(children)
                ch_str = "طفل" if n_ch == 1 else f"{n_ch} أطفال"
                child_note = (
                    f"تجدر الإشارة إلى أن هناك {ch_str} قد التقطوا العدوى المكتسبة {indicator}."
                )

        # VAP extras
        vap_note = ""
        if indicator == "VAP":
            dov = [c.get("duration_of_ventilation") for c in cases
                   if isinstance(c.get("duration_of_ventilation"), (int, float))]
            avg_dov = round(sum(dov) / len(dov), 1) if dov else None
            # Top risk factors from the risk_factors display string
            rf_counts: dict = {}
            for c in cases:
                for item in (c.get("risk_factors") or "").split(","):
                    item = item.strip()
                    if item and item.lower() not in ("none", "—", ""):
                        rf_counts[item] = rf_counts.get(item, 0) + 1
            top_rf = sorted(rf_counts.items(), key=lambda x: x[1], reverse=True)[:3]
            top_rf_str = "، ".join(f"{r[0]} ({r[1]})" for r in top_rf) if top_rf else ""
            if avg_dov:
                vap_note = f"متوسط مدة التنفس الاصطناعي {avg_dov} يوم"
            if top_rf_str:
                vap_note += (", " if vap_note else "") + f"عوامل الخطر الأكثر شيوعاً: {top_rf_str}"

        # CAUTI extras
        gender_note = ""
        if indicator == "CAUTI":
            females = sum(
                1 for c in cases
                if str(c.get("gender", "")).strip().upper() in ("F", "FEMALE", "أنثى")
            )
            if females > 0:
                pct = round(females / n * 100)
                f_ar = "مريضة واحدة" if females == 1 else f"{females} مريضات"
                gender_note = (
                    f"{f_ar} من أصل {n} مرضى هم من الإناث "
                    f"أي ما يعادل ما نسبته {pct}% من مجمل الحالات"
                )

        catheter_detail_ar = (
            "القسطرة الوريدية" if indicator == "CLABSI"
            else "أنبوب التنفس الاصطناعي" if indicator == "VAP"
            else "الميل البولي"
        )

        vap_prompt_line = (f"\n{vap_note}." if vap_note else "") if indicator == "VAP" else ""

        prompt = (
            f"جملتان عن عوامل خطر {indicator} في قسم ال {floor} خلال {quarter} {year}.\n"
            f"عوامل الخطر الإجمالية: {adv_age} مرضى فوق 70 عاماً، {diabetic} مصابون بالسكري."
            f"{vap_prompt_line}\n"
            "ركز على عوامل الخطر فقط. لا تذكر عدد الحالات الكلي. "
            "لا تذكر أرقام الجداول أو الرسوم. جملتان فقط، بدون قوائم."
        )

        # --- Fallback ---
        fallback = (
            f"يظهر الجدول شرحاً مفصلاً عن {n} "
            f"{'حالة' if n == 1 else 'حالات'} ال {indicator} المكتسبة في قسم ال {floor} "
            f"خلال {quarter} من العام {year} ويظهر لنا التشخيص عند الدخول، "
            f"تاريخ دخول المريض إلى المستشفى، تاريخ وضع {catheter_detail_ar} للمريض، "
            f"تاريخ التقاط العدوى مع اسم الجرثومة المسببة بالإضافة إلى العوامل الصحية "
            f"المساعدة للالتقاط العدوى."
        )

        # CLABSI line breakdown
        if indicator == "CLABSI" and line_text:
            n_ar = "حالة واحدة" if n == 1 else f"{n} حالات"
            fallback += (
                f"\nلقد سُجّلت {n_ar} {indicator} في قسم ال {floor}:\n_ {line_text}"
            )

        # Observations list
        obs = []
        if long_stay:
            pct = round(long_stay / n * 100)
            who = "جميع المرضى" if long_stay == n else f"{long_stay} مرضى"
            stay_desc = (
                "مدة القسطرة الوريدية لديهم تجاوزت الأسبوع"
                if indicator == "CLABSI"
                else "إقامتهم في المستشفى طويلة"
            )
            obs.append(
                f"{who} {stay_desc} أي ما يعادل ما نسبته {pct}% من مجمل الحالات"
            )
        if long_cath:
            pct  = round(long_cath / n * 100)
            who  = "جميع المرضى" if long_cath == n else f"{long_cath} مرضى"
            cath = (
                "تخطت القسطرة الوريدية لديهم الأسبوعين"
                if indicator == "CLABSI"
                else f"الميل البولي لديهم منذ فترة طويلة"
            )
            obs.append(
                f"{who} {cath} أي ما يعادل ما نسبته {pct}% من مجمل الحالات"
            )
        if gender_note and indicator == "CAUTI":
            obs.append(gender_note)
        if adv_age:
            pct = round(adv_age / n * 100)
            obs.append(
                f"{adv_age} {'مريض' if adv_age == 1 else 'مرضى'} "
                f"عمرهم فوق الـ 70 عاماً أي ما يعادل ما نسبته {pct}% من مجمل الحالات"
            )
        if diabetic:
            pct = round(diabetic / n * 100)
            obs.append(
                f"{diabetic} {'مريض' if diabetic == 1 else 'مرضى'} يعانون من السكري "
                f"أي ما يعادل ما نسبته {pct}% من مجمل الحالات"
            )

        if obs:
            fallback += "\nمن خلال هذا الجدول يتبين لنا أن:\n"
            fallback += "\n".join(f"- {o}" for o in obs)

        if child_note:
            fallback += f"\n{child_note}"

        if vap_note and indicator == "VAP":
            obs.append(vap_note)

        if obs and indicator == "CAUTI":
            fallback += "\nوهذه كلها عوامل تساهم في التقاط العدوى المكتسبة عبر الميل البولي."
        elif obs and indicator == "VAP":
            fallback += "\nوهذه كلها عوامل تساهم في التقاط عدوى المكتسبة بالتنفس الاصطناعي."

        return self._safe(prompt, 220) or fallback

    # =========================================================================
    # MEMORY MANAGEMENT
    # =========================================================================

    def unload(self):
        """Release the LLM from memory."""
        if self._llm is not None:
            try:
                del self._llm
                import gc
                gc.collect()
            except Exception:
                pass
            self._llm = None
        self._load_failed = False
        logger.info("ICAIService: model unloaded from memory")

    # =========================================================================
    # INTERNAL HELPERS
    # =========================================================================

    def _load_llm(self):
        if self._llm is not None:
            return True
        if self._load_failed:
            return False
        try:
            from llama_cpp import Llama
            import glob
            import os

            candidates = []
            for pattern in [
                "C:/models/*.gguf",
                "models/*.gguf",
                "models/qwen*.gguf",
                "/models/*.gguf",
                "/app/models/*.gguf",
                "python-service/models/*.gguf",
            ]:
                candidates.extend(glob.glob(pattern))
            if not candidates:
                raise FileNotFoundError("No GGUF model file found")

            qwen       = [p for p in candidates if "qwen" in p.lower()]
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
            logger.info(f"ICAIService: loaded {model_path}")
            return True
        except Exception as exc:
            logger.warning(f"ICAIService: could not load LLM — {exc}")
            self._load_failed = True
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
            logger.warning(f"ICAIService LLM call failed: {exc}")
            return None

    def _clean(self, text: str) -> str:
        # Take only the first non-empty paragraph (model sometimes writes two attempts)
        paragraphs = [p.strip() for p in re.split(r"\n{2,}", text) if p.strip()]
        text = paragraphs[0] if paragraphs else text.strip()
        # Remove CJK characters
        CJK = re.compile(
            r"[\u4e00-\u9fff\u3040-\u30ff\u3400-\u4dbf"
            r"\uf900-\ufaff\u31f0-\u31ff\ufe30-\ufe4f]+"
        )
        text = CJK.sub(" ", text)
        # Remove fullwidth punctuation (，、：；！？) and unicode directional marks
        text = re.sub(r"[\uff00-\uffef\u200f\u200e\u202a-\u202e]", "", text)
        # Remove brackets wrapping English abbreviations: ( ICU) → ICU, (CLABSI) → CLABSI
        text = re.sub(r"\(\s*([A-Za-z][A-Za-z0-9 \-]*)\s*\)", r"\1", text)
        # Collapse multiple spaces and strip trailing stray punctuation
        text = re.sub(r" {2,}", " ", text).strip()
        text = re.sub(r"[\s،,:：\-]+$", "", text).strip()
        return text

    def _validate(self, text: str) -> bool:
        if not text or len(text) < 30:
            return False
        if re.match(r"^\s*[\d\-\*\u2022\u00b7]+[\.\)\:]\s", text):
            return False
        ar_chars = sum(1 for c in text if "\u0600" <= c <= "\u06FF")
        # Must have at least 15 Arabic characters
        if ar_chars < 15:
            return False
        # Reject if English letters outnumber Arabic characters
        # (allows medical terms but rejects full English sentences)
        en_chars = sum(1 for c in text if c.isascii() and c.isalpha())
        if en_chars > ar_chars:
            return False
        return True

    def _safe(self, prompt: str, max_tokens: int = 250) -> Optional[str]:
        raw = self._call_llm(prompt, max_tokens=max_tokens)
        if not raw:
            return None
        cleaned = self._clean(raw)
        return cleaned if self._validate(cleaned) else None


# ── Singleton ──────────────────────────────────────────────────────────────────
ic_ai_service = ICAIService()


# ── Module-level helper ───────────────────────────────────────────────────────

def _age_years(val) -> Optional[float]:
    """Convert age_display ('45Y', '3M', '10D') or raw number to years."""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip()
    if s in ("N/A", "—", ""):
        return None
    if s.endswith("Y"):
        try:
            return float(s[:-1])
        except ValueError:
            return None
    if s.endswith("M"):
        try:
            return float(s[:-1]) / 12
        except ValueError:
            return None
    if s.endswith("D"):
        try:
            return float(s[:-1]) / 365
        except ValueError:
            return None
    try:
        return float(s)
    except ValueError:
        return None
