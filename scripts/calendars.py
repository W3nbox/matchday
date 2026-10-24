"""Read public team calendars without extracting or executing archive contents."""
import io
import json
import re
import sys
import zipfile
from datetime import datetime, timezone

GAMES = {'cs2': 'counter_strike', 'valorant': 'valorant'}


def unescape(value):
    return re.sub(r'\\([nN,;\\])', lambda m: '\n' if m[1].lower() == 'n' else m[1], value)


def events(content, sport, source_url, now):
    content = content.replace('\r\n', '\n').replace('\r', '')
    content = re.sub(r'\n[ \t]', '', content)
    if 'BEGIN:VCALENDAR' not in content or 'END:VCALENDAR' not in content:
        raise ValueError('Missing calendar envelope')
    if content.count('BEGIN:VEVENT') != content.count('END:VEVENT'):
        raise ValueError('Incomplete calendar')
    result = []
    for raw in re.findall(r'BEGIN:VEVENT\n(.*?)END:VEVENT', content, re.S):
        fields = {}
        for line in raw.splitlines():
            if ':' in line:
                key, value = line.split(':', 1)
                if key in fields and key.split(';')[0] in ('UID', 'DTSTART', 'SUMMARY'):
                    raise ValueError('Duplicate calendar property')
                fields[key] = unescape(value)
        dates = [(k, v) for k, v in fields.items() if k.split(';')[0] == 'DTSTART']
        if len(dates) != 1:
            raise ValueError('Missing or duplicate DTSTART')
        key, date = dates[0]
        if date:
            if not re.fullmatch(r'\d{8}T\d{6}Z', date) or ('TZID=' in key and 'TZID=UTC' not in key):
                raise ValueError('Unconfirmed timezone')
            start = datetime.strptime(date, '%Y%m%dT%H%M%SZ').replace(tzinfo=timezone.utc)
            if start < now:
                continue
            iso = start.isoformat().replace('+00:00', 'Z')
        else:
            iso = None
        uid = fields.get('UID', '')
        if not re.fullmatch(r'pandascore-match-\d+@esport-ics', uid):
            raise ValueError('Missing stable match ID')
        if fields.get('STATUS') == 'CANCELLED':
            continue
        summary = fields.get('SUMMARY', '')
        match = re.fullmatch(r'(?:(.*): )?(.+?) vs (.+)', summary)
        if not match:
            if summary.strip() not in ('TBD', ''):
                raise ValueError('Unrecognized match summary')
            stage, home, away = '阶段待定', 'TBD', 'TBD'
        else:
            stage, home, away = match[1] or '阶段待定', match[2], match[3]
        context = fields.get('DESCRIPTION', '').split('\n')[0]
        league = context or ('CS2' if sport == 'cs2' else 'VALORANT')
        result.append(dict(id=f'{sport}:{uid}', sport=sport, league=league, stage=stage,
                           home=home, away=away, homeLogo=None, awayLogo=None, start=iso,
                           status='赛程预告' if iso else '时间待定', sourceUrl=source_url, timeZone='UTC'))
    return result


def read_archive(data, now):
    result = {}
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        if sum(i.file_size for i in archive.infolist()) > 80 * 1024 * 1024:
            raise ValueError('Oversized archive')
        for sport, folder in GAMES.items():
            try:
                files = [i for i in archive.infolist() if f'/ics/{folder}/' in i.filename and i.filename.endswith('.ics')]
                if not files:
                    raise ValueError('Missing game directory')
                matches = {}
                for info in files:
                    source_url = 'https://github.com/snutij/esport_ics/blob/main/' + info.filename.split('/', 1)[1]
                    for item in events(archive.read(info).decode('utf-8'), sport, source_url, now):
                        prior = matches.get(item['id'])
                        if prior:
                            # Two team copies are equivalent only if their actual match fields agree.
                            if {k:v for k,v in prior.items() if k != 'sourceUrl'} != {k:v for k,v in item.items() if k != 'sourceUrl'}:
                                raise ValueError('Conflicting team copies')
                        else:
                            matches[item['id']] = item
                result[sport] = {'matches': list(matches.values()), 'files': len(files)}
            except (ValueError, UnicodeError, KeyError, zipfile.BadZipFile) as error:
                result[sport] = {'error': str(error)}
    return result


if __name__ == '__main__':
    now = datetime.fromisoformat(sys.argv[1].replace('Z', '+00:00'))
    try:
        print(json.dumps(read_archive(sys.stdin.buffer.read(), now), ensure_ascii=True))
    except (ValueError, zipfile.BadZipFile):
        sys.exit('Invalid calendar archive')
