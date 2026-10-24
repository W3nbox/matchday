"""Decode MLB community CSV using the standard library, including quoted newlines."""
import csv
import io
import json
import sys

reader = csv.DictReader(io.StringIO(sys.stdin.buffer.read().decode('utf-8-sig')))
required = {'game_pk', 'game_date', 'game_datetime', 'season', 'game_type', 'detailed_state', 'abstract_state', 'home_team_id', 'home_team_name', 'away_team_id', 'away_team_name'}
if not required.issubset(reader.fieldnames or []):
    sys.exit('Invalid MLB CSV columns')
print(json.dumps(list(reader), ensure_ascii=True))
