"""Static policy checks only, not a substitute for docker compose config/up."""
from pathlib import Path
import yaml

root = Path(__file__).resolve().parents[1]
config = yaml.safe_load((root / 'docker-compose.yml').read_text())
services = config['services']
assert set(services) == {'postgres', 'redis', 'api', 'web', 'scraper-worker'}
assert sum(int(s['mem_limit'][:-1]) for s in services.values()) == 3456
assert not services['postgres'].get('ports') and not services['redis'].get('ports')
assert config['networks']['backend']['internal'] is True
assert services['postgres']['environment']['POSTGRES_PASSWORD'].startswith('${POSTGRES_PASSWORD:?')
assert 'noeviction' in services['redis']['command']
assert services['redis']['command'][-1] == 'everysec'
for name, service in services.items():
    assert service['security_opt'] == ['no-new-privileges:true']
    assert service['pids_limit'] > 0
    assert service['logging']['options']['max-file'] == '3'
    if name not in {'postgres', 'redis'}:
        assert service['profiles'] == (['scraper-unconfigured'] if name == 'scraper-worker' else ['application'])
        for port in service.get('ports', []):
            assert port.startswith('127.0.0.1:')
# Every supported flag remains opt-in when passed through Compose. The container
# must not silently discard the same settings verified by native runtime tests.
private_flags = [
    'LEADLOOM_RESEARCH_API_ENABLED', 'LEADLOOM_VALIDATOR_API_ENABLED',
    'LEADLOOM_DNS_DIAGNOSTICS_ENABLED', 'LEADLOOM_ENTITLEMENTS_ENFORCED',
    'LEADLOOM_TEAM_INVITES_ENABLED', 'LEADLOOM_MAILBOX_CONNECT_ENABLED',
    'LEADLOOM_WATERFALL_API_ENABLED', 'LEADLOOM_GROWTH_WATCHES_ENABLED',
]
effectful_flags = [
    'LEADLOOM_RESEARCH_FETCH_ENABLED', 'LEADLOOM_CONNECTORS_LIVE_ENABLED',
    'LEADLOOM_WORKER_ENABLED', 'LEADLOOM_OUTBOUND_SENDING_ENABLED',
]
for flag in private_flags + effectful_flags:
    assert services['api']['environment'][flag] == '${' + flag + ':-false}', flag
    assert 'process.env.' + flag in (root / 'apps/engine/src/main.ts').read_text(), 'Unrecognized runtime flag: ' + flag
for flag in ['LEADLOOM_DEV_MAIL_SINK_FILE', 'LEADLOOM_MAILBOX_ALLOW_PRIVATE_HOSTS', 'LEADLOOM_AUTH_ISSUER_ENABLED']:
    assert flag not in services['api']['environment'], 'Development/legacy mode must not be exposed: ' + flag
assert services['api']['environment']['LEADLOOM_UNSUBSCRIBE_KEY'] == '${LEADLOOM_UNSUBSCRIBE_KEY:-}'
assert services['api']['environment']['LEADLOOM_WORKER_INTERVAL_MS'] == '${LEADLOOM_WORKER_INTERVAL_MS:-60000}'
assert services['api']['environment']['LEADLOOM_PUBLIC_API_URL'] == '${LEADLOOM_PUBLIC_API_URL:-}'
for name in ['api', 'web']:
    assert services[name]['environment']['LEADLOOM_PLATFORM_ADMIN_EMAIL'] == '${LEADLOOM_PLATFORM_ADMIN_EMAIL:-}', 'Admin identity must be explicit, empty by default and identical in web/API: ' + name
assert services['web']['environment']['LEADLOOM_PASSWORD_AUTH_ENABLED'] == services['api']['environment']['LEADLOOM_PASSWORD_AUTH_ENABLED']
print('Static Compose policies pass. Docker runtime/load verification and full provider readiness remain pending; scraper profile is unconfigured.')
