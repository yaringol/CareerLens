"""Tests for unified skill schema and stability selection."""
import unittest
from datetime import datetime, timezone, timedelta

from skill_schema import (
    build_skill_records,
    compute_stability_score,
    resolve_date_posted,
    resolve_extracted_at,
    resolve_observed_at,
    select_display_skills,
    weighted_scores_from_records,
)


class SkillSchemaTests(unittest.TestCase):
    def test_observed_at_prefers_date_posted(self):
        item = {
            'datePosted': '2026-06-01T10:00:00+00:00',
            'scraped_at': datetime(2026, 7, 1, tzinfo=timezone.utc),
        }
        dt = resolve_observed_at(item)
        self.assertEqual(dt.year, 2026)
        self.assertEqual(dt.month, 6)

    def test_job_dates_stored_separately(self):
        item = {
            'datePosted': '2020-01-15T10:00:00+00:00',
            'scraped_at': datetime(2026, 7, 1, tzinfo=timezone.utc),
            'extracted_at': datetime(2026, 7, 3, tzinfo=timezone.utc),
            'skills': {
                'full_matches': [{'doc_node_value': 'Python', 'score': 1}],
                'ngram_matches': [],
            },
        }
        records = build_skill_records(item)
        self.assertEqual(records[0]['datePosted'].day, 15)
        self.assertEqual(records[0]['extracted_at'].day, 3)
        self.assertEqual(records[0]['observed_at'].day, 15)

    def test_build_skill_records_from_legacy(self):
        item = {
            'scraped_at': datetime(2026, 7, 1, tzinfo=timezone.utc),
            'skills': {
                'full_matches': [{'doc_node_value': 'Python', 'score': 1}],
                'ngram_matches': [],
            },
        }
        records = build_skill_records(item)
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]['skill'], 'python')
        self.assertIsNotNone(records[0]['observed_at'])
        self.assertEqual(records[0]['observed_at'].month, 7)

    def test_stability_high_when_consistent_weeks(self):
        base = datetime(2026, 1, 1, tzinfo=timezone.utc)
        dates = [base + timedelta(weeks=i) for i in range(6)]
        result = compute_stability_score(dates)
        self.assertGreater(result['stability_score'], 0.9)
        self.assertTrue(result['time_coverage_reliable'])

    def test_stability_low_with_spiky_weeks(self):
        base = datetime(2026, 1, 1, tzinfo=timezone.utc)
        dates = [base] * 20 + [base + timedelta(weeks=10)]
        result = compute_stability_score(dates)
        self.assertLess(result['stability_score'], 0.5)

    def test_select_display_skills_pool_then_stability(self):
        feats = {
            'a': {'prevalence': 1.0, 'stability_score': 0.2, 'recent_prevalence': 0.5, 'trend': 'rising'},
            'b': {'prevalence': 0.9, 'stability_score': 0.95, 'recent_prevalence': 0.4, 'trend': 'stable'},
            'c': {'prevalence': 0.8, 'stability_score': 0.5, 'recent_prevalence': 0.3, 'trend': 'stable'},
        }
        picked = select_display_skills(feats, pool_size=2, display_count=1)
        self.assertEqual(len(picked), 1)
        self.assertEqual(picked[0]['skill'], 'b')

    def test_weighted_scores_from_records(self):
        records = [
            {'skill': 'docker', 'score': 1.0},
            {'skill': 'docker', 'score': 0.5},
        ]
        self.assertEqual(weighted_scores_from_records(records)['docker'], 1.5)


if __name__ == '__main__':
    unittest.main()
