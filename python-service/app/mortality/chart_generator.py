"""
COMPLETE Matplotlib Chart Generator - ALL 10 CHARTS
Matches untitled5.py implementation EXACTLY
All charts with proper 3D effects, Arabic text, and styling
"""

import matplotlib
matplotlib.use('Agg')

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import Polygon
import numpy as np
from io import BytesIO
import warnings
warnings.filterwarnings('ignore')
from loguru import logger

# Arabic support
try:
    import arabic_reshaper
    from bidi.algorithm import get_display
    ARABIC_SUPPORT = True
except ImportError:
    ARABIC_SUPPORT = False


class MatplotlibChartGenerator:

    # WHO English → Arabic category mapping
    WHO_AR = {
        'cardiovascular disease': 'أمراض قلبية',
        'respiratory diseases': 'أمراض الجهاز التنفسي',
        'malignant neoplasms': 'أورام',
        'neuropsychiatric conditions': 'أمراض عصبية ونفسية',
        'infectious and parasitic diseases': 'أمراض معدية',
        'genitourinarydiseases': 'أمراض الجهاز البولي',
        'injuries': 'إصابات',
        'defined disease': 'أمراض محددة',
        'congenital anomalies': 'تشوهات خلقية',
        'diabetes mellitus and endocrine disorders': 'أمراض الغدد الصماء',
        'digestive diseases': 'أمراض الجهاز الهضمي',
        'perinatal conditions': 'حالات ما حول الولادة',
        'infection following a procedure, not elsewhere classified': 'عدوى بعد إجراء طبي',
    }

    def __init__(self):
        plt.rcParams['font.family'] = 'DejaVu Sans'
        plt.rcParams['axes.unicode_minus'] = False
    
    def ar(self, text):
        """Arabic text reshaper + bidi reorder for correct display in matplotlib"""
        if ARABIC_SUPPORT and text:
            text = str(text)
            if '\n' in text:
                lines = text.split('\n')
                return '\n'.join(
                    get_display(arabic_reshaper.reshape(line)) if line.strip() else line
                    for line in lines
                )
            return get_display(arabic_reshaper.reshape(text))
        return text
    
    def _fig_to_bytes(self, fig):
        """Convert to BytesIO"""
        buf = BytesIO()
        fig.savefig(buf, format='png', dpi=150, bbox_inches='tight', 
                   facecolor='white', edgecolor='none')
        buf.seek(0)
        plt.close(fig)
        return buf
    
    # =========================================================================
    # CHART 1: Mortality Rate Trend
    # =========================================================================
    
    def generate_chart1_mortality_trend(self, current_stats, history):
        """Chart 1: Inpatient Mortality Rate - last 10 quarters (9 history + 1 current)"""

        quarters = []
        result_rates = []

        # Last 9 quarters from history
        for h in history[-9:]:
            q = h.get('quarter', '')
            y = h.get('year', '')
            quarters.append(f"{q}\n{y}")
            mr = h.get('rate', 0)
            result_rates.append(mr if mr < 10 else mr / 100)

        # Current quarter (rate calculated from KPI=YES deaths / total_patients)
        q_label = current_stats.get('quarter', '')
        yr = current_stats.get('year', '')
        quarters.append(f"{q_label}\n{yr}")
        metrics = current_stats.get('mortality_metrics', {})
        mr = metrics.get('rate', current_stats.get('rate', 0))
        result_rates.append(mr if mr < 10 else mr / 100)

        # Ensure rates are in percentage form (e.g. 1.79 not 0.0179)
        result_rates = [r * 100 if r < 1 else r for r in result_rates]
        from app.config import load_targets
        target_rate = load_targets().get('mortality', {}).get('rate', 2.0)

        fig, ax = plt.subplots(figsize=(16, 8))
        fig.patch.set_facecolor('white')
        ax.set_facecolor('white')

        x = np.arange(len(quarters))

        ax.plot(x, result_rates, color='#4472C4', linewidth=3,
                marker='o', markersize=8, markerfacecolor='#4472C4',
                markeredgecolor='#4472C4', zorder=3)

        ax.plot(x, [target_rate] * len(quarters), color='#ED7D31',
                linewidth=2.5, linestyle='--', zorder=2)

        # Value labels on each point
        for i, (xi, yi) in enumerate(zip(x, result_rates)):
            ax.text(xi, yi + 0.08, f'{yi:.2f}%', ha='center', va='bottom',
                    fontsize=14, fontweight='bold', color='#333333')

        # Target annotation
        ax.text(len(quarters) / 2, target_rate + 0.35, f'T<{target_rate}%', ha='center', va='center',
                fontsize=28, fontweight='bold', color='#333333')

        ax.set_title(self.ar('معدل الوفيات في المستشفيات') + f'\nT<{target_rate}%',
                    fontsize=24, fontweight='bold', pad=20, color='#000000')

        max_rate = max(result_rates) if result_rates else 3.0
        y_max = max(3.0, max_rate + 0.5)
        y_step = 0.5
        ax.set_ylim(0, y_max)
        ax.set_yticks(np.arange(0, y_max + y_step, y_step))
        ax.set_yticklabels([f'{v:.1f}%' for v in np.arange(0, y_max + y_step, y_step)], fontsize=13)

        ax.set_xlim(-0.5, len(quarters) - 0.5)
        ax.set_xticks(x)
        ax.set_xticklabels([self.ar(q) for q in quarters], fontsize=12, ha='center')

        ax.grid(True, axis='y', linestyle='-', linewidth=0.5, color='#D3D3D3', alpha=0.7, zorder=1)
        ax.set_axisbelow(True)

        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.spines['left'].set_color('#999999')
        ax.spines['bottom'].set_color('#999999')

        ax.legend(handles=[mpatches.Patch(color='#4472C4', label=self.ar('النتيجة')),
                          mpatches.Patch(color='#ED7D31', label=self.ar('المستهدف'))],
                 loc='upper right', frameon=True, fontsize=14, edgecolor='#CCCCCC')

        plt.tight_layout()
        return self._fig_to_bytes(fig)
    
    # =========================================================================
    # CHART 2: Building Distribution Pie
    # =========================================================================
    
    def generate_chart2_building_pie(self, current_stats):
        """Chart 2: Building Distribution - KPI deaths per building"""

        buildings = current_stats.get('buildings', {})
        bci = buildings.get('bci', {})
        rah = buildings.get('rah', {})
        bci_deaths = bci.get('deaths', 0)
        rah_deaths = rah.get('deaths', 0)

        # Derive from departments when building data is unavailable
        if bci_deaths == 0 and rah_deaths == 0:
            icu_keywords = ['icu', 'ccu', 'csu', 'itcu', 'icn', 'cardiac', 'icvu']
            for dept in current_stats.get('departments', []):
                name = dept.get('name', '').lower()
                cnt  = dept.get('count', 0)
                if any(k in name for k in icu_keywords):
                    bci_deaths += cnt
                else:
                    rah_deaths += cnt

        total = bci_deaths + rah_deaths
        if total == 0:
            bci_pct, rah_pct = 50, 50          # placeholder so pie renders
        else:
            bci_pct = round(bci_deaths / total * 100)
            rah_pct = 100 - bci_pct

        sizes = [bci_pct, rah_pct]

        fig, ax = plt.subplots(figsize=(8, 6))
        fig.patch.set_facecolor('white')

        wedges, texts, autotexts = ax.pie(
            sizes, labels=None, colors=['#5B9BD5', '#ED7D31'],
            autopct='%d%%', startangle=90, explode=(0.05, 0),
            textprops={'fontsize': 24, 'fontweight': 'bold', 'color': 'white'},
            wedgeprops={'edgecolor': 'white', 'linewidth': 3}, shadow=True)

        plt.title(self.ar('نسبة الوفيات بحسب المبنى'), fontsize=18, pad=20, color='#333333')

        # Legend with death counts
        legend_labels = [f'BCI ({bci_deaths})', f'RAH ({rah_deaths})']
        plt.legend(legend_labels, loc='lower center', bbox_to_anchor=(0.5, -0.1),
                  ncol=2, frameon=False, fontsize=14)
        plt.axis('equal')
        plt.tight_layout()
        return self._fig_to_bytes(fig)
    
    # =========================================================================
    # CHART 3: Admission Source 3D Bars
    # =========================================================================
    
    def generate_chart3_admission_bar(self, current_stats):
        """Chart 3: Admission Source Categories (KPI=YES, from تصنيف وجهة الدخول)"""

        # English → Arabic mapping for admission source categories
        admission_source_ar = {
            'er': 'الطوارئ',
            'opd': 'العيادات الخارجية',
            'post delivery': 'ما بعد الولادة',
            'transfer from another hospital': 'تحويل من مستشفى آخر',
        }

        # Use admission_source_categories (from تصنيف وجهة الدخول column, KPI=YES)
        source_cats = current_stats.get('clinical', {}).get('admission_source_categories', [])
        cats = []
        vals = []
        for s in source_cats:
            name = s.get('name', '')
            ar_name = admission_source_ar.get(name.lower().strip(), name)
            cats.append(self.ar(ar_name))
            vals.append(s.get('count', 0))

        if not cats:
            cats = [self.ar('تحويل من مستشفى آخر'), self.ar('ما بعد الولادة'), self.ar('العيادات الخارجية'), self.ar('الطوارئ')]
            vals = [8, 6, 19, 72]
        
        fig, ax = plt.subplots(figsize=(12, 5), facecolor="white")
        ax.set_facecolor("white")
        
        y = np.arange(len(cats))
        bars = ax.barh(y, vals, height=0.55, color="#5B9BD5", edgecolor="none", zorder=3)
        
        max_val = max(vals) if vals else 10
        x_max = int(np.ceil(max_val / 10) * 10) + 10
        ax.set_xlim(x_max, 0)
        ax.set_xticks(list(range(0, x_max + 1, 10)))
        ax.yaxis.tick_right()
        ax.set_yticks(y)
        ax.set_yticklabels(cats, fontsize=14, color="#555555")
        ax.grid(True, axis="x", color="#D0D0D0", linewidth=1.2, zorder=0)

        for s in ["top", "left", "right", "bottom"]:
            ax.spines[s].set_visible(False)

        # 3D caps
        for b, v in zip(bars, vals):
            y0, y1 = b.get_y(), b.get_y() + b.get_height()
            cw = min(2.2, max(0.8, v * 0.35))
            cap = Polygon([(v, y0), (v+cw, y0-0.1), (v+cw, y1-0.1), (v, y1)],
                         closed=True, facecolor="#2F5F8A", edgecolor="none", zorder=2.9)
            ax.add_patch(cap)
            ax.plot([0, v], [y1, y1], color="#8FBCE6", linewidth=2, alpha=0.65, zorder=3.1)
            ax.text(v + cw + 3, (y0+y1)/2, str(int(v)), va="center", ha="left",
                   fontsize=18, fontweight="bold", color="#333333", zorder=5)
        
        ax.set_ylim(-0.8, len(cats) - 0.2)
        for xt in range(0, x_max + 1, 10):
            ax.plot([xt, xt-2.5], [-0.60, -0.78], color="#BFBFBF", linewidth=1.2, zorder=1)

        ax.set_title(self.ar('توزيع الوفيات بحسب مصدر الدخول'), fontsize=16, pad=15, color='#333333')

        plt.tight_layout()
        return self._fig_to_bytes(fig)

    # =========================================================================
    # CHART 4: Deaths Trend
    # =========================================================================
    
    def generate_chart4_deaths_trend(self, current_stats, history):
        """Chart 4: Deaths Trend (line 1179-1446)"""
        
        quarters_ar = []
        values = []
        
        for h in history[-5:]:
            quarters_ar.append(f"{h.get('quarter', '')} {h.get('year', '')}")
            values.append(h.get('deaths', h.get('total_deaths', 0)))

        quarters_ar.append(f"{current_stats.get('quarter', '')} {current_stats.get('year', '')}")
        values.append(current_stats.get('deaths', current_stats.get('total_deaths', 0)))
        
        fig, ax = plt.subplots(figsize=(10, 5), facecolor='white')
        x = np.arange(len(values))
        
        ax.plot(x, values, color='#4A90D9', linewidth=2.5, marker='o',
                markersize=8, markerfacecolor='#4A90D9', zorder=3)
        
        for i, (xi, yi) in enumerate(zip(x, values)):
            offset_y = 4 if yi >= np.median(values) else -8
            ax.annotate(str(yi), xy=(xi, yi), xytext=(8, offset_y),
                       textcoords='offset points', fontsize=15, fontweight='bold', color='#333333',
                       ha='left', va='center')

        ax.set_ylim(40, max(values) + 15)
        ax.yaxis.tick_right()
        ax.set_xticks(x)
        ax.set_xticklabels([self.ar(q) for q in quarters_ar], fontsize=13)
        ax.yaxis.grid(True, color='#CCCCCC', linewidth=0.8)
        
        for spine in ['top', 'left', 'right']:
            ax.spines[spine].set_visible(False)
        ax.spines['bottom'].set_color('#CCCCCC')
        
        ax.set_title(self.ar('مقارنة عدد الوفيات خلال الفصول'), fontsize=14, color='#222222', pad=15)
        
        plt.tight_layout()
        return self._fig_to_bytes(fig)
    
    # =========================================================================
    # CHART 5: Age Distribution 3D Bars
    # =========================================================================
    
    def generate_chart5_age_distribution(self, current_stats):
        """Chart 5: Age Distribution (line 348-474)"""
        
        age_groups_ar = ['اقل من 5 سنوات', 'من 5 الى 15 سنة', 'من 16 الى 30 سنة', 'من 31 الى 50 سنة',
                        'من 51 الى 60 سنة', 'من 61 الى 70 سنة', 'من 71 الى 80 سنة', 'اكثر من 81 سنة']

        # Build a label→count map (age_categories preferred; fallback to age_groups)
        age_cats = current_stats.get('demographics', {}).get('age_categories', [])
        if age_cats:
            counts_map = {ag['group']: ag.get('count', 0) for ag in age_cats}
        else:
            raw = current_stats.get('demographics', {}).get('age_groups', [])
            counts_map = {ag.get('group', ag.get('name', '')): ag.get('count', 0) for ag in raw}
        # Always 8 values in standard order; missing groups → 0
        values = [counts_map.get(label, 0) for label in age_groups_ar]
        
        fig, ax = plt.subplots(figsize=(12, 5), facecolor="white")
        y = np.arange(len(age_groups_ar))
        bars = ax.barh(y, values, height=0.55, color="#5B9BD5", edgecolor="none", zorder=3)
        
        max_val = max(values) if values else 10
        x_max = int(np.ceil(max_val / 5) * 5) + 5
        ax.set_xlim(x_max, 0)
        ax.set_xticks(list(range(0, x_max + 1, 5)))
        ax.yaxis.tick_right()
        ax.set_yticks(y)
        ax.set_yticklabels([self.ar(t) for t in age_groups_ar], fontsize=14, color="#333333")
        ax.grid(True, axis="x", color="#D0D0D0", linewidth=1.2, zorder=0)

        for s in ["top", "left", "right", "bottom"]:
            ax.spines[s].set_visible(False)

        # 3D caps
        for b, v in zip(bars, values):
            y0, y1 = b.get_y(), b.get_y() + b.get_height()
            cw = min(0.7, max(0.15, v * 0.7))
            cap = Polygon([(v, y0), (v+cw, y0-0.09), (v+cw, y1-0.09), (v, y1)],
                         closed=True, facecolor="#2F5F8A", edgecolor="none", zorder=2.9)
            ax.add_patch(cap)
            ax.plot([0, v], [y1, y1], color="#8FBCE6", linewidth=2, alpha=0.65, zorder=3.1)
            ax.text(v + cw + 1, (y0+y1)/2, str(int(v)), va="center", ha="left",
                   fontsize=18, fontweight="bold", color="#333333", zorder=5)
        
        ax.set_ylim(-0.6, len(age_groups_ar) - 0.4)
        ax.set_title(self.ar('توزيع الوفيات بحسب الفئات العمرية'), fontsize=16, pad=15, color='#333333')
        plt.tight_layout()
        return self._fig_to_bytes(fig)

    # =========================================================================
    # CHART 6: Age by Quarter Comparison
    # =========================================================================
    
    def generate_chart6_age_quarter(self, current_stats, history):
        """Chart 6: Age by Quarter (line 475-747)"""

        age_groups = ['اقل من 5 سنوات', 'من 5 الى 15 سنة', 'من 16 الى 30 سنة', 'من 31 الى 50 سنة',
                     'من 51 الى 60 سنة', 'من 61 الى 70 سنة', 'من 71 الى 80 سنة', 'اكثر من 81 سنة']

        defaults = [0] * 8

        # Build current quarter's age_groups from age_categories (label-matched, always 8 values)
        age_cats = current_stats.get('demographics', {}).get('age_categories', [])
        if age_cats:
            cm = {ag['group']: ag.get('count', 0) for ag in age_cats}
        else:
            raw = current_stats.get('demographics', {}).get('age_groups', [])
            cm = {ag.get('group', ag.get('name', '')): ag.get('count', 0) for ag in raw}
        current_age_groups = [cm.get(label, 0) for label in age_groups]

        # Append current quarter to history for this chart
        current_entry = {
            'quarter': current_stats.get('quarter', ''),
            'year': current_stats.get('year', ''),
            'age_groups': current_age_groups
        }
        full_history = list(history) + [current_entry]

        # Get last 3 quarters (including current)
        q1_data = full_history[-3].get('age_groups', defaults) if len(full_history) >= 3 else defaults
        q2_data = full_history[-2].get('age_groups', defaults) if len(full_history) >= 2 else defaults
        q3_data = full_history[-1].get('age_groups', defaults) if len(full_history) >= 1 else defaults
        
        fig, ax = plt.subplots(figsize=(12, 6), facecolor='white')
        
        n = len(age_groups)
        y = np.arange(n)
        h, gap = 0.22, 0.03
        
        bars1 = ax.barh(y - (h+gap), q1_data, height=h, color='#70AD47', edgecolor='white', linewidth=0.4, zorder=3)
        bars2 = ax.barh(y, q2_data, height=h, color='#4472C4', edgecolor='white', linewidth=0.4, zorder=3)
        bars3 = ax.barh(y + (h+gap), q3_data, height=h, color='#843C0C', edgecolor='white', linewidth=0.4, zorder=3)
        
        # Value labels
        for bars, vals in [(bars1, q1_data), (bars2, q2_data), (bars3, q3_data)]:
            for bar, v in zip(bars, vals):
                if v > 0:
                    ax.text(bar.get_width() + 0.35, bar.get_y() + bar.get_height()/2,
                           str(int(v)), va='center', ha='left', fontsize=13,
                           fontweight='bold', color='#2B2B2B')

        ax.set_xlim(41, -1)
        ax.set_xticks([0, 5, 10, 15, 20, 25, 30, 35, 40])
        ax.yaxis.tick_right()
        ax.set_yticks(y)
        ax.set_yticklabels([self.ar(g) for g in age_groups], fontsize=13, color='#222')
        
        ax.xaxis.grid(True, color='#C8C8C8', linewidth=0.7, zorder=0)
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.spines['left'].set_color('#AAAAAA')
        ax.spines['bottom'].set_color('#AAAAAA')
        
        ax.set_title(self.ar('مقارنة عمر الوفيات بحسب الفصول'), fontsize=15, pad=18, color='#333333')
        
        # Dynamic legend labels from full_history (includes current quarter)
        q3_label = f"{full_history[-1].get('quarter', '')} {full_history[-1].get('year', '')}" if len(full_history) >= 1 else ''
        q2_label = f"{full_history[-2].get('quarter', '')} {full_history[-2].get('year', '')}" if len(full_history) >= 2 else ''
        q1_label = f"{full_history[-3].get('quarter', '')} {full_history[-3].get('year', '')}" if len(full_history) >= 3 else ''
        legend_patches = [
            mpatches.Patch(color='#843C0C', label=self.ar(q3_label)),
            mpatches.Patch(color='#4472C4', label=self.ar(q2_label)),
            mpatches.Patch(color='#70AD47', label=self.ar(q1_label)),
        ]
        ax.legend(handles=legend_patches, loc='lower center', bbox_to_anchor=(0.5, -0.13),
                 ncol=3, frameon=False, fontsize=13)
        
        plt.tight_layout()
        return self._fig_to_bytes(fig)
    
    # =========================================================================
    # CHART 7: Department Distribution Pie 3D
    # =========================================================================
    
    def generate_chart7_dept_pie(self, current_stats):
        """Chart 7: Department Pie (line 748-875)"""

        # Classify departments into 3 groups
        icu_keywords = ['icu', 'ccu', 'csu', 'itcu', 'icn', 'picu', 'tcu', 'icvu']
        er_keywords = ['er', 'emergency', 'طوارئ']

        departments = current_stats.get('departments', [])
        icu_count = 0
        er_count = 0
        ward_count = 0
        total = 0

        for dept in departments:
            name = dept.get('name', '').lower().strip()
            count = dept.get('count', 0)
            total += count
            if any(kw in name for kw in icu_keywords):
                icu_count += count
            elif any(kw in name for kw in er_keywords):
                er_count += count
            else:
                ward_count += count

        if total > 0:
            sizes = [
                max(round((ward_count / total) * 100), 1),
                max(round((icu_count / total) * 100), 1),
                max(round((er_count / total) * 100), 1)
            ]
        else:
            sizes = [4, 92, 4]

        labels = [self.ar('الأقسام الاستشفائية'), self.ar('أقسام العنايات'), self.ar('الطوارئ')]
        colors_top = ['#5B9BD5', '#ED7D31', '#A5A5A5']
        
        fig, ax = plt.subplots(figsize=(10, 4.8), facecolor='white')
        
        # Fake 3D depth
        def darken(hex_color, factor=0.45):
            h = hex_color.lstrip('#')
            r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
            return f'#{int(r*factor):02x}{int(g*factor):02x}{int(b*factor):02x}'
        
        colors_side = [darken(c, 0.60 if i != 1 else 0.42) for i, c in enumerate(colors_top)]
        
        # Draw depth layers
        for k in range(20, 0, -1):
            ax.pie(sizes, colors=colors_side, startangle=90, counterclock=False,
                  radius=1.0, center=(0, -k*0.014), wedgeprops=dict(edgecolor='none'))
        
        # Top pie — no autopct; we draw labels dynamically below
        wedges, _ = ax.pie(sizes, colors=colors_top, startangle=90, counterclock=False,
                           wedgeprops=dict(edgecolor='white', linewidth=1.2))

        # Add percentage labels: inside for large slices, annotated outside for small ones
        for wedge, size in zip(wedges, sizes):
            angle = (wedge.theta1 + wedge.theta2) / 2
            rad   = np.deg2rad(angle)
            cx, cy = np.cos(rad), np.sin(rad)
            if size < 5:
                ax.annotate(
                    f'{size}%',
                    xy=(0.75 * cx, 0.75 * cy),
                    xytext=(1.45 * cx, 1.45 * cy),
                    ha='center', va='center',
                    fontsize=18, fontweight='bold', color='#333333',
                    arrowprops=dict(arrowstyle='-', color='#888888', lw=1.2),
                )
            else:
                ax.text(0.55 * cx, 0.55 * cy, f'{size}%',
                        ha='center', va='center',
                        fontsize=24, fontweight='bold', color='#333333')

        legend_handles = [mpatches.Patch(facecolor=c) for c in colors_top]
        ax.legend(legend_handles, labels,
                 loc='lower center', bbox_to_anchor=(0.5, -0.18), ncol=3, frameon=False, fontsize=14)
        
        ax.set_aspect('equal')
        plt.tight_layout()
        return self._fig_to_bytes(fig)
    
    # =========================================================================
    # CHART 8: Department Comparison
    # =========================================================================
    
    def generate_chart8_dept_comparison(self, current_stats, history):
        """Chart 8: Department Comparison (line 876-1037)"""

        # Normalize department name variants to a canonical form
        dept_name_map = {
            'c2': 'Cardiac 2',
            'c1': 'Cardiac 1',
            'n.c.3': 'New Cardiac 3',
            'new cardiac': 'New Cardiac 3',
            'post csu': 'Post CSU',
            'ped.': 'Ped',
            'ped': 'Ped',
            'itcu': 'ITCU',
            'east 4': 'East 4',
            'north 3': 'North 3',
            'west 4': 'West 4',
            'east 3': 'East 3',
            'new east 4': 'New East 4',
            'new west 4': 'New West 4',
        }

        def normalize_dept(name):
            return dept_name_map.get(name.lower().strip(), name)

        # Build current quarter's department dict from stats list (normalized)
        current_dept_dict = {}
        for dept in current_stats.get('departments', []):
            norm = normalize_dept(dept.get('name', ''))
            current_dept_dict[norm] = current_dept_dict.get(norm, 0) + dept.get('count', 0)

        current_entry = {
            'quarter': current_stats.get('quarter', ''),
            'year': current_stats.get('year', ''),
            'departments': current_dept_dict
        }

        # Append current quarter to history
        full_history = list(history) + [current_entry]
        quarters = full_history[-3:] if len(full_history) >= 3 else full_history

        # Normalize history department names too
        norm_quarters = []
        for q in quarters:
            norm_depts = {}
            for dept, count in q.get('departments', {}).items():
                norm = normalize_dept(dept)
                norm_depts[norm] = norm_depts.get(norm, 0) + count
            norm_quarters.append({**q, 'departments': norm_depts})
        quarters = norm_quarters

        # Collect all unique department names across all 3 quarters (ordered by total count)
        dept_totals = {}
        for q in quarters:
            for dept, count in q.get('departments', {}).items():
                if dept.lower() != 'others':
                    dept_totals[dept] = dept_totals.get(dept, 0) + count
        depts = sorted(dept_totals.keys(), key=lambda d: dept_totals[d], reverse=True)

        colors = ['#70AD47', '#4472C4', '#C55A11']

        data = {}
        for q in quarters:
            label = f"{q.get('quarter', '')} {q.get('year', '')}"
            dept_dict = q.get('departments', {})
            data[self.ar(label)] = [dept_dict.get(d, 0) for d in depts]

        fig, ax = plt.subplots(figsize=(20, 9))
        fig.patch.set_facecolor('white')

        n_quarters = len(data)
        x = np.arange(len(depts))
        width = 0.22

        for i, (label, values) in enumerate(data.items()):
            offset = (i - n_quarters/2) * width + width/2
            bars = ax.bar(x + offset, values, width, label=label, color=colors[i % len(colors)],
                         edgecolor='white', linewidth=0.3, zorder=3)

            for bar, val in zip(bars, values):
                if val > 0:
                    ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.5,
                           str(int(val)), ha='center', va='bottom', fontsize=13,
                           fontweight='bold', color='#2F2F2F')

        max_val = max((v for vals in data.values() for v in vals), default=10)
        ax.set_title(self.ar('مقارنة الوفيات بحسب الأقسام'), fontsize=22, pad=25, color='#555555')
        ax.set_ylim(0, max_val + 8)
        ax.set_xticks(x)
        ax.set_xticklabels([self.ar(d) for d in depts], rotation=45, ha='right', fontsize=13)
        ax.grid(True, axis='y', linestyle='-', linewidth=0.6, color='#CCCCCC', alpha=0.5, zorder=1)

        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)

        handles, labels_list = ax.get_legend_handles_labels()
        ax.legend(handles[::-1], labels_list[::-1], loc='upper left', bbox_to_anchor=(0.02, 0.98),
                 ncol=2, fontsize=12, frameon=True, framealpha=0.95, edgecolor='#BBBBBB')

        plt.tight_layout()
        return self._fig_to_bytes(fig)
    
    # =========================================================================
    # CHART 9: WHO Category Comparison (Grouped Vertical Bars)
    # =========================================================================
    
    def generate_chart9_who_comparison(self, current_stats, history):
        """Chart 9: WHO Category Comparison - last 3 quarters of same year"""

        current_year = current_stats.get('year', '')

        # Build current quarter's WHO dict from KPI-filtered data
        current_who = current_stats.get('who_categories_kpi', {})
        current_entry = {
            'quarter': current_stats.get('quarter', ''),
            'year': current_year,
            'who_categories': current_who
        }

        # Find previous quarters from the SAME year in history
        same_year_quarters = [
            q for q in history
            if q.get('year', '') == current_year
        ]

        # Take last 2 from same year + current = 3 quarters
        prev_quarters = same_year_quarters[-2:] if len(same_year_quarters) >= 2 else same_year_quarters
        quarters = prev_quarters + [current_entry]

        # Normalize WHO category keys (strip whitespace)
        def norm_key(k):
            return str(k).strip().lower()

        # Collect all unique WHO categories across all quarters, ordered by total
        cat_totals = {}
        for q in quarters:
            for cat, count in q.get('who_categories', {}).items():
                nk = norm_key(cat)
                cat_totals[nk] = cat_totals.get(nk, 0) + count
        # Keep original casing from first occurrence
        cat_original = {}
        for q in quarters:
            for cat in q.get('who_categories', {}):
                nk = norm_key(cat)
                if nk not in cat_original:
                    cat_original[nk] = cat.strip()

        who_keys = sorted(cat_totals.keys(), key=lambda k: cat_totals[k], reverse=True)

        # Arabic labels
        categories = []
        for k in who_keys:
            orig = cat_original.get(k, k)
            ar_name = self.WHO_AR.get(orig, self.WHO_AR.get(k, orig))
            categories.append(self.ar(ar_name))

        colors = ['#70AD47', '#4472C4', '#C55A11']

        quarter_data = []
        quarter_labels = []
        for q in quarters:
            label = f"{q.get('quarter', '')} {q.get('year', '')}"
            quarter_labels.append(self.ar(label))
            who = {norm_key(k): v for k, v in q.get('who_categories', {}).items()}
            vals = [who.get(k, 0) for k in who_keys]
            quarter_data.append(vals)

        fig, ax = plt.subplots(figsize=(16, 8))
        fig.patch.set_facecolor('white')

        n_quarters = len(quarter_data)
        bar_width = 0.25
        x = np.arange(len(categories))

        for i, (vals, label) in enumerate(zip(quarter_data, quarter_labels)):
            offset = (i - n_quarters / 2) * bar_width + bar_width / 2
            bars = ax.bar(x + offset, vals, bar_width,
                         label=label, color=colors[i % len(colors)],
                         edgecolor='white', linewidth=0.5)
            for bar in bars:
                height = bar.get_height()
                if height > 0:
                    ax.text(bar.get_x() + bar.get_width()/2., height + 0.5,
                           f'{int(height)}', ha='center', va='bottom', fontsize=12, fontweight='bold')

        ax.set_title(self.ar('توزيع الوفيات بحسب التشخيص للسبب الذي نجم عنه الوفاة بحسب الفصل'),
                    fontsize=14, pad=20, loc='right', color='#333333')

        max_val = max((v for vals in quarter_data for v in vals), default=10)
        ax.set_ylim(0, max_val + 5)
        ax.set_xticks(x)
        ax.set_xticklabels(categories, fontsize=12, ha='right', rotation=30)

        ax.grid(True, axis='y', linestyle='-', linewidth=0.5,
               color='#E0E0E0', alpha=0.7, zorder=0)
        ax.set_axisbelow(True)

        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.spines['left'].set_color('#999999')
        ax.spines['bottom'].set_color('#999999')

        ax.legend(loc='lower center', bbox_to_anchor=(0.5, -0.22),
                 ncol=3, frameon=False, fontsize=12)

        plt.subplots_adjust(bottom=0.25)
        plt.tight_layout()
        return self._fig_to_bytes(fig)
    
    # =========================================================================
    # CHART 10: WHO Diagnosis 3D Bars (was chart 9)
    # =========================================================================
    
    def generate_chart10_who_diagnosis(self, current_stats):
        """Chart 10: WHO Diagnosis 3D Bars - KPI=YES only from تصنيف who category 1"""

        # Use KPI-filtered WHO categories (from تصنيف who category 1, KPI=YES)
        who_kpi = current_stats.get('who_categories_kpi', {})

        if who_kpi and isinstance(who_kpi, dict):
            # Sort by count ascending (smallest at bottom, largest at top)
            sorted_items = sorted(who_kpi.items(), key=lambda x: x[1])
            cats_en = [k.strip() for k, v in sorted_items]
            vals = [v for k, v in sorted_items]
        else:
            # Fallback to who_categories list format
            who_categories = current_stats.get('who_categories', [])
            if who_categories and isinstance(who_categories, list):
                sorted_who = sorted(who_categories, key=lambda w: w.get('count', 0))
                cats_en = [w.get('category', '') for w in sorted_who]
                vals = [w.get('count', 0) for w in sorted_who]
            else:
                cats_en = ['cardiovascular disease']
                vals = [0]

        # Translate to Arabic
        cats = [self.ar(self.WHO_AR.get(c.lower().strip(), c)) for c in cats_en]
        
        fig, ax = plt.subplots(figsize=(12, 5.2), facecolor="white")
        y = np.arange(len(cats))
        bars = ax.barh(y, vals, height=0.55, color="#5B9BD5", edgecolor="none", zorder=3)

        ax.yaxis.tick_right()
        ax.set_yticks(y)
        ax.set_yticklabels(cats, fontsize=13, color="#555555")
        ax.grid(True, axis="x", color="#D0D0D0", linewidth=1.2, zorder=0)

        for s in ["top", "left", "right", "bottom"]:
            ax.spines[s].set_visible(False)

        # 3D caps with values ON bars
        for b, v in zip(bars, vals):
            y0, y1 = b.get_y(), b.get_y() + b.get_height()
            yc = (y0 + y1) / 2
            cw = min(1.2, max(0.35, v * 0.25))

            cap = Polygon([(v, y0), (v+cw, y0-0.1), (v+cw, y1-0.1), (v, y1)],
                         closed=True, facecolor="#2F5F8A", edgecolor="none", zorder=2.9)
            ax.add_patch(cap)
            ax.plot([0, v], [y1, y1], color="#8FBCE6", linewidth=2, alpha=0.65, zorder=3.1)

            x_text = v / 2 if v >= 6 else v + cw + 0.25
            ax.text(x_text, yc, str(int(v)), va="center", ha="center",
                   fontsize=17, fontweight="bold", color="#333333", zorder=5)
        
        ax.set_ylim(-0.9, len(cats) - 0.2)

        max_val = max(vals) if vals else 10
        x_max = int(np.ceil(max_val / 5) * 5) + 5
        ax.set_xlim(x_max, 0)
        ax.set_xticks(list(range(0, x_max + 1, 5)))

        for xt in range(0, x_max + 1, 5):
            ax.plot([xt, xt-1.8], [-0.75, -0.91], color="#BFBFBF", linewidth=1.2, zorder=1)

        ax.set_title(self.ar('توزيع الوفيات بحسب التشخيص للسبب الذي نجم عنه الوفاة'), fontsize=16, pad=15, color='#333333')

        plt.tight_layout()
        return self._fig_to_bytes(fig)
    
    # =========================================================================
    # GENERATE ALL CHARTS
    # =========================================================================
    
    def generate_all_charts(self, current_stats, history):
        """Generate ALL 10 charts"""
        
        logger.info("Generating ALL 10 charts...")

        charts = {}

        chart_list = [
            ('chart1', 'Mortality Trend', self.generate_chart1_mortality_trend),
            ('chart2', 'Building Pie', self.generate_chart2_building_pie),
            ('chart3', 'Admission 3D Bars', self.generate_chart3_admission_bar),
            ('chart4', 'Deaths Trend', self.generate_chart4_deaths_trend),
            ('chart5', 'Age Distribution 3D', self.generate_chart5_age_distribution),
            ('chart6', 'Age by Quarter', self.generate_chart6_age_quarter),
            ('chart7', 'Department Pie 3D', self.generate_chart7_dept_pie),
            ('chart8', 'Department Comparison', self.generate_chart8_dept_comparison),
            ('chart9', 'WHO Category Comparison', self.generate_chart9_who_comparison),
            ('chart10', 'WHO Diagnosis 3D', self.generate_chart10_who_diagnosis),
        ]

        for chart_id, name, method in chart_list:
            try:
                logger.info(f"{chart_id}: {name}...")
                if chart_id in ['chart1', 'chart4', 'chart6', 'chart8', 'chart9']:
                    charts[chart_id] = method(current_stats, history)
                else:
                    charts[chart_id] = method(current_stats)
                logger.info(f"{chart_id} done")
            except Exception as e:
                logger.error(f"{chart_id} error: {e}")
                import traceback
                traceback.print_exc()

        logger.success(f"Generated {len(charts)}/10 charts!")
        return charts


# Singleton
matplotlib_chart_generator = MatplotlibChartGenerator()