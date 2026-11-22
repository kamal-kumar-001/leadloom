"""Local negative tests for the literal Compose policy contract, not Docker execution."""
from pathlib import Path
import subprocess
import tempfile
import shutil
import sys
import yaml

root=Path(__file__).resolve().parents[1]
original=yaml.safe_load((root/'docker-compose.yml').read_text())
flags=[
 'LEADLOOM_RESEARCH_API_ENABLED','LEADLOOM_VALIDATOR_API_ENABLED',
 'LEADLOOM_DNS_DIAGNOSTICS_ENABLED','LEADLOOM_ENTITLEMENTS_ENFORCED',
 'LEADLOOM_TEAM_INVITES_ENABLED','LEADLOOM_MAILBOX_CONNECT_ENABLED',
 'LEADLOOM_WATERFALL_API_ENABLED','LEADLOOM_GROWTH_WATCHES_ENABLED',
 'LEADLOOM_RESEARCH_FETCH_ENABLED','LEADLOOM_CONNECTORS_LIVE_ENABLED',
 'LEADLOOM_WORKER_ENABLED','LEADLOOM_OUTBOUND_SENDING_ENABLED',
]
with tempfile.TemporaryDirectory(prefix='leadloom-compose-policy-') as temporary:
 target=Path(temporary)
 (target/'docker').mkdir()
 (target/'apps/engine/src').mkdir(parents=True)
 shutil.copyfile(root/'docker/check-compose.py',target/'docker/check-compose.py')
 shutil.copyfile(root/'apps/engine/src/main.ts',target/'apps/engine/src/main.ts')
 def check(data,expected,label):
  (target/'docker-compose.yml').write_text(yaml.safe_dump(data))
  result=subprocess.run([sys.executable,str(target/'docker/check-compose.py')],capture_output=True,text=True)
  assert (result.returncode==0)==expected,label+'\n'+result.stdout+result.stderr
  print('PASS '+label)
 def copy():return yaml.safe_load(yaml.safe_dump(original))
 check(copy(),True,'current source preserves all default-off and infrastructure policies')
 for flag in flags:
  data=copy();del data['services']['api']['environment'][flag]
  check(data,False,'missing pass-through refused: '+flag)
  data=copy();data['services']['api']['environment'][flag]='${'+flag+':-true}'
  check(data,False,'default-on refused: '+flag)
 for flag in ['LEADLOOM_DEV_MAIL_SINK_FILE','LEADLOOM_MAILBOX_ALLOW_PRIVATE_HOSTS','LEADLOOM_AUTH_ISSUER_ENABLED']:
  data=copy();data['services']['api']['environment'][flag]='unsafe-fixture'
  check(data,False,'development/legacy exposure refused: '+flag)
 for service in ['api','web']:
  data=copy();del data['services'][service]['environment']['LEADLOOM_PLATFORM_ADMIN_EMAIL']
  check(data,False,'missing explicit admin identity pass-through refused: '+service)
  data=copy();data['services'][service]['environment']['LEADLOOM_PLATFORM_ADMIN_EMAIL']='${LEADLOOM_PLATFORM_ADMIN_EMAIL:-fallback-admin@example.invalid}'
  check(data,False,'fallback admin identity refused: '+service)
 data=copy();data['services']['web']['environment']['LEADLOOM_PASSWORD_AUTH_ENABLED']='true'
 check(data,False,'mismatched web/engine password policy refused')
print('33 Compose policy cases passed. Static contract only, not Docker parsing, images or deployment.')
