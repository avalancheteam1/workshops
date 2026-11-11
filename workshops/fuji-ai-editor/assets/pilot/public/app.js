const $ = id => document.getElementById(id);
const base = location.pathname;
let manifest;
async function request(action, input) {
  const r = await fetch(`${base}api/${action}`, input === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
  const data = await r.json(); if (!r.ok) throw Error(data.error); return data;
}
function message(text, error = false) { $('status').textContent = text; $('status').className = error ? 'error' : ''; }
function showStatus(s) {
  const labels = { not_started: 'Ready for your review.', connect_wallet: 'Connect a Fuji test wallet to prepare the exact deployment.', awaiting_signature: 'A wallet request was started. Do not send again. Check your wallet and recover the transaction hash if it was sent.', submitted: 'Transaction submitted. Check status again; do not deploy twice.', confirmed: `Deployment confirmed: ${s.address}`, rejected: 'You rejected the wallet request. No new request will start until you click deploy again.', reverted: 'Transaction reverted. This attempt stays recorded; ask for support before another deployment.' };
  message(s.guidance || labels[s.state] || s.state);
  $('deploy').disabled = !['not_started', 'rejected'].includes(s.state);
}
async function ensureWallet() {
  if (!window.ethereum?.request) throw Error('Open this page in a browser with a wallet extension, such as Core or MetaMask.');
  if (await ethereum.request({ method: 'eth_chainId' }) !== '0xa869') throw Error('Switch your wallet to Avalanche Fuji testnet, then connect again.');
}
$('connect').onclick = async () => {
  try {
    await ensureWallet();
    const [account] = await ethereum.request({ method: 'eth_requestAccounts' });
    const result = await request('connect', { account }); manifest = result.manifest;
    const rows = [['Network', 'Avalanche Fuji · 43113'], ['Owner and signer', manifest.account], ['Initial number', manifest.initialValue], ['Maximum transaction cost', `${Number(manifest.maxCostWei) / 1e18} test AVAX`], ['Expected contract', manifest.expectedAddress], ['Manifest fingerprint', manifest.manifestHash]];
    $('summary').replaceChildren();
    for (const [label, value] of rows) { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = label; dd.textContent = value; $('summary').append(dt, dd); }
    $('download').href = `${base}api/manifest`; $('download').download = 'fuji-deployment-manifest.json'; $('review').hidden = false; showStatus(result.status);
  } catch (e) { message(e.message, true); }
};
$('deploy').onclick = async () => {
  $('deploy').disabled = true;
  let reserved = false;
  try {
    await ensureWallet();
    const accounts = await ethereum.request({ method: 'eth_accounts' });
    if (accounts[0]?.toLowerCase() !== manifest.account.toLowerCase()) throw Error('Wallet account changed. Connect and review again.');
    const r = await request('reserve', { manifestHash: manifest.manifestHash }); reserved = true;
    message('Approve or reject the deployment in your wallet.');
    const hash = await ethereum.request({ method: 'eth_sendTransaction', params: [r.transaction] });
    $('hash').value = hash;
    showStatus(await request('hash', { manifestHash: manifest.manifestHash, hash }));
  } catch (e) {
    if (reserved && e.code === 4001) {
      try { showStatus(await request('reject', { manifestHash: manifest.manifestHash, code: 4001 })); } catch (error) { message(error.message, true); }
    } else {
      message(`${e.message}${reserved ? ' Keep this reservation. If your wallet sent the transaction, recover its hash below.' : ''}`, true);
      if (!reserved) $('deploy').disabled = false;
    }
  }
};
$('refresh').onclick = async () => { try { showStatus(await request('status')); } catch (e) { message(e.message, true); } };
$('recover').onclick = async () => { try { if (!manifest) throw Error('Connect the same wallet first.'); showStatus(await request('hash', { manifestHash: manifest.manifestHash, hash: $('hash').value.trim() })); } catch (e) { message(e.message, true); } };
request('preview').then(p => { $('source').textContent = p.source; $('network').textContent = p.localDevelopment ? 'Local development EVM · not the public Fuji network' : 'Avalanche Fuji testnet · test AVAX only'; message(`Counter starts at ${p.initialValue}. Connect your test wallet to review the deployment.`); }).catch(e => message(e.message, true));
