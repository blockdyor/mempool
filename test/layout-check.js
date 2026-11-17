(() => {
  const rect=e=>e.getBoundingClientRect(),visible=e=>rect(e).width>0&&rect(e).height>0;
  const strip=document.querySelector('.strip'),fees=document.querySelector('.fees'),blocks=[...document.querySelectorAll('.block')],errors=[];
  if(!strip||!fees||blocks.length!==3)return {ok:false,errors:['Missing block/fee layout']};
  const within=(a,b)=>a.left>=b.left-.5&&a.right<=b.right+.5&&a.top>=b.top-.5&&a.bottom<=b.bottom+.5;
  for(const [i,b] of blocks.entries()){
    if(!within(rect(b),rect(strip)))errors.push('Block '+i+' exceeds strip');
    const children=[...b.children].filter(visible);
    for(const c of children)if(!within(rect(c),rect(b)))errors.push('Block '+i+' child exceeds card: '+c.tagName);
    for(let n=1;n<children.length;n++)if(rect(children[n-1]).bottom>rect(children[n]).top+.5)errors.push('Block '+i+' internal overlap');
    if(rect(b.querySelector('svg')).height<10)errors.push('Block '+i+' graphic too small');
    if(rect(b).bottom>rect(fees).top)errors.push('Block '+i+' overlaps fees');
    if(b.closest('a')||b.querySelector('a'))errors.push('Block '+i+' is clickable');
  }
  if(document.querySelector('a[href^="https://mempool.space"]'))errors.push('Provider link remains');
  const footer=document.querySelector('footer');
  if(visible(footer)){
    const links=[...footer.querySelectorAll('a')];
    if(links.length!==2||links.at(-1).textContent!=='Source')errors.push('Footer differs from Price');
    if(Math.abs(rect(links.at(-1)).right-rect(footer).right)>.5)errors.push('Source not right aligned');
  }
  if(document.documentElement.scrollWidth>innerWidth)errors.push('Horizontal page overflow');
  if(document.documentElement.dataset.embed&&document.documentElement.scrollHeight>innerHeight)errors.push('Embed vertical overflow');
  return {ok:errors.length===0,errors,viewport:[innerWidth,innerHeight],theme:document.documentElement.dataset.theme,embed:!!document.documentElement.dataset.embed,strip:rect(strip).toJSON(),fees:rect(fees).toJSON(),graphics:blocks.map(b=>rect(b.querySelector('svg')).height)};
})()
