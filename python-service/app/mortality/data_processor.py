"""
Data Processor - Professional data cleaning with Pandas
Handles all data validation, cleaning, and standardization
"""

import pandas as pd
import numpy as np
from typing import Dict, Tuple
from loguru import logger


class MortalityDataProcessor:
    """
    Professional data cleaning for mortality records.
    Handles BOTH CSV (position-based) and Excel (name-based) inputs.
    """

    # =========================================================================
    # POSITION-BASED MAPPING (for CSV with garbled Arabic column names)
    # =========================================================================
    POSITION_MAPPINGS = {
        0: 'year',
        1: 'month',
        2: 'patient_id',
        5: 'age',
        7: 'admission_date',
        8: 'admission_source',
        10: 'admission_time',
        11: 'direct_cause_of_death',
        12: 'direct_cause_code',
        17: 'death_date',
        18: 'death_time',
        19: 'underlying_cause_of_death',
        20: 'underlying_cause_code',
        22: 'who_category_1',
        23: 'who_category_2',
        39: 'nursing_department',
        40: 'building',
        41: 'specialty',
        42: 'gender',
        43: 'insurance',
        44: 'residence',
        45: 'length_of_stay',
        46: 'include_kpi'
    }

    # =========================================================================
    # NAME-BASED MAPPING (for Excel with proper column names)
    # =========================================================================
    COLUMN_MAPPINGS = {
        # Basic info
        'العام': 'year',
        'year': 'year',
        'شهر': 'month',
        'month': 'month',
        'patientId': 'patient_id',

        # Age
        'العمر': 'age',
        'Age': 'age',
        'age': 'age',
        'العمر بالتفصيل': 'age_detail',
        'تصنيف العمر': 'age_category',
        'سنة الولادة - شهر الولادة - اليوم': 'birth_date',

        # Admission
        'تاريخ الدخول': 'admission_date',
        'ساعة الدخول': 'admission_time',
        'وجهة الدخول': 'admission_source',
        'تصنيف وجهة الدخول': 'admission_source_category',

        # Death
        'تاريخ الوفاة': 'death_date',
        'تاريخ الوفاة  ': 'death_date',  # Note: extra space in column name
        'ساعة الوفاة': 'death_time',

        # Diagnosis
        'التشخيص للسبب المباشر للوفاة': 'direct_cause_of_death',
        'رمز التشخيص للسبب المباشر للوفاة': 'direct_cause_code',
        'رمز التشخيص للسبب المباشر للوفاة ': 'direct_cause_code',  # Extra space
        'التشخيص للسبب الذي نجم عنه الوفاة': 'underlying_cause_of_death',
        'رمز التشخيص للسبب الذي نجم عنه الوفاة': 'underlying_cause_code',
        'التصنيف رمز التشخيص': 'diagnosis_classification',

        # WHO Categories
        'تصنيف who category 1': 'who_category_1',
        'تصنيف who category 1 ': 'who_category_1',  # Extra space
        'تصنيف who category 2': 'who_category_2',

        # Department/Location
        'القسم التمريضي': 'nursing_department',
        'رقم الغرفة': 'room_number',
        'المبنى': 'building',
        'الإختصاص': 'specialty',

        # Patient info
        'الجنس': 'gender',
        'gender': 'gender',
        'الجهة الضامنة': 'insurance',
        'الإقامة': 'length_of_stay',

        # Stay duration
        'los': 'length_of_stay',

        # Other
        'رقم السجل': 'record_number',
        'رقم الملف': 'file_number',
        'إسم المريض': 'patient_name',
        'اسم المريض': 'patient_name',
        'الطبيب المعالج': 'treating_doctor',
        'include kpi': 'include_kpi'
    }
    
    def __init__(self):
        self.validation_report = {
            'total_rows': 0,
            'cleaned_rows': 0,
            'removed_rows': 0,
            'issues': {}
        }
    
    def clean_data(self, df: pd.DataFrame, source_type: str = 'auto') -> pd.DataFrame:
        """
        CONSERVATIVE cleaning for mortality data - PRESERVES ALL RECORDS
        Only standardizes and cleans values, NEVER deletes records

        Args:
            df: Raw DataFrame from Excel or CSV
            source_type: 'excel', 'csv', or 'auto' (default: auto-detect)

        Returns:
            Cleaned DataFrame (same number of rows)
        """
        logger.info(f"🧹 Conservative cleaning for mortality data: {len(df)} records (source: {source_type})")

        original_count = len(df)
        self.validation_report['total_rows'] = original_count

        # 1. Auto-detect source type if needed
        if source_type == 'auto':
            source_type = self._detect_source_type(df)
            logger.info(f"📋 Auto-detected source: {source_type}")

        # 2. Check for duplicates (don't remove unless truly identical)
        duplicates = df.duplicated().sum()
        if duplicates > 0:
            logger.warning(f"⚠️  Found {duplicates} potential duplicates (keeping all)")
            self.validation_report['issues']['duplicates'] = duplicates

        # 3. Standardize column names based on source type
        if source_type == 'csv':
            df = self._standardize_by_position(df)
        else:
            df = self._standardize_columns(df)

        # 3. Clean age (mark invalid as Unknown, don't delete)
        df = self._clean_age(df)

        # 4. Standardize gender
        df = self._clean_gender(df)

        # 5. Clean time columns (admission time, death time)
        df = self._clean_time_fields(df)

        # 5b. Calculate LOS from dates if column is missing
        df = self._calculate_los_if_missing(df)

        # 6. Preserve original الإقامة text before numeric conversion
        if 'length_of_stay' in df.columns:
            df['length_of_stay_original'] = df['length_of_stay'].apply(
                lambda x: str(x).strip() if pd.notna(x) else None
            )

        # 6b. Clean stay duration text (الإقامة) and fix LOS
        df = self._clean_stay_duration(df)

        # 7. Clean and validate KPI
        df = self._clean_kpi(df)

        # 8. Clean text fields (departments, etc.)
        df = self._clean_text_fields(df)

        # 9. Handle missing values (fill with "Unknown", don't delete)
        df = self._handle_missing_values(df)

        # 10. Add age categories (handles Unknown ages)
        df = self.add_age_categories(df)

        self.validation_report['cleaned_rows'] = len(df)
        self.validation_report['removed_rows'] = 0  # NEVER remove records

        if len(df) != original_count:
            logger.error(f"❌ ERROR: Record count changed from {original_count} to {len(df)}!")
            raise ValueError("Data cleaning must preserve all records!")

        logger.success(f"✅ Cleaned: {len(df)} records PRESERVED (0 deleted)")

        return df
    
    def _detect_source_type(self, df: pd.DataFrame) -> str:
        """Auto-detect CSV (garbled Arabic) vs Excel (proper column names).

        Detection is based ONLY on garbled characters in column names,
        NOT on column count (Excel files can have any number of columns).
        """
        garbled = sum(1 for col in df.columns if '?' in str(col) or '�' in str(col))
        arabic_cols = sum(1 for col in df.columns if any('\u0600' <= c <= '\u06FF' for c in str(col)))

        # If many garbled chars AND no Arabic columns → CSV with encoding issues
        if garbled > 10 and arabic_cols < 3:
            return 'csv'
        return 'excel'

    def _standardize_by_position(self, df: pd.DataFrame) -> pd.DataFrame:
        """Position-based column mapping for CSV with garbled Arabic headers."""
        logger.info("📋 POSITION-based mapping (CSV mode)")
        new_columns = []
        for i in range(len(df.columns)):
            new_columns.append(self.POSITION_MAPPINGS.get(i, f'col_{i}'))
        df.columns = new_columns
        logger.debug(f"✅ Mapped {len(df.columns)} columns by position")
        return df

    def _standardize_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        """Rename columns to standard names (Excel mode)"""
        # Trim whitespace
        df.columns = df.columns.str.strip()

        # Map to standard names
        rename_map = {}
        for col in df.columns:
            if col in self.COLUMN_MAPPINGS:
                rename_map[col] = self.COLUMN_MAPPINGS[col]

        df = df.rename(columns=rename_map)
        logger.debug(f"📋 Standardized {len(rename_map)} columns")

        # Remove duplicate columns (keep first occurrence)
        if df.columns.duplicated().any():
            dup_count = df.columns.duplicated().sum()
            logger.warning(f"⚠️  Found {dup_count} duplicate columns, removing...")
            df = df.loc[:, ~df.columns.duplicated()]
            logger.debug(f"📋 After removing duplicates: {len(df.columns)} columns")

        return df
    
    def _clean_age(self, df: pd.DataFrame) -> pd.DataFrame:
        """Clean and validate age - mark invalid as None, DON'T delete records"""
        if 'age' not in df.columns:
            logger.warning("⚠️  No 'age' column found")
            return df

        # Strip non-numeric suffixes like "64y", "3Y", "70 years", "45 سنة"
        import re
        def extract_age_number(val):
            if pd.isna(val):
                return np.nan
            s = str(val).strip()
            # Try direct numeric first
            try:
                return float(s)
            except (ValueError, TypeError):
                pass
            # Extract leading number from strings like "64y", "3Y", "70 years", "45 سنة"
            match = re.match(r'^(\d+\.?\d*)', s)
            if match:
                return float(match.group(1))
            return np.nan

        df['age'] = df['age'].apply(extract_age_number)

        # Count invalid
        invalid = df['age'].isna().sum()
        if invalid > 0:
            logger.warning(f"⚠️  {invalid} records with invalid/missing ages (keeping all)")
            self.validation_report['issues']['invalid_ages'] = invalid

        # Mark impossible ages as null (but keep the record!)
        impossible_mask = (df['age'] < 0) | (df['age'] > 150)
        impossible_count = impossible_mask.sum()
        if impossible_count > 0:
            logger.warning(f"⚠️  {impossible_count} records with impossible ages (setting to null)")
            df.loc[impossible_mask, 'age'] = np.nan
            self.validation_report['issues']['impossible_ages'] = impossible_count

        return df
    
    def _clean_gender(self, df: pd.DataFrame) -> pd.DataFrame:
        """Standardize gender to Arabic"""
        if 'gender' not in df.columns:
            return df
        
        gender_map = {
            'ذكر': 'ذكر', 'male': 'ذكر', 'Male': 'ذكر', 'M': 'ذكر',
            'انثى': 'انثى', 'female': 'انثى', 'Female': 'انثى', 'F': 'انثى'
        }
        
        df['gender'] = df['gender'].astype(str).str.strip().map(gender_map)
        
        invalid = df['gender'].isna().sum()
        if invalid > 0:
            logger.warning(f"⚠️  {invalid} invalid genders")
        
        return df
    
    # Normalize Arabic specialty names (merge hamza variants + abbreviations)
    SPECIALTY_NORMALIZATION = {
        'أمراض القلب': 'امراض القلب والشرايين',
        'امراض القلب': 'امراض القلب والشرايين',
        'أمراض صدرية': 'امراض صدرية',
        'أمراض جرثومية': 'امراض جرثومية',
        'أمراض الأعصاب': 'امراض الاعصاب',
        'أمراض اعصاب': 'امراض الاعصاب',
        'امراض اعصاب': 'امراض الاعصاب',
        'امراض الاعصاب': 'امراض الاعصاب',
        'أمراض داخلية': 'امراض داخلية',
        'ضغط وكلى': 'امراض الكلى و الضغط',
        'كهرباء قلب': 'امراض القلب والشرايين',
        'قلب أطفال': 'جراحة قلب الاطفال',
        'قلب اطفال': 'جراحة قلب الاطفال',
    }

    def _clean_text_fields(self, df: pd.DataFrame) -> pd.DataFrame:
        """Clean text fields and normalize specialty names"""
        text_columns = ['nursing_department', 'specialty', 'building',
                       'admission_source', 'direct_cause_of_death']

        for col in text_columns:
            if col in df.columns:
                df[col] = df[col].astype(str).str.strip()
                df.loc[df[col] == 'nan', col] = None

        # Normalize specialty names (merge hamza variants and abbreviations)
        if 'specialty' in df.columns:
            df['specialty'] = df['specialty'].apply(self._normalize_specialty)

        return df

    def _normalize_specialty(self, val):
        """Normalize Arabic specialty name to standard form."""
        if pd.isna(val) or val is None:
            return val
        val = str(val).strip()
        if val in ('nan', 'None', ''):
            return None
        # Remove Private Use Area characters (e.g., 0xF8C7 ligature variants)
        import re
        val = re.sub(r'[\uf800-\uffff]', '', val)
        # Check direct mapping
        if val in self.SPECIALTY_NORMALIZATION:
            return self.SPECIALTY_NORMALIZATION[val]
        # Normalize hamza: replace أ/إ/آ with ا
        normalized = val.replace('أ', 'ا').replace('إ', 'ا').replace('آ', 'ا')
        if normalized in self.SPECIALTY_NORMALIZATION:
            return self.SPECIALTY_NORMALIZATION[normalized]
        return val
    
    def _clean_time_fields(self, df: pd.DataFrame) -> pd.DataFrame:
        """Clean time fields - standardize format"""
        # Time fields are already in good format (e.g., "8.00 P.M", "2.00 A.M")
        # Just ensure they're strings and trim whitespace
        time_columns = ['admission_time', 'death_time']

        for col in time_columns:
            if col in df.columns:
                df[col] = df[col].astype(str).str.strip()
                df.loc[df[col] == 'nan', col] = None

        return df

    def _calculate_los_if_missing(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate length_of_stay from admission_date and death_date when los column is missing."""
        if 'length_of_stay' in df.columns:
            return df  # Already has LOS

        if 'admission_date' not in df.columns or 'death_date' not in df.columns:
            logger.warning("⚠️  No 'los' column and no date columns to calculate from")
            return df

        logger.info("📊 Calculating length_of_stay from admission_date and death_date...")

        def calc_los(row):
            try:
                admission = pd.to_datetime(row['admission_date'], errors='coerce')
                death = pd.to_datetime(row['death_date'], errors='coerce')
                if pd.notna(admission) and pd.notna(death):
                    delta = (death - admission).days
                    return max(delta, 0)
                return None
            except Exception:
                return None

        df['length_of_stay'] = df.apply(calc_los, axis=1)

        calculated = df['length_of_stay'].notna().sum()
        logger.info(f"📊 Calculated LOS for {calculated}/{len(df)} records")
        return df

    def _parse_los_value(self, val):
        """Parse one الإقامة cell.
        Plain number → days (returned as-is).
        Contains ساعة / ساعات / hour / hours / hr / hrs, or ends with 'h' → hours, converted to days (÷24).
        """
        import re as _re
        if val is None:
            return None
        if isinstance(val, (int, float)):
            v = float(val)
            return None if np.isnan(v) else v
        s = str(val).strip()
        if not s or s.lower() in ('nan', 'none', ''):
            return None
        try:
            return float(s)
        except ValueError:
            pass
        is_hours = (
            'ساعة' in s or 'ساعات' in s or
            'hour' in s.lower() or 'hr' in s.lower() or
            s.lower().endswith('h')
        )
        nums = _re.findall(r'\d+\.?\d*', s)
        if nums:
            num = float(nums[0])
            return num / 24.0 if is_hours else num
        return None

    def _clean_stay_duration(self, df: pd.DataFrame) -> pd.DataFrame:
        """Parse الإقامة (length_of_stay): plain number = days, contains ساعة/hour/h = hours → ÷24 → days."""
        if 'length_of_stay' not in df.columns:
            return df

        parsed = df['length_of_stay'].apply(self._parse_los_value)
        changed = parsed.notna() & (parsed != df['length_of_stay'])
        if changed.any():
            logger.info(f"📊 Parsed {changed.sum()} الإقامة text values into fractional days")
        df['length_of_stay'] = parsed

        return df

    def _clean_kpi(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Clean and validate include_kpi field
        KPI = YES if patient stayed > 24 hours (1 day), otherwise NO
        """
        if 'length_of_stay' not in df.columns:
            logger.warning("⚠️  Missing length_of_stay column, cannot validate KPI")
            return df

        # Create include_kpi column if missing
        if 'include_kpi' not in df.columns:
            logger.info("📊 include_kpi column missing, calculating from length_of_stay")
            df['include_kpi'] = df['length_of_stay'].apply(
                lambda x: 'YES' if pd.notna(x) and x >= 1.0 else 'NO'
            )
            return df

        # 1. Standardize KPI values to uppercase
        df['include_kpi'] = df['include_kpi'].astype(str).str.strip().str.upper()

        # 1b. Fill empty/NaN KPI values from length_of_stay (الإقامة)
        empty_kpi = df['include_kpi'].isin(['', 'NAN', 'NONE', 'NA'])
        if empty_kpi.any():
            filled_count = empty_kpi.sum()
            df.loc[empty_kpi, 'include_kpi'] = df.loc[empty_kpi, 'length_of_stay'].apply(
                lambda x: 'YES' if pd.notna(x) and x >= 1.0 else 'NO'
            )
            logger.info(f"📊 Filled {filled_count} empty KPI values from length_of_stay (الإقامة)")

        # 2. Calculate expected KPI based on LOS
        # Rule: KPI = YES if LOS >= 1 day (24 hours or more)
        df['kpi_expected'] = df['length_of_stay'].apply(lambda x: 'YES' if pd.notna(x) and x >= 1.0 else 'NO')

        # 3. Find mismatches and auto-correct clear violations
        # Only auto-correct: Excel=YES but LOS is a known value < 1 day (cannot qualify for KPI)
        # Never touch records where LOS is NaN — trust the Excel value when LOS is unknown
        violations = df[
            (df['include_kpi'] == 'YES') &
            (df['kpi_expected'] == 'NO') &
            df['length_of_stay'].notna()
        ]
        corrections = []
        if len(violations) > 0:
            for idx, row in violations.iterrows():
                patient_id = row.get('patient_id', row.get('record_number', idx))
                los = float(row['length_of_stay'])
                corrections.append({
                    'row': int(idx) + 2,
                    'patient_id': str(patient_id),
                    'los_days': round(los, 2),
                    'los_hours': round(los * 24, 1),
                })
                df.at[idx, 'include_kpi'] = 'NO'
                logger.warning(
                    f"   ↳ Auto-corrected Row {idx+2} (PatientID={patient_id}): "
                    f"LOS={los:.2f} days ({los*24:.1f}h) — changed KPI from YES → NO"
                )
            logger.warning(f"⚠️  Auto-corrected {len(violations)} records: LOS < 24h but marked KPI=YES")
            self.validation_report['issues']['kpi_corrections'] = corrections

        # Remaining mismatches after corrections (Excel=NO but LOS >= 1 — kept as-is, clinical override)
        mismatches = df[df['include_kpi'] != df['kpi_expected']]
        if len(mismatches) > 0:
            logger.warning(f"⚠️  Found {len(mismatches)} remaining KPI overrides (kept — clinical exclusions)")
            self.validation_report['issues']['kpi_mismatches'] = len(mismatches)

        # 4. Flag extremely long stays (> 365 days = 1 year)
        long_stays = df[df['length_of_stay'] > 365]
        if len(long_stays) > 0:
            logger.warning(f"⚠️  Found {len(long_stays)} extremely long stays (>365 days)")
            self.validation_report['issues']['extremely_long_stays'] = len(long_stays)

            # Log the extreme cases
            for idx, row in long_stays.iterrows():
                logger.debug(f"   Row {idx}: LOS={row['length_of_stay']:.1f} days (~{row['length_of_stay']/365:.1f} years)")

        logger.debug(f"📊 KPI cleaned and validated")

        return df

    def _handle_missing_values(self, df: pd.DataFrame) -> pd.DataFrame:
        """Handle missing values - fill with 'Unknown', NEVER delete records"""
        # Fill missing text fields with 'Unknown'
        text_fields = [
            'nursing_department', 'specialty', 'admission_source', 'building', 'residence',
            'who_category_1', 'who_category_2', 'admission_source_category',
        ]

        for field in text_fields:
            if field in df.columns:
                missing_count = df[field].isna().sum()
                if missing_count > 0:
                    df[field] = df[field].fillna('Unknown')
                    logger.debug(f"📋 Filled {missing_count} missing {field} with 'Unknown'")

        # Fill missing age_category from age column (العمر)
        if 'age_category' in df.columns and 'age' in df.columns:
            empty_age_cat = df['age_category'].isna() | (df['age_category'].astype(str).str.strip() == '')
            if empty_age_cat.any():
                filled = 0
                for idx in df[empty_age_cat].index:
                    age = df.at[idx, 'age']
                    if pd.notna(age):
                        try:
                            age = float(age)
                            if age < 5:
                                cat = 'اقل من 5 سنوات'
                            elif age < 16:
                                cat = 'من 5 الى 15 سنة'
                            elif age <= 30:
                                cat = 'من 16 الى 30 سنة'
                            elif age <= 50:
                                cat = 'من 31 الى 50 سنة'
                            elif age <= 60:
                                cat = 'من 51 الى 60 سنة'
                            elif age <= 70:
                                cat = 'من 61 الى 70 سنة'
                            elif age <= 80:
                                cat = 'من 71 الى 80 سنة'
                            else:
                                cat = 'اكثر من 81 سنة'
                            df.at[idx, 'age_category'] = cat
                            filled += 1
                        except (ValueError, TypeError):
                            df.at[idx, 'age_category'] = 'Unknown'
                    else:
                        df.at[idx, 'age_category'] = 'Unknown'
                if filled > 0:
                    logger.info(f"📊 Filled {filled} empty age_category values from age column (العمر)")

        return df
    
    def add_age_categories(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add age group column with 8 Arabic categories matching report charts."""
        if 'age' not in df.columns:
            logger.warning("⚠️  No 'age' column found, cannot categorize")
            return df

        def categorize(age):
            if pd.isna(age):
                return 'Unknown'
            try:
                age = float(age)
                if age < 0 or age > 150:
                    return 'Unknown'
                elif age < 5:
                    return 'اقل من 5 سنوات'
                elif age < 16:
                    return 'من 5 الى 15 سنة'
                elif age <= 30:
                    return 'من 16 الى 30 سنة'
                elif age <= 50:
                    return 'من 31 الى 50 سنة'
                elif age <= 60:
                    return 'من 51 الى 60 سنة'
                elif age <= 70:
                    return 'من 61 الى 70 سنة'
                elif age <= 80:
                    return 'من 71 الى 80 سنة'
                else:
                    return 'اكثر من 81 سنة'
            except (ValueError, TypeError):
                return 'Unknown'

        df['age_group'] = df['age'].apply(categorize)

        category_counts = df['age_group'].value_counts()
        logger.debug(f"📊 Age categories: {category_counts.to_dict()}")

        return df
    
    def get_validation_report(self) -> Dict:
        """Return validation report"""
        return self.validation_report


# Singleton instance
data_processor = MortalityDataProcessor()