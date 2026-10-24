import io
import unittest
import zipfile
from datetime import datetime, timezone
from calendars import events, read_archive

NOW = datetime(2026, 11, 7, tzinfo=timezone.utc)
EVENT = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:pandascore-match-42@esport-ics\r\nDTSTART:20261108T230000Z\r\nDESCRIPTION:Test Cup - Finals\r\nSUMMARY:Final: A vs TBD\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n'


def archive(cs=EVENT, val=EVENT):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
        for sport, content in [('counter_strike', cs), ('valorant', val)]:
            for team in ['a', 'b']:
                z.writestr(f'root/ics/{sport}/{team}.ics', content)
    return buf.getvalue()


class CalendarTests(unittest.TestCase):
    def test_utc_stage_tbd_and_stable_reschedule_id(self):
        a = events(EVENT, 'cs2', 'https://github.com/source', NOW)[0]
        b = events(EVENT.replace('20261108T230000Z', '20270101T230000Z'), 'cs2', 'https://github.com/source', NOW)[0]
        self.assertEqual(a['id'], b['id'])
        self.assertEqual(a['start'], '2026-11-08T23:00:00Z')
        self.assertEqual(a['stage'], 'Final')
        self.assertEqual(a['away'], 'TBD')

    def test_folding_cancellation_and_past(self):
        folded = EVENT.replace('Test Cup', 'Test\r\n  Cup')
        self.assertEqual(events(folded, 'cs2', 'https://github.com/source', NOW)[0]['league'], 'Test Cup - Finals')
        self.assertEqual(events(EVENT.replace('20261108T230000Z', '20261001T230000Z'), 'cs2', '', NOW), [])
        self.assertEqual(events(EVENT.replace('END:VEVENT', 'STATUS:CANCELLED\r\nEND:VEVENT'), 'cs2', '', NOW), [])
        with self.assertRaises(ValueError):
            events(EVENT.replace('20261108T230000Z', '20261108T230000'), 'cs2', '', NOW)

    def test_dedup_and_independent_game_failure(self):
        good = read_archive(archive(), NOW)
        self.assertEqual(len(good['cs2']['matches']), 1)
        self.assertEqual(len(good['valorant']['matches']), 1)
        broken = read_archive(archive(cs='changed page'), NOW)
        self.assertIn('error', broken['cs2'])
        self.assertEqual(len(broken['valorant']['matches']), 1)
        empty = read_archive(archive(cs='BEGIN:VCALENDAR\nEND:VCALENDAR\n'), NOW)
        self.assertEqual(empty['cs2']['matches'], [])

    def test_conflicting_copies_rejected(self):
        data = io.BytesIO(archive())
        with zipfile.ZipFile(data, 'a') as z:
            z.writestr('root/ics/counter_strike/c.ics', EVENT.replace('A vs TBD', 'B vs TBD'))
        result = read_archive(data.getvalue(), NOW)
        self.assertIn('error', result['cs2'])
        self.assertEqual(len(result['valorant']['matches']), 1)


if __name__ == '__main__':
    unittest.main()
