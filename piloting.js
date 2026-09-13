(async() => {
  const VERSION = 'SPA-2026-09-v2';
  const C = window.SuraeCatalog;
  const API = window.SuraeAPI;
  await C.ready;

  // Production rates are loaded from Supabase.
  const PILOTING_RATES = {mlbb:{},codm:{}};
  for (const r of C.getRates()) {
    const key = String(r.game||'').toLowerCase();
    if (PILOTING_RATES[key]) PILOTING_RATES[key][r.rank] = Number(r.rate);
  }

  // MLBB star capacities used only to work out how many stars are crossed
  // when the request moves from one selected rank tier to another.
  const MLBB_CAPACITY = {
    Warrior: 9, Elite: 12, Master: 16, Grandmaster: 25,
    Epic: 25, Legend: 25, Mythic: 25, 'Mythical Honor': 25,
    'Mythical Glory': 50, 'Mythical Immortal': 999
  };
  const MLBB_ORDER = Object.keys(MLBB_CAPACITY);
  const CODM_ORDER = ['Rookie','Veteran','Elite','Pro','Master','Grandmaster','Legendary'];
  const CODM_BOUNDS = {
    Rookie:[0,1000], Veteran:[1000,2000], Elite:[2000,3000],
    Pro:[3000,4500], Master:[4500,6000], Grandmaster:[6000,8000],
    Legendary:[8000,Infinity]
  };

  const quoteModal = document.getElementById('quoteModal');
  const quoteGame = document.getElementById('quoteGame');
  const quoteForm = document.getElementById('quoteForm');
  const quoteError = document.getElementById('quoteError');
  const mlbbQuoteFields = document.getElementById('mlbbQuoteFields');
  const codmQuoteFields = document.getElementById('codmQuoteFields');
  const quoteResult = document.getElementById('quoteResult');
  const quoteUnitsLabel = document.getElementById('quoteUnitsLabel');
  const quoteUnits = document.getElementById('quoteUnits');
  const quotePrice = document.getElementById('quotePrice');
  const quoteBreakdown = document.getElementById('quoteBreakdown');
  const quoteGameBadge = document.getElementById('quoteGameBadge');
  const agreeQuote = document.getElementById('agreeQuote');
  const pricingSetupNotice = document.getElementById('pricingSetupNotice');
  const agreementQuotePrice = document.getElementById('agreementQuotePrice');
  const agreementPricingMode = document.getElementById('agreementPricingMode');
  const agreementCurrentRank = document.getElementById('agreementCurrentRank');
  const agreementTargetRank = document.getElementById('agreementTargetRank');
  const agreementUnits = document.getElementById('agreementUnits');
  const agreementUnitsLabel = document.getElementById('agreementUnitsLabel');
  const agreementQuoteBreakdown = document.getElementById('agreementQuoteBreakdown');
  let pendingGame = '';
  let acceptedQuote = null;
  const modal = document.getElementById('agreementModal');
  const selectedGame = document.getElementById('selectedGame');
  const form = document.getElementById('agreementForm');
  const error = document.getElementById('formError');
  const canvas = document.getElementById('signatureCanvas');
  const ctx = canvas.getContext('2d');
  const signaturePresent = document.getElementById('signaturePresent');
  const toast = document.getElementById('successToast');
  const mlbbAccountField = document.getElementById('mlbbAccountField');
  const mlbbAccountType = document.getElementById('mlbbAccountType');
  const credentialFields = document.getElementById('credentialFields');
  const accountUsername = document.getElementById('accountUsername');
  const codmCredentialFields = document.getElementById('codmCredentialFields');
  const codmUsername = document.getElementById('codmUsername');
  const codmPassword = document.getElementById('codmPassword');
  const accountPassword = document.getElementById('accountPassword');
  let game = '';
  let drawing = false;
  let hasInk = false;

  const esc = s => String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const old = hasInk ? canvas.toDataURL() : null;
    canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#101820';
    if (old) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = old;
    }
  }

  function point(ev) {
    const r = canvas.getBoundingClientRect();
    const p = ev.touches ? ev.touches[0] : ev;
    return {x:p.clientX-r.left, y:p.clientY-r.top};
  }
  function start(ev){ ev.preventDefault(); drawing=true; const p=point(ev); ctx.beginPath(); ctx.moveTo(p.x,p.y); }
  function move(ev){ if(!drawing) return; ev.preventDefault(); const p=point(ev); ctx.lineTo(p.x,p.y); ctx.stroke(); hasInk=true; signaturePresent.value='yes'; }
  function end(){ drawing=false; ctx.closePath(); }

  canvas.addEventListener('pointerdown', start);
  canvas.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end);
  document.getElementById('clearSignature').addEventListener('click', () => { ctx.clearRect(0,0,canvas.width,canvas.height); hasInk=false; signaturePresent.value=''; });


  const peso = value => new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(value);

  function anyMissingRate(items){
    return items.some(x => typeof x.rate !== 'number' || !Number.isFinite(x.rate));
  }

  function mlbbQuote(currentRank,targetRank,currentStars,targetStars){
    const a = MLBB_ORDER.indexOf(currentRank), b = MLBB_ORDER.indexOf(targetRank);
    if(a < 0 || b < 0) throw new Error('Please select both MLBB ranks.');
    if(b < a) throw new Error('Target rank must be the same as or higher than the current rank.');
    if(!Number.isInteger(currentStars) || !Number.isInteger(targetStars) || currentStars < 0 || targetStars < 0) throw new Error('Stars must be whole numbers.');
    if(currentStars > MLBB_CAPACITY[currentRank]) throw new Error(`Current stars cannot exceed ${MLBB_CAPACITY[currentRank]} for ${currentRank}.`);
    if(targetRank !== 'Mythical Immortal' && targetStars > MLBB_CAPACITY[targetRank]) throw new Error(`Target stars cannot exceed ${MLBB_CAPACITY[targetRank]} for ${targetRank}.`);

    const pieces = [];
    if(a === b){
      if(targetStars <= currentStars) throw new Error('Target stars must be higher than current stars.');
      pieces.push({tier:currentRank,units:targetStars-currentStars,rate:PILOTING_RATES.mlbb[currentRank]});
    } else {
      const first = MLBB_CAPACITY[currentRank] - currentStars;
      if(first > 0) pieces.push({tier:currentRank,units:first,rate:PILOTING_RATES.mlbb[currentRank]});
      for(let i=a+1;i<b;i++){
        pieces.push({tier:MLBB_ORDER[i],units:MLBB_CAPACITY[MLBB_ORDER[i]],rate:PILOTING_RATES.mlbb[MLBB_ORDER[i]]});
      }
      if(targetStars > 0) pieces.push({tier:targetRank,units:targetStars,rate:PILOTING_RATES.mlbb[targetRank]});
    }
    const units = pieces.reduce((s,x)=>s+x.units,0);
    if(units <= 0) throw new Error('Target rank must be higher than the current progress.');
    const missing = anyMissingRate(pieces);
    const total = missing ? null : pieces.reduce((s,x)=>s+x.units*x.rate,0);
    return {game:'Mobile Legends: Bang Bang',currentRank,targetRank,currentValue:currentStars,targetValue:targetStars,unitName:'stars',units,pieces,total,configured:!missing};
  }

  function codmQuote(currentRank,targetRank,currentPoints,targetPoints){
    const a = CODM_ORDER.indexOf(currentRank), b = CODM_ORDER.indexOf(targetRank);
    if(a < 0 || b < 0) throw new Error('Please select both CODM ranks.');
    if(b < a) throw new Error('Target rank must be the same as or higher than the current rank.');
    if(!Number.isInteger(currentPoints) || !Number.isInteger(targetPoints) || currentPoints < 0 || targetPoints < 0) throw new Error('Points must be whole numbers.');
    if(targetPoints <= currentPoints) throw new Error('Target points must be higher than current points.');

    const currentBounds = CODM_BOUNDS[currentRank], targetBounds = CODM_BOUNDS[targetRank];
    if(currentPoints < currentBounds[0] || currentPoints >= currentBounds[1]) throw new Error(`Current points do not match the selected ${currentRank} rank.`);
    if(targetPoints < targetBounds[0] || targetPoints >= targetBounds[1]) {
      if(targetRank !== 'Legendary') throw new Error(`Target points do not match the selected ${targetRank} rank.`);
      if(targetPoints < targetBounds[0]) throw new Error('Legendary target points must be at least 8000.');
    }

    const pieces=[];
    let cursor=currentPoints;
    for(let i=a;i<=b && cursor<targetPoints;i++){
      const tier=CODM_ORDER[i], bounds=CODM_BOUNDS[tier];
      const end=Math.min(targetPoints,bounds[1]);
      const units=end-cursor;
      if(units>0) pieces.push({tier,units,rate:PILOTING_RATES.codm[tier]});
      cursor=end;
    }
    const units=targetPoints-currentPoints;
    const missing=anyMissingRate(pieces);
    const total=missing?null:pieces.reduce((s,x)=>s+x.units*x.rate,0);
    return {game:'Call of Duty: Mobile',currentRank,targetRank,currentValue:currentPoints,targetValue:targetPoints,unitName:'points',units,pieces,total,configured:!missing};
  }

  function breakdownText(q){
    if(!q.configured) return q.pieces.map(x=>`${x.tier}: ${x.units} ${q.unitName} × rate not set`).join(' • ');
    return q.pieces.map(x=>`${x.tier}: ${x.units} ${q.unitName} × ${peso(x.rate)} = ${peso(x.units*x.rate)}`).join(' • ');
  }

  function openQuote(name){
    pendingGame=name;
    acceptedQuote=null;
    quoteGame.textContent=name;
    quoteError.textContent='';
    quoteResult.hidden=true;
    agreeQuote.hidden=true;

    // Hard reset both game quote forms first so data can never bleed between games.
    ['mlbbCurrentRank','mlbbTargetRank','mlbbCurrentStars','mlbbTargetStars',
     'codmCurrentRank','codmTargetRank','codmCurrentPoints','codmTargetPoints']
      .forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });

    const isMLBB = name === 'Mobile Legends: Bang Bang';
    const isCODM = name === 'Call of Duty: Mobile';

    mlbbQuoteFields.hidden = !isMLBB;
    codmQuoteFields.hidden = !isCODM;

    // Only the selected game's fields are enabled.
    mlbbQuoteFields.querySelectorAll('input,select').forEach(el => { el.disabled=!isMLBB; });
    codmQuoteFields.querySelectorAll('input,select').forEach(el => { el.disabled=!isCODM; });

    pricingSetupNotice.classList.toggle('configured', false);
    quoteModal.classList.add('open');
    quoteModal.setAttribute('aria-hidden','false');
    document.body.style.overflow='hidden';
  }

  function closeQuote(){
    quoteModal.classList.remove('open');
    quoteModal.setAttribute('aria-hidden','true');
    document.body.style.overflow='';
  }

  function showQuote(q){
    const isMLBB = q.game === 'Mobile Legends: Bang Bang';
    quoteGameBadge.textContent = isMLBB ? 'MLBB • STAR-BASED PRICING' : 'CODM • POINT-BASED PRICING';
    quoteUnitsLabel.textContent = isMLBB ? 'Stars Needed' : 'Points Needed';
    quoteUnits.textContent = q.units.toLocaleString('en-PH');
    quotePrice.textContent = q.configured ? peso(q.total) : 'Rates not configured';
    quoteBreakdown.textContent = breakdownText(q);
    quoteResult.hidden=false;
    pricingSetupNotice.classList.toggle('configured', q.configured);
    agreeQuote.hidden=!q.configured;
  }

  quoteForm.addEventListener('submit', e=>{
    e.preventDefault(); quoteError.textContent='';
    try{
      let q;
      if(pendingGame==='Mobile Legends: Bang Bang'){
        const cr=document.getElementById('mlbbCurrentRank').value;
        const tr=document.getElementById('mlbbTargetRank').value;
        const cs=Number(document.getElementById('mlbbCurrentStars').value);
        const ts=Number(document.getElementById('mlbbTargetStars').value);
        q=mlbbQuote(cr,tr,cs,ts);
      } else if(pendingGame==='Call of Duty: Mobile'){
        const cr=document.getElementById('codmCurrentRank').value;
        const tr=document.getElementById('codmTargetRank').value;
        const cp=Number(document.getElementById('codmCurrentPoints').value);
        const tp=Number(document.getElementById('codmTargetPoints').value);
        q=codmQuote(cr,tr,cp,tp);
      } else {
        throw new Error('Unsupported game selection.');
      }
      acceptedQuote=q;
      showQuote(q);
      if(!q.configured) quoteError.textContent='Quote calculation is ready, but the shop rates must be configured before the customer can agree.';
    }catch(err){
      acceptedQuote=null; quoteResult.hidden=true; agreeQuote.hidden=true; quoteError.textContent=err.message || 'Please check the rank details.';
    }
  });

  agreeQuote.addEventListener('click',()=>{
    if(!acceptedQuote || !acceptedQuote.configured) return;
    closeQuote();
    agreementQuotePrice.textContent=peso(acceptedQuote.total);
    agreementPricingMode.textContent=acceptedQuote.game==='Mobile Legends: Bang Bang' ? 'Per Star (MLBB)' : 'Per Ranked Point (CODM)';
    agreementCurrentRank.textContent=`${acceptedQuote.currentRank} (${acceptedQuote.currentValue.toLocaleString('en-PH')} ${acceptedQuote.unitName})`;
    agreementTargetRank.textContent=`${acceptedQuote.targetRank} (${acceptedQuote.targetValue.toLocaleString('en-PH')} ${acceptedQuote.unitName})`;
    agreementUnitsLabel.textContent=acceptedQuote.unitName==='stars'?'Stars Needed':'Points Needed';
    agreementUnits.textContent=acceptedQuote.units.toLocaleString('en-PH');
    agreementQuoteBreakdown.textContent=breakdownText(acceptedQuote);
    openModal(acceptedQuote.game);
  });

  document.querySelectorAll('[data-close-quote]').forEach(el=>el.addEventListener('click',closeQuote));

  function openModal(name){
    game=name; selectedGame.textContent=name;
    const isMLBB = name === 'Mobile Legends: Bang Bang';
    mlbbAccountField.hidden = !isMLBB;
    mlbbAccountType.required = isMLBB;
    if (!isMLBB) mlbbAccountType.value = '';
    credentialFields.hidden = true;
    accountUsername.required = false;
    accountPassword.required = false;
    accountUsername.value = '';
    accountPassword.value = '';
    const isCODM = name === 'Call of Duty: Mobile';
    codmCredentialFields.hidden = !isCODM;
    codmUsername.required = isCODM;
    codmPassword.required = false;
    if (!isCODM) { codmUsername.value = ''; codmPassword.value = ''; }
    modal.classList.add('open'); modal.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden'; error.textContent='';
    setTimeout(resizeCanvas, 40);
  }
  function closeModal(){ modal.classList.remove('open'); modal.setAttribute('aria-hidden','true'); document.body.style.overflow=''; }

  mlbbAccountType.addEventListener('change', () => {
    const show = game === 'Mobile Legends: Bang Bang' && !!mlbbAccountType.value;
    credentialFields.hidden = !show;
    accountUsername.required = show;
    accountPassword.required = false;
    if (!show) {
      accountUsername.value = '';
      accountPassword.value = '';
    }
  });

  document.querySelectorAll('.pilot-game-card').forEach(card => card.addEventListener('click', () => openQuote(card.dataset.game)));
  document.querySelectorAll('[data-close-modal]').forEach(el => el.addEventListener('click', closeModal));
  document.addEventListener('keydown', e => { if(e.key==='Escape' && modal.classList.contains('open')) closeModal(); });
  window.addEventListener('resize', () => { if(modal.classList.contains('open')) resizeCanvas(); });

  function makeAgreementId(){
    const part = Math.random().toString(36).slice(2,8).toUpperCase();
    return `SURAE-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${part}`;
  }

  function printable(record, signature){
    const clauses = document.getElementById('agreementText').innerHTML;
    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(record.id)} - Surae Piloting Agreement</title><style>body{font:14px Arial,sans-serif;line-height:1.55;color:#17202a;max-width:850px;margin:40px auto;padding:0 28px}h1,h2,h3,h4{color:#0b3550}h1{font-size:24px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;background:#f1f7fa;padding:16px;margin:18px 0}.meta div{padding:5px}.sig{margin-top:24px;border-top:1px solid #bbb;padding-top:18px}.sig img{width:330px;height:130px;object-fit:contain;object-position:left center;border-bottom:1px solid #222}.fine{font-size:11px;color:#566}.controls{margin-bottom:20px}@media print{.controls{display:none}body{margin:0}}</style></head><body><div class="controls"><button onclick="window.print()">Print / Save as PDF</button></div><h1>SURAE DIGITAL SHOP</h1><h2>Signed Account Piloting Service Agreement</h2><div class="meta"><div><b>Agreement ID:</b> ${esc(record.id)}</div><div><b>Version:</b> ${VERSION}</div><div><b>Game:</b> ${esc(record.game)}</div><div><b>Signed:</b> ${esc(record.signedAt)}</div><div><b>Customer:</b> ${esc(record.fullName)}</div><div><b>Email:</b> ${esc(record.email)}</div><div><b>Mobile:</b> ${esc(record.mobile)}</div><div><b>Player ID:</b> ${esc(record.playerId)}</div><div><b>Facebook Account Name:</b> ${esc(record.facebookAccountName)}</div><div><b>In-game name:</b> ${esc(record.ign || 'Not provided')}</div>${record.mlbbAccountType ? `<div><b>MLBB Account / Login Type:</b> ${esc(record.mlbbAccountType)}</div><div><b>Login Username:</b> ${esc(record.accountUsername)}</div>` : ''}${record.codmUsername ? `<div><b>CODM Login:</b> Garena Account</div><div><b>Garena Username:</b> ${esc(record.codmUsername)}</div>` : ''}<div><b>Current Rank:</b> ${esc(record.quote.currentRank)} (${esc(record.quote.currentValue)} ${esc(record.quote.unitName)})</div><div><b>Target Rank:</b> ${esc(record.quote.targetRank)} (${esc(record.quote.targetValue)} ${esc(record.quote.unitName)})</div><div><b>${record.quote.unitName === 'stars' ? 'Stars' : 'Points'} Needed:</b> ${esc(record.quote.units)}</div><div><b>Accepted Quote:</b> ${esc(record.quote.priceFormatted)}</div><div><b>Pricing Basis:</b> ${record.game === 'Mobile Legends: Bang Bang' ? 'Per Star (MLBB)' : 'Per Ranked Point (CODM)'}</div><div style="grid-column:1/-1"><b>Rate Breakdown:</b> ${esc(record.quote.breakdown)}</div></div>${clauses}<div class="sig"><h3>Electronic Acceptance Record</h3><img src="${signature}" alt="Customer signature"><p><b>${esc(record.fullName)}</b><br>Electronically signed on ${esc(record.signedAt)}</p><p class="fine">The signer affirmatively confirmed age/legal capacity, account ownership or authorization, temporary account-access authorization, acceptance of the Agreement, and acknowledgement of the Privacy Notice. Record reference: ${esc(record.id)}.</p></div></body></html>`;
  }

  form.addEventListener('submit', async ev => {
    ev.preventDefault(); error.textContent='';
    if(!acceptedQuote || !acceptedQuote.configured){ error.textContent='Please accept a valid rank-up quote before signing.'; return; }
    if(!form.checkValidity()){ form.reportValidity(); error.textContent='Please complete all required fields and confirmations.'; return; }
    if(!hasInk){ error.textContent='Please draw your signature before accepting the agreement.'; return; }

    const record = {
      id: makeAgreementId(), version: VERSION, game,
      fullName: document.getElementById('fullName').value.trim(),
      email: document.getElementById('email').value.trim(),
      mobile: document.getElementById('mobile').value.trim(),
      playerId: document.getElementById('playerId').value.trim(),
      facebookAccountName: document.getElementById('facebookAccountName').value.trim(),
      ign: document.getElementById('ign').value.trim(),
      mlbbAccountType: game === 'Mobile Legends: Bang Bang' ? mlbbAccountType.value : '',
      accountUsername: game === 'Mobile Legends: Bang Bang' ? accountUsername.value.trim() : '',
      codmUsername: game === 'Call of Duty: Mobile' ? codmUsername.value.trim() : '',
      quote: acceptedQuote ? {
        currentRank: acceptedQuote.currentRank,
        targetRank: acceptedQuote.targetRank,
        currentValue: acceptedQuote.currentValue,
        targetValue: acceptedQuote.targetValue,
        unitName: acceptedQuote.unitName,
        units: acceptedQuote.units,
        total: acceptedQuote.total,
        priceFormatted: peso(acceptedQuote.total),
        breakdown: breakdownText(acceptedQuote)
      } : null,
      signedAt: new Date().toLocaleString('en-PH',{dateStyle:'long',timeStyle:'medium'}),
      signedAtISO: new Date().toISOString(),
      accepted: {adult:true,authorizedOwner:true,agreement:true,privacyNotice:true}
    };
    const signature = canvas.toDataURL('image/png');
    const signatureBlob = await (await fetch(signature)).blob();
    let cloudAgreement;
    try {
      cloudAgreement = await API.submitPiloting({
        version: VERSION, game, fullName: record.fullName, email: record.email, mobile: record.mobile,
        playerId: record.playerId, facebookAccountName: record.facebookAccountName, ign: record.ign,
        mlbbAccountType: record.mlbbAccountType, accountUsername: record.accountUsername, codmUsername: record.codmUsername,
        quote: {currentRank:acceptedQuote.currentRank,targetRank:acceptedQuote.targetRank,currentValue:acceptedQuote.currentValue,targetValue:acceptedQuote.targetValue,unitName:acceptedQuote.unitName}
      }, signatureBlob);
      record.id = cloudAgreement.agreementId;
      record.quote.total = cloudAgreement.quotedAmount;
      record.quote.priceFormatted = peso(cloudAgreement.quotedAmount);
    } catch (err) {
      error.textContent = err.message || 'Unable to save the agreement securely. Please try again.';
      return;
    }

    const html = printable(record, signature);
    const blob = new Blob([html], {type:'text/html'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url; a.download=`${record.id}-piloting-agreement.html`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    closeModal();
    toast.innerHTML = `<strong>Agreement signed.</strong><br>Reference: ${esc(record.id)}<br>A signed copy has been prepared for your records.`;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 7000);
    form.reset(); credentialFields.hidden=true; accountUsername.required=false; accountPassword.required=false; codmCredentialFields.hidden=true; codmUsername.required=false; codmPassword.required=false; ctx.clearRect(0,0,canvas.width,canvas.height); hasInk=false; signaturePresent.value='';
  });
})();
