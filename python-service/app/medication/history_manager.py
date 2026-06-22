"""
Medication Error Historical Data Manager
Manages quarterly medication error history in JSON format
"""

import json
from pathlib import Path
from typing import Dict, List, Optional
from loguru import logger

_AR_TO_Q = {
    "الفصل الأول":  1, "الفصل الاول": 1,
    "الفصل الثاني": 2,
    "الفصل الثالث": 3,
    "الفصل الرابع": 4,
}
_MAX_QUARTERS = 8


class MedicationErrorHistory:
    """Manage medication error historical data"""

    def __init__(self, storage_path: str = 'storage/data/medication_error_history.json'):
        self.storage_path = Path(storage_path)
        self.current_path = self.storage_path.parent / 'medication_current.json'  # legacy
        self.quarters_dir = self.storage_path.parent / 'medication' / 'quarters'
        self.history = []

        # Create storage directories if needed
        self.storage_path.parent.mkdir(parents=True, exist_ok=True)
        self.quarters_dir.mkdir(parents=True, exist_ok=True)

        # Load existing history
        self.load_history()
    
    def load_history(self) -> List[Dict]:
        """Load historical data from JSON"""
        if self.storage_path.exists():
            try:
                with open(self.storage_path, 'r', encoding='utf-8') as f:
                    self.history = json.load(f)
                logger.info(f"📂 Loaded {len(self.history)} historical quarters")
                return self.history
            except Exception as e:
                logger.error(f"❌ Error loading history: {e}")
                self.history = []
        else:
            logger.info("📝 No existing history found, starting fresh")
            self.history = []
        
        return self.history
    
    def save_quarter(self, quarter: str, year: int, stats: Dict) -> bool:
        """
        Save or update quarter data
        
        Args:
            quarter: Quarter name (e.g., "الفصل الثالث")
            year: Year
            stats: Complete statistics dictionary
        
        Returns:
            True if saved successfully
        """
        logger.info(f"💾 Saving {quarter} {year} to history...")

        # History stores only the lean comparison fields (rate, counts, doses).
        # Full breakdown data (charts, heatmaps, matrices) is saved separately
        # in medication_current.json via save_current_data().
        quarter_data = {
            'quarter':      quarter,
            'year':         str(year),
            'error_rate':   stats['summary']['error_rate'],
            'total_errors': stats['summary']['total_errors'],
            'total_doses':  stats['summary']['total_doses'],
        }
        
        # Check if quarter already exists
        existing_index = None
        for i, entry in enumerate(self.history):
            if entry['quarter'] == quarter and entry['year'] == str(year):
                existing_index = i
                break
        
        if existing_index is not None:
            # Update existing
            self.history[existing_index] = quarter_data
            logger.info(f"✏️  Updated existing entry for {quarter} {year}")
        else:
            # Add new
            self.history.append(quarter_data)
            logger.info(f"➕ Added new entry for {quarter} {year}")
        
        # Sort by year and quarter
        self.history = self._sort_history(self.history)
        
        # Save to file
        try:
            with open(self.storage_path, 'w', encoding='utf-8') as f:
                json.dump(self.history, f, ensure_ascii=False, indent=2)
            logger.success(f"✅ Saved {len(self.history)} quarters to {self.storage_path}")
            return True
        except Exception as e:
            logger.error(f"❌ Error saving history: {e}")
            return False
    
    def get_last_n_quarters(self, n: int = 10) -> List[Dict]:
        """Get last N quarters for charts"""
        return self.history[-n:] if len(self.history) >= n else self.history
    
    def get_quarter(self, quarter: str, year: int) -> Optional[Dict]:
        """Get specific quarter data"""
        for entry in self.history:
            if entry['quarter'] == quarter and entry['year'] == str(year):
                return entry
        return None
    
    def _sort_history(self, history: List[Dict]) -> List[Dict]:
        """Sort history by year and quarter"""
        quarter_order = {
            'الفصل الاول': 1,
            'الفصل الثاني': 2,
            'الفصل الثالث': 3,
            'الفصل الرابع': 4
        }
        
        def sort_key(entry):
            year = int(entry['year'])
            quarter_num = quarter_order.get(entry['quarter'], 0)
            return (year, quarter_num)
        
        return sorted(history, key=sort_key)
    
    # ── Per-quarter file helpers ──────────────────────────────────────────────

    def _quarter_file(self, quarter: str, year) -> Path:
        n = _AR_TO_Q.get(str(quarter).strip(), 0)
        return self.quarters_dir / f"{year}_Q{n}.json"

    # ── Current data (full snapshot for dashboard / report generation) ────────

    def save_current_data(self, quarter: str, year: int, stats: Dict,
                          records: List = None) -> bool:
        """Save full data for a quarter to its own file; keep last 8 files."""
        entry = {
            'quarter':    quarter,
            'year':       str(year),
            'statistics': stats,
            'records':    records or [],
        }
        try:
            path = self._quarter_file(quarter, year)
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(entry, f, ensure_ascii=False, indent=2, default=str)

            # Trim oldest files beyond limit
            files = sorted(self.quarters_dir.glob("*.json"))
            for old in files[:-_MAX_QUARTERS]:
                old.unlink(missing_ok=True)

            logger.success(f"✅ Saved quarter file: {path.name}")
            return True
        except Exception as e:
            logger.error(f"❌ Error saving current data: {e}")
            return False

    def load_current_data(self) -> List[Dict]:
        """Return all stored quarter entries sorted oldest → newest."""
        result = []
        for f in sorted(self.quarters_dir.glob("*.json")):
            try:
                with open(f, 'r', encoding='utf-8') as fh:
                    result.append(json.load(fh))
            except Exception:
                pass
        # Legacy fallback
        if not result and self.current_path.exists():
            try:
                with open(self.current_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                pass
        return result

    def get_current_data(self, quarter: str, year) -> Optional[Dict]:
        """Return full data for a specific quarter, or None if not found."""
        path = self._quarter_file(quarter, year)
        if path.exists():
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                pass
        # Legacy fallback
        for entry in self.load_current_data():
            if entry.get('quarter') == quarter and str(entry.get('year')) == str(year):
                return entry
        return None

    def get_latest_current_data(self) -> Optional[Dict]:
        """Return the most recently uploaded quarter (alphabetically last file)."""
        files = sorted(self.quarters_dir.glob("*.json"))
        if files:
            try:
                with open(files[-1], 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                pass
        # Legacy fallback
        data = self.load_current_data()
        return data[-1] if data else None

    def initialize_with_data(self, historical_data: List[Dict]) -> bool:
        """
        Initialize history with provided data
        
        Args:
            historical_data: List of quarter dictionaries with keys:
                - quarter, year, error_rate, total_errors, total_doses
        """
        logger.info(f"🔄 Initializing with {len(historical_data)} quarters")
        
        formatted_history = []
        for entry in historical_data:
            formatted_entry = {
                'quarter':      entry['quarter'],
                'year':         str(entry['year']),
                'error_rate':   entry['error_rate'],
                'total_errors': entry['total_errors'],
                'total_doses':  entry['total_doses'],
            }
            formatted_history.append(formatted_entry)
        
        self.history = self._sort_history(formatted_history)
        
        # Save
        try:
            with open(self.storage_path, 'w', encoding='utf-8') as f:
                json.dump(self.history, f, ensure_ascii=False, indent=2)
            logger.success(f"✅ Initialized with {len(self.history)} quarters")
            return True
        except Exception as e:
            logger.error(f"❌ Error initializing history: {e}")
            return False


# ============================================================================
# INITIAL HISTORICAL DATA (from user's data)
# ============================================================================

INITIAL_HISTORY = [
    {'quarter': 'الثالث', 'year': 2022, 'error_rate': 0.0394, 'total_errors': 97, 'total_doses': 246224},
    {'quarter': 'الرابع', 'year': 2022, 'error_rate': 0.0703, 'total_errors': 196, 'total_doses': 278656},
    {'quarter': 'الاول', 'year': 2023, 'error_rate': 0.0285, 'total_errors': 80, 'total_doses': 280277},
    {'quarter': 'الثاني', 'year': 2023, 'error_rate': 0.0438, 'total_errors': 127, 'total_doses': 290069},
    {'quarter': 'الثالث', 'year': 2023, 'error_rate': 0.0364, 'total_errors': 108, 'total_doses': 296919},
    {'quarter': 'الرابع', 'year': 2023, 'error_rate': 0.0254, 'total_errors': 76, 'total_doses': 299597},
    {'quarter': 'الاول', 'year': 2024, 'error_rate': 0.0277, 'total_errors': 99, 'total_doses': 357854},
    {'quarter': 'الثاني', 'year': 2024, 'error_rate': 0.0259, 'total_errors': 86, 'total_doses': 331557},
    {'quarter': 'الثالث', 'year': 2024, 'error_rate': 0.0132, 'total_errors': 41, 'total_doses': 310336},
    {'quarter': 'الرابع', 'year': 2024, 'error_rate': 0.0266, 'total_errors': 23, 'total_doses': 86520},
    {'quarter': 'الاول', 'year': 2025, 'error_rate': 0.0191, 'total_errors': 64, 'total_doses': 335781},
    {'quarter': 'الثاني', 'year': 2025, 'error_rate': 0.0082, 'total_errors': 28, 'total_doses': 343256},
]


# ============================================================================
# TESTING
# ============================================================================

if __name__ == '__main__':
    # Test historical manager
    history_mgr = MedicationErrorHistory('/tmp/test_med_error_history.json')
    
    # Initialize with historical data
    history_mgr.initialize_with_data(INITIAL_HISTORY)
    
    print("\n📊 HISTORICAL DATA:")
    for entry in history_mgr.get_last_n_quarters(5):
        print(f"  {entry['quarter']} {entry['year']}: {entry['error_rate']}% ({entry['total_errors']} errors)")
    
    print("\n✅ Historical manager working!")