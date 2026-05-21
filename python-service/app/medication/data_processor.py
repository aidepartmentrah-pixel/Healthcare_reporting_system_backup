"""
Medication Error Data Processor
Processes medication error Excel data and extracts statistics
"""

import pandas as pd
import re
from typing import Dict, Tuple, Optional
from loguru import logger
from datetime import datetime


class MedicationErrorProcessor:
    """Process medication error data from Excel"""
    
    def __init__(self):
        self.df = None
        self.total_doses = None
        self.quarter = None
        self.year = None
    
    def load_excel(self, file_path: str, sheet_name: int = 0) -> pd.DataFrame:
        """Load medication error data from Excel - first sheet only (Sheet1)"""
        logger.info(f"📂 Loading Excel: {file_path}")
        
        try:
            # Load first sheet (index 0) - user file has 'Sheet1'
            df = pd.read_excel(file_path, sheet_name=sheet_name)
            logger.info(f"✅ Loaded {len(df)} rows, {len(df.columns)} columns")
            self.df = df
            return df
        except Exception as e:
            logger.error(f"❌ Error loading Excel: {e}")
            raise
    
    def extract_total_doses(self, df: pd.DataFrame = None) -> Optional[int]:
        """Extract total doses from last row remarks - looks for 'Number of doses = 431124'"""
        if df is None:
            df = self.df
        
        logger.info("🔍 Searching for total doses in last row...")
        
        # Search all columns in last row
        last_row = df.iloc[-1]
        
        for col in df.columns:
            value = str(last_row[col])
            
            # Look for patterns
            patterns = [
                r'(?:number\s+of\s+)?doses?\s*(?:dispensed)?\s*[=:]\s*(\d+)',
                r'total\s+doses?\s*[=:]\s*(\d+)',
                r'(\d{5,})'  # Fallback: large number
            ]
            
            for pattern in patterns:
                match = re.search(pattern, value, re.IGNORECASE)
                if match:
                    total_doses = int(match.group(1))
                    logger.success(f"✅ Found total doses: {total_doses:,}")
                    self.total_doses = total_doses
                    return total_doses
        
        logger.warning("⚠️  Total doses not found in remarks")
        return None
    
    def clean_data(self, df: pd.DataFrame = None) -> pd.DataFrame:
        """Clean and standardize medication error data"""
        if df is None:
            df = self.df.copy()
        else:
            df = df.copy()
        
        logger.info("🧹 Cleaning data...")

        # Standardize column names
        column_mapping = {
            'Medication Error Cycle ': 'error_cycle',
            'Medication Error Cycle': 'error_cycle',
            'Date of event': 'date',
            'Nursing Unit': 'nursing_unit',
            'Duty': 'duty',
            'Name \n(staff involved in error)': 'staff_name',
            ' Job Title': 'job_title',
            'Job Title': 'job_title',
            'DRUG': 'drug',
            'Dosage Form': 'dosage_form',
            'Route Of Administration': 'route',
            'Drug Class': 'drug_class',
            'nbr of me': 'error_count',
            'Type of Error': 'error_type',
            'Cause Of Error': 'error_cause',
            'Way error detected': 'detected_by',
            'Error Category': 'error_category'
        }
        
        df = df.rename(columns=column_mapping)
        
        # Fill missing error_count with 1 (default)
        if 'error_count' in df.columns:
            df['error_count'] = df['error_count'].fillna(1).astype(int)
        else:
            df['error_count'] = 1
        
        # Convert date
        if 'date' in df.columns:
            df['date'] = pd.to_datetime(df['date'], errors='coerce')
            df['month'] = df['date'].dt.month
            df['year'] = df['date'].dt.year
        
        # Standardize duty
        if 'duty' in df.columns:
            df['duty'] = df['duty'].fillna('').astype(str).str.strip().str.upper()
            duty_mapping = {
                'AM': 'Day', 'D': 'Day',
                'PM': 'Evening', 'E': 'Evening',
                'N': 'Night', 'NIGHT': 'Night'
            }
            df['duty_full'] = df['duty'].map(duty_mapping).fillna(df['duty'])
        
        # Clean text fields
        text_columns = ['error_cycle', 'nursing_unit', 'job_title', 'drug', 'drug_class']
        for col in text_columns:
            if col in df.columns:
                df[col] = df[col].fillna('Unknown').astype(str).str.strip()
        
        logger.success(f"✅ Cleaned {len(df)} records")
        self.df = df
        return df
    
    def calculate_quarter(self, df: pd.DataFrame = None) -> Tuple[str, int]:
        """Calculate quarter from dates"""
        if df is None:
            df = self.df
        
        month = df['month'].mode()[0] if 'month' in df.columns and len(df) > 0 else 1
        year = int(df['year'].mode()[0]) if 'year' in df.columns and len(df) > 0 else datetime.now().year
        
        quarter_num = (month - 1) // 3 + 1
        quarter_names = {
            1: 'الفصل الاول', 2: 'الفصل الثاني',
            3: 'الفصل الثالث', 4: 'الفصل الرابع'
        }
        quarter = quarter_names.get(quarter_num, 'الفصل الاول')
        
        self.quarter = quarter
        self.year = year
        logger.info(f"📅 Detected: {quarter} {year}")
        
        return quarter, year
    
    def get_distribution(self, df: pd.DataFrame, column: str, top_n: int = None) -> Dict[str, int]:
        """Get distribution of values in a column"""
        if column not in df.columns:
            return {}
        
        counts = df[column].value_counts()
        if top_n:
            counts = counts.head(top_n)
        return counts.to_dict()
    
    def process_file(self, file_path: str, total_doses: int = None) -> Dict:
        """Complete processing pipeline"""
        logger.info("🚀 MEDICATION ERROR PROCESSING STARTED")
        
        # Load, extract, clean
        df = self.load_excel(file_path)
        extracted_doses = self.extract_total_doses(df)
        
        if extracted_doses:
            self.total_doses = extracted_doses
        elif total_doses:
            logger.info(f"📝 Using manual total doses: {total_doses:,}")
            self.total_doses = total_doses
        else:
            raise ValueError("❌ Total doses not found! Please provide manually.")
        
        df_clean = self.clean_data(df)
        quarter, year = self.calculate_quarter(df_clean)
        
        # Calculate metrics - sum error_count column, not just count rows
        if 'error_count' in df_clean.columns:
            total_errors = int(df_clean['error_count'].sum())
        else:
            total_errors = len(df_clean)
        
        error_rate = (total_errors / self.total_doses) * 100
        
        result = {
            'quarter': quarter,
            'year': year,
            'total_errors': total_errors,
            'total_doses': self.total_doses,
            'error_rate': round(error_rate, 4),
            'target': 0.03,
            'data': df_clean,
            'distributions': {
                'error_cycle': self.get_distribution(df_clean, 'error_cycle'),
                'nursing_unit': self.get_distribution(df_clean, 'nursing_unit', top_n=20),
                'duty': self.get_distribution(df_clean, 'duty_full'),
                'job_title': self.get_distribution(df_clean, 'job_title'),
                'drug_class': self.get_distribution(df_clean, 'drug_class', top_n=15),
            }
        }
        
        logger.success(f"✅ COMPLETE - Error Rate: {error_rate:.4f}%")
        return result