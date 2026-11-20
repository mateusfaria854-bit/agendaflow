import json
import os
import subprocess
import sys
import unittest
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(__file__))
import retention


NOW = datetime(2026, 11, 20, 21, 0, tzinfo=timezone.utc)


def item(age_days, suffix="test"):
    dt = NOW - timedelta(days=age_days)
    return {
        "Key": "agendaflow/demo/daily/" + dt.strftime("%Y-%m-%dT%H-%M-%SZ") + f"-{suffix}.dump",
        "LastModified": dt.isoformat().replace("+00:00", "Z"),
        "Size": 200,
    }


class RetentionTests(unittest.TestCase):
    def test_keeps_newest_fourteen_and_thirty_days(self):
        objects = [item(i) for i in range(48)]
        result = retention.plan(objects, NOW)
        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["would_expire_count"], 18)
        self.assertEqual(result["would_expire_bytes"], 3600)
        self.assertEqual(result["deleted_count"], 0)

    def test_keeps_all_when_recent(self):
        self.assertEqual(retention.plan([item(i) for i in range(14)], NOW)["would_expire_count"], 0)

    def test_blocks_when_too_few_backups(self):
        result = retention.plan([item(i) for i in range(6)], NOW)
        self.assertEqual(result["status"], "blocked")
        self.assertEqual(result["reason"], "menos_de_14_copias")

    def test_blocks_when_latest_is_old(self):
        result = retention.plan([item(i) for i in range(4, 48)], NOW)
        self.assertEqual(result["reason"], "copia_recente_ausente")
        self.assertEqual(result["would_expire_count"], 0)

    def test_blocks_on_unrecognized_object(self):
        result = retention.plan([item(i) for i in range(50)] + [{
            "Key": "agendaflow/demo/daily/manual-note.txt", "LastModified": NOW.isoformat(),
            "Size": 1,
        }], NOW)
        self.assertEqual(result["reason"], "objetos_nao_reconhecidos")
        self.assertEqual(result["would_expire_count"], 0)

    def test_blocks_outside_prefix_duplicate_or_invalid_policy(self):
        source = [item(i) for i in range(30)]
        with self.assertRaises(ValueError):
            retention.plan(source + [dict(item(1), Key="other/backups/bad.dump")], NOW)
        with self.assertRaises(ValueError):
            retention.plan(source + [item(1)], NOW)
        with self.assertRaises(ValueError):
            retention.plan(source, NOW, retention_days=3)
        with self.assertRaises(ValueError):
            retention.plan(source, NOW, keep_latest=1)

    def test_pagination_is_read_only(self):
        calls = []
        def fake_run(cmd, **kwargs):
            calls.append(cmd)
            self.assertEqual(cmd[0], "aws")
            self.assertEqual(cmd[4], "list-objects-v2")
            self.assertNotIn("delete-object", cmd)
            if len(calls) == 1:
                return subprocess.CompletedProcess(cmd, 0, json.dumps({
                    "Contents": [item(0)], "IsTruncated": True, "NextContinuationToken": "page2"
                }), "")
            self.assertIn("page2", cmd)
            return subprocess.CompletedProcess(cmd, 0, json.dumps({
                "Contents": [item(1)], "IsTruncated": False
            }), "")
        listed = retention.inventory("fictitious", "https://example.invalid", run=fake_run)
        self.assertEqual(len(listed), 2)
        self.assertEqual(len(calls), 2)

    def test_pagination_failure_aborts(self):
        def fake_run(cmd, **kwargs):
            return subprocess.CompletedProcess(cmd, 0, json.dumps({
                "Contents": [], "IsTruncated": True
            }), "")
        with self.assertRaises(ValueError):
            retention.inventory("fictitious", "https://example.invalid", run=fake_run)

    def test_delete_flag_rejected_without_credentials(self):
        with self.assertRaises(SystemExit) as cm:
            retention.main(["--execute"])
        self.assertEqual(cm.exception.code, 2)


if __name__ == "__main__":
    unittest.main()
