"""Unit tests for model promotion quality gate."""
import os
import unittest
from unittest.mock import patch

from promotion_gate import evaluate_promotion, load_baseline_record_counts, non_low_title_count


CANONICAL = [
    'Software Engineer', 'Data Scientist', 'SOC Analyst', 'DevOps Engineer',
    'Frontend Developer', 'Backend Developer', 'Product Manager', 'Machine Learning Engineer',
]

PROMOTE_THRESHOLDS = {
    'MIN_TOTAL_RECORDS': '200',
    'MIN_TITLES_WITH_DATA': '8',
    'MIN_NON_LOW_TITLES': '3',
}


class FakeCollection:
    def __init__(self, doc):
        self._doc = doc

    def find_one(self, _query, sort=None):
        return self._doc


class FakeDb:
    def __init__(self, promoted_doc=None):
        self._promoted = promoted_doc

    def __getitem__(self, name):
        assert name == 'model_runs'
        return FakeCollection(self._promoted)


class PromotionGateTests(unittest.TestCase):
    def test_first_promote_blocked_when_too_few_records(self):
        counts = {'SOC Analyst': 120, 'Software Engineer': 0, 'Data Scientist': 0, 'DevOps Engineer': 0}
        ok, reason = evaluate_promotion(counts, {}, CANONICAL)
        self.assertFalse(ok)
        self.assertIn('first promote blocked', reason)

    @patch.dict(os.environ, PROMOTE_THRESHOLDS, clear=False)
    def test_first_promote_passes_with_enough_coverage(self):
        counts = {title: 30 for title in CANONICAL}
        counts['Software Engineer'] = 60
        counts['Data Scientist'] = 55
        counts['DevOps Engineer'] = 52
        ok, reason = evaluate_promotion(counts, {}, CANONICAL)
        self.assertTrue(ok)
        self.assertIn('first promote', reason)

    def test_regression_blocks_non_low_drop(self):
        baseline = {'Software Engineer': 60, 'Data Scientist': 55, 'DevOps Engineer': 52, 'SOC Analyst': 40}
        worse = {'Software Engineer': 10, 'Data Scientist': 0, 'DevOps Engineer': 0, 'SOC Analyst': 120}
        ok, reason = evaluate_promotion(worse, baseline, CANONICAL)
        self.assertFalse(ok)
        self.assertIn('non_low titles dropped', reason)

    def test_baseline_from_last_promoted_run(self):
        db = FakeDb({'promoted': True, 'trained_at': '20260101', 'record_counts': {'Software Engineer': 10}})
        baseline = load_baseline_record_counts(db, model_out='/tmp', canonical_titles=CANONICAL)
        self.assertEqual(baseline['Software Engineer'], 10)
        self.assertEqual(baseline['Data Scientist'], 0)

    def test_non_low_count(self):
        counts = {'Software Engineer': 49, 'Data Scientist': 50, 'SOC Analyst': 100, 'DevOps Engineer': 0}
        self.assertEqual(non_low_title_count(counts, CANONICAL), 2)


if __name__ == '__main__':
    unittest.main()
