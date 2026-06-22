"""
Statistics Calculator - All mortality metrics and analysis
"""

import pandas as pd
import numpy as np
from typing import Dict, List
from loguru import logger


class MortalityStatistics:
    """Calculate comprehensive mortality statistics"""
    
    def calculate_all_statistics(
        self,
        df: pd.DataFrame,
        total_patients: int = None,
        admission_data: Dict = None
    ) -> Dict:
        """
        Calculate complete statistics package
        
        Args:
            df: Cleaned DataFrame
            total_patients: Total admissions (for mortality rate)
            admission_data: Building-specific admission data
            
        Returns:
            Complete statistics dictionary
        """
        logger.info(f"📊 Calculating statistics for {len(df)} records")

        # KPI-filtered dataframe (patients who stayed > 24 hours)
        if 'include_kpi' in df.columns:
            kpi_df = df[df['include_kpi'].str.upper() == 'YES']
        else:
            kpi_df = df
        kpi_deaths = len(kpi_df)

        stats = {
            'total_deaths': len(df),
            'demographics': self._demographics(kpi_df),
            'departments': self._departments(kpi_df),
            'specialties': self._specialties(kpi_df),
            'temporal': self._temporal(df),
            'clinical': self._clinical(kpi_df)
        }

        # Mortality rate (KPI=YES deaths only)
        if total_patients and total_patients > 0:
            stats['mortality_metrics'] = self._mortality_rate(kpi_deaths, total_patients)
            stats['kpi_deaths'] = kpi_deaths

        # Average length of stay (KPI=YES records)
        if 'length_of_stay' in kpi_df.columns:
            los_vals = pd.to_numeric(kpi_df['length_of_stay'], errors='coerce').dropna()
            stats['avg_los'] = round(float(los_vals.mean()), 1) if len(los_vals) > 0 else 0

        # KPI=NO count (deaths excluded from KPI — died within 24h)
        stats['kpi_no_count'] = len(df) - kpi_deaths
        
        # WHO categories from KPI-filtered data
        if 'who_category_1' in kpi_df.columns:
            who_counts = kpi_df['who_category_1'].dropna().str.strip().value_counts()
            stats['who_categories_kpi'] = {
                str(cat).strip(): int(count)
                for cat, count in who_counts.items()
                if str(cat).strip() and str(cat).strip().lower() != 'nan'
            }

        # Buildings (KPI deaths only, consistent with all other stats)
        if admission_data:
            stats['buildings'] = admission_data
        else:
            stats['buildings'] = self._buildings(kpi_df)
        
        logger.success("✅ Statistics calculated")
        return stats
    
    def _mortality_rate(self, deaths: int, total: int) -> Dict:
        """Calculate mortality rate"""
        rate = (deaths / total) * 100
        return {
            'deaths': deaths,
            'total_patients': total,
            'rate': round(rate, 2),
            'formatted': f'{rate:.2f}%',
            'survival_rate': round(100 - rate, 2),
            'survival_formatted': f'{100 - rate:.2f}%'
        }
    
    def _demographics(self, df: pd.DataFrame) -> Dict:
        """Age and gender statistics"""
        demo = {}
        
        # Age stats
        if 'age' in df.columns:
            ages = df['age'].dropna()
            if len(ages) > 0:
                demo['age'] = {
                    'mean': round(ages.mean(), 1),
                    'median': round(ages.median(), 1),
                    'min': int(ages.min()),
                    'max': int(ages.max()),
                    'std': round(ages.std(), 1)
                }
        
        # Gender
        if 'gender' in df.columns:
            male = len(df[df['gender'] == 'ذكر'])
            female = len(df[df['gender'] == 'انثى'])
            total = len(df)
            
            demo['gender'] = {
                'male': male,
                'female': female,
                'male_percentage': round((male / total) * 100, 1),
                'female_percentage': round((female / total) * 100, 1)
            }
        
        # Age groups (calculated from numeric age)
        if 'age_group' in df.columns:
            groups = df['age_group'].value_counts().to_dict()
            demo['age_groups'] = [
                {'group': k, 'count': int(v), 'percentage': round((v/len(df))*100, 1)}
                for k, v in groups.items()
            ]

        # Age categories (from تصنيف العمر column - original classification)
        if 'age_category' in df.columns:
            # Map raw category names to standard labels
            age_cat_map = {
                # Under 5
                'اقل من 5 سنوات': 'اقل من 5 سنوات',
                'أقل من 5 سنوات': 'اقل من 5 سنوات',
                'اقل من 5 سنة': 'اقل من 5 سنوات',
                'أقل من 5 سنة': 'اقل من 5 سنوات',
                '0-4 سنوات': 'اقل من 5 سنوات',
                '0-4 سنة': 'اقل من 5 سنوات',
                # 5-15
                'من 5 الى 15 سنة': 'من 5 الى 15 سنة',
                'من 5 - 15 سنة': 'من 5 الى 15 سنة',
                'من 5 -- 15 سنة': 'من 5 الى 15 سنة',
                'من 5--15 سنة': 'من 5 الى 15 سنة',
                '5-15 سنوات': 'من 5 الى 15 سنة',
                '5-15 سنة': 'من 5 الى 15 سنة',
                '5 - 15 سنوات': 'من 5 الى 15 سنة',
                '5 - 15 سنة': 'من 5 الى 15 سنة',
                # 16-30
                'من 16 الى 30 سنة': 'من 16 الى 30 سنة',
                'من 16 - 30 سنة': 'من 16 الى 30 سنة',
                'من 16 -- 30 سنة': 'من 16 الى 30 سنة',
                'من 16--30 سنة': 'من 16 الى 30 سنة',
                '16-30 سنوات': 'من 16 الى 30 سنة',
                '16-30 سنة': 'من 16 الى 30 سنة',
                '16 - 30 سنوات': 'من 16 الى 30 سنة',
                '16 - 30 سنة': 'من 16 الى 30 سنة',
                # 31-50
                'من 31 الى 50 سنة': 'من 31 الى 50 سنة',
                'من 31 -- 50 سنة': 'من 31 الى 50 سنة',
                'من 31 - 50 سنة': 'من 31 الى 50 سنة',
                'من 31--50 سنة': 'من 31 الى 50 سنة',
                '31-50 سنوات': 'من 31 الى 50 سنة',
                '31-50 سنة': 'من 31 الى 50 سنة',
                '31 - 50 سنوات': 'من 31 الى 50 سنة',
                '31 - 50 سنة': 'من 31 الى 50 سنة',
                # 51-60
                'من 51 الى 60 سنة': 'من 51 الى 60 سنة',
                'من 51--60 سنة': 'من 51 الى 60 سنة',
                'من 51 -- 60 سنة': 'من 51 الى 60 سنة',
                'من 51 - 60 سنة': 'من 51 الى 60 سنة',
                '51-60 سنوات': 'من 51 الى 60 سنة',
                '51-60 سنة': 'من 51 الى 60 سنة',
                '51 - 60 سنوات': 'من 51 الى 60 سنة',
                '51 - 60 سنة': 'من 51 الى 60 سنة',
                # 61-70
                'من 61 الى 70 سنة': 'من 61 الى 70 سنة',
                'من 61 -- 70 سنة': 'من 61 الى 70 سنة',
                'من 61 - 70 سنة': 'من 61 الى 70 سنة',
                'من 61--70 سنة': 'من 61 الى 70 سنة',
                '61-70 سنوات': 'من 61 الى 70 سنة',
                '61-70 سنة': 'من 61 الى 70 سنة',
                '61 - 70 سنوات': 'من 61 الى 70 سنة',
                '61 - 70 سنة': 'من 61 الى 70 سنة',
                # 71-80
                'من 71 الى 80 سنة': 'من 71 الى 80 سنة',
                'من 71 -- 80 سنة': 'من 71 الى 80 سنة',
                'من 71 - 80 سنة': 'من 71 الى 80 سنة',
                'من 71--80 سنة': 'من 71 الى 80 سنة',
                '71-80 سنوات': 'من 71 الى 80 سنة',
                '71-80 سنة': 'من 71 الى 80 سنة',
                '71 - 80 سنوات': 'من 71 الى 80 سنة',
                '71 - 80 سنة': 'من 71 الى 80 سنة',
                # 81+
                'اكثر من 81 سنة': 'اكثر من 81 سنة',
                'أكثر من 81 سنة': 'اكثر من 81 سنة',
                '81 سنة و ما فوق': 'اكثر من 81 سنة',
                'من 81 سنة وما فوق': 'اكثر من 81 سنة',
                '81 سنوات وما فوق': 'اكثر من 81 سنة',
                '81+ سنوات': 'اكثر من 81 سنة',
                '81+ سنة': 'اكثر من 81 سنة',
                '81 وما فوق': 'اكثر من 81 سنة',
            }
            # Standard order
            standard_labels = [
                'اقل من 5 سنوات', 'من 5 الى 15 سنة', 'من 16 الى 30 سنة',
                'من 31 الى 50 سنة', 'من 51 الى 60 سنة', 'من 61 الى 70 سنة',
                'من 71 الى 80 سنة', 'اكثر من 81 سنة'
            ]
            # Map and count — normalize whitespace before lookup so extra spaces don't cause misses
            normalized = df['age_category'].astype(str).str.strip().str.replace(r'\s+', ' ', regex=True)
            mapped = normalized.map(age_cat_map).dropna()
            counts = mapped.value_counts().to_dict()
            total = len(df)
            demo['age_categories'] = [
                {
                    'group': label,
                    'count': int(counts.get(label, 0)),
                    'percentage': round((counts.get(label, 0) / total) * 100, 1)
                }
                for label in standard_labels
            ]

        return demo
    
    def _departments(self, df: pd.DataFrame) -> List[Dict]:
        """Department statistics"""
        if 'nursing_department' not in df.columns:
            return []
        
        counts = df['nursing_department'].value_counts()
        total = len(df)
        
        departments = []
        for dept, count in counts.items():
            departments.append({
                'name': dept,
                'count': int(count),
                'percentage': round((count / total) * 100, 1)
            })
        
        return sorted(departments, key=lambda x: x['count'], reverse=True)
    
    def _specialties(self, df: pd.DataFrame) -> List[Dict]:
        """Specialty statistics"""
        if 'specialty' not in df.columns:
            return []
        
        counts = df['specialty'].value_counts()
        total = len(df)
        
        specialties = []
        for spec, count in counts.items():
            specialties.append({
                'name': spec,
                'count': int(count),
                'percentage': round((count / total) * 100, 1)
            })
        
        return sorted(specialties, key=lambda x: x['count'], reverse=True)
    
    def _temporal(self, df: pd.DataFrame) -> Dict:
        """Temporal patterns"""
        temporal = {}
        
        if 'month' in df.columns:
            monthly = df['month'].value_counts().sort_index()
            temporal['monthly'] = {int(k): int(v) for k, v in monthly.items()}
            
            # Monthly array for charts
            temporal['monthly_array'] = [
                {'month': int(k), 'count': int(v)}
                for k, v in monthly.items()
            ]
        
        return temporal
    
    def _clinical(self, df: pd.DataFrame) -> Dict:
        """Clinical data"""
        clinical = {}
        
        # Top causes
        if 'direct_cause_of_death' in df.columns:
            causes = df['direct_cause_of_death'].value_counts().head(10)
            clinical['top_causes'] = [
                {'name': cause, 'count': int(count)}
                for cause, count in causes.items()
            ]
        
        # Admission sources
        if 'admission_source' in df.columns:
            sources = df['admission_source'].value_counts()
            clinical['admission_sources'] = [
                {
                    'name': source,
                    'count': int(count),
                    'percentage': round((count/len(df))*100, 1)
                }
                for source, count in sources.items()
            ]

        # Admission source categories (from تصنيف وجهة الدخول)
        if 'admission_source_category' in df.columns:
            cats = df['admission_source_category'].value_counts()
            total = len(df)
            clinical['admission_source_categories'] = [
                {
                    'name': cat,
                    'count': int(count),
                    'percentage': round((count / total) * 100, 1)
                }
                for cat, count in cats.items()
            ]

        return clinical
    
    def _buildings(self, df: pd.DataFrame) -> Dict:
        """Building distribution"""
        buildings = {'bci': {'deaths': 0}, 'rah': {'deaths': 0}}
        
        if 'building' in df.columns:
            bci = len(df[df['building'].str.contains('BCI', case=False, na=False)])
            rah = len(df) - bci
        else:
            # Classify by department
            cardiac_depts = ['ICVU', 'CSU', 'CCU', 'ITCU', 'Cardiac']
            if 'nursing_department' in df.columns:
                bci = len(df[df['nursing_department'].str.contains(
                    '|'.join(cardiac_depts), case=False, na=False
                )])
                rah = len(df) - bci
            else:
                bci = 0
                rah = len(df)
        
        total = len(df)
        buildings['bci']['deaths'] = bci
        buildings['bci']['percentage'] = round((bci/total)*100, 1) if total > 0 else 0
        buildings['rah']['deaths'] = rah
        buildings['rah']['percentage'] = round((rah/total)*100, 1) if total > 0 else 0
        
        return buildings


# Singleton
statistics_calculator = MortalityStatistics()