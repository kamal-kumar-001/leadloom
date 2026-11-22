// Explicit no-network DNS fixture for disposable runtime verification only.
import dns from 'node:dns/promises';
import {syncBuiltinESMExports} from 'node:module';
dns.resolveTxt=async host=>{if(host==='diagnostic.invalid')return[['v=spf1 include:sender.invalid ~all']];if(host==='_dmarc.diagnostic.invalid')return[['v=DMARC1; p=reject']];if(host==='known._domainkey.diagnostic.invalid')return[['v=DKIM1; k=rsa; p=SGVsbG9Xb3JsZA==']];throw Object.assign(Error('Synthetic DNS unavailable'),{code:'ETIMEOUT'});};
syncBuiltinESMExports();
