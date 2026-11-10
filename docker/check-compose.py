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
print('Static Compose policies pass. Docker runtime/load verification and full provider readiness remain pending; scraper profile is unconfigured.')
