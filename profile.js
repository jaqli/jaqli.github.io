function el(tag,text,className){
  const node=document.createElement(tag);
  if(text!=null)node.textContent=text;
  if(className)node.className=className;
  return node;
}
function url(value){
  if(typeof value!=='string'||!value.trim())return null;
  try{const result=new URL(value,location.href);return ['http:','https:'].includes(result.protocol)?result.href:null;}catch{return null;}
}
function link(label,href,className='source-link'){
  const a=el('a',label,className),safe=url(href);
  if(safe)a.href=safe;
  a.target='_blank';a.rel='noopener noreferrer';return a;
}
function emailLink(email,label=email){
  if(!/^[a-z\d._%+-]+@[a-z\d.-]+\.[a-z]{2,}$/i.test(email||''))return null;
  const a=el('a',label,'source-link');a.href=`mailto:${email}`;return a;
}
function publication(paper){
  const item=el('article',null,'publication');
  if(paper.id)item.id=`paper-${paper.id}`;
  const body=el('div',null,'publication-copy');
  const meta=el('div',null,'publication-meta');
  const year=paper.venue?.includes(String(paper.year))?'':paper.year;
  if(paper.shortTitle)meta.append(el('span',paper.shortTitle,'publication-name'));
  meta.append(el('span',[paper.venue,year].filter(Boolean).join(' / ')));
  if(paper.role)meta.append(el('span',paper.role,'profile-badge'));
  const heading=el('h3');heading.append(link(paper.title,paper.url,''));
  body.append(meta,heading);
  if(paper.authors){
    const authors=el('p',null,'publication-authors');
    paper.authors.split(/(Jiaqi Li\*?|J Li(?=,|$))/).forEach(part=>authors.append(/^(Jiaqi Li\*?|J Li)$/.test(part)?el('strong',part):document.createTextNode(part)));
    body.append(authors);
  }
  if(paper.description)body.append(el('p',paper.description,'publication-description'));
  const resources=el('div',null,'publication-links');
  resources.append(link('Paper ↗',paper.url));
  for(const resource of paper.links||[])if(url(resource.url))resources.append(link(`${resource.label} ↗`,resource.url));
  body.append(resources);
  if(url(paper.media?.url)){
    const media=paper.media,figure=el('figure',null,'publication-media');
    const preview=el('img');preview.src=url(media.url);preview.alt=media.alt||`${paper.shortTitle||paper.title} teaser`;
    preview.width=media.width;preview.height=media.height;preview.loading='lazy';preview.decoding='async';
    if(url(media.video)){
      const button=el('button',null,'publication-play');button.type='button';
      button.setAttribute('aria-label',`Play ${paper.shortTitle||paper.title} video`);
      const label=el('span','▶ PLAY VIDEO','publication-play-label');
      button.append(preview,label);figure.append(button);
      button.addEventListener('click',()=>{
        const video=el('video');video.controls=true;video.playsInline=true;video.preload='none';
        video.poster=url(media.url);video.setAttribute('aria-label',`${paper.shortTitle||paper.title} video`);
        video.src=url(media.video);figure.replaceChild(video,button);
        video.addEventListener('play',()=>document.querySelectorAll('.publication-media video').forEach(other=>{if(other!==video)other.pause();}));
        video.play().catch(()=>{});video.focus();
      },{once:true});
    }else{
      const a=link('',media.source||paper.url,'publication-preview');a.setAttribute('aria-label',`View ${paper.shortTitle||paper.title} figure`);a.append(preview);figure.append(a);
    }
    const caption=el('figcaption');caption.append(link(media.caption||'View original ↗',media.source||paper.url,''));figure.append(caption);
    item.append(figure);item.classList.add('has-media');
  }
  item.append(body);
  return item;
}
export function renderProfile(profile){
  if(!profile?.syncedAt)return;
  const root=document.querySelector('#content'),nav=document.querySelector('#profile-nav');
  const about=profile.about||{},contacts=about.contacts||{};
  document.querySelector('#profile-name').textContent=profile.name;
  document.querySelector('#profile-lead').textContent=about.tagline||profile.affiliation||'Research & publications';
  document.querySelector('#profile-affiliation').textContent=about.tagline?(profile.affiliation||''):'';
  const avatar=document.querySelector('#profile-avatar');
  document.querySelector('#profile-picture').hidden=!url(profile.avatar?.url);
  if(url(profile.avatar?.url)){avatar.src=url(profile.avatar.url);avatar.alt=profile.avatar.alt||profile.name;}
  const links=document.querySelector('#profile-links');links.replaceChildren(link('Scholar ↗',profile.source));
  const email=emailLink(contacts.email,'Email ↗');if(email)links.append(email);
  if(contacts.github)links.append(link('GitHub ↗',contacts.github));
  root.replaceChildren();nav.replaceChildren();nav.hidden=false;
  let count=0;
  const section=(id,title,body)=>{
    const s=el('section',null,'profile-section');s.id=id;
    const heading=el('h2'),number=el('span',String(++count).padStart(2,'0'),'section-number');number.setAttribute('aria-hidden','true');
    heading.id=`${id}-heading`;heading.append(number,document.createTextNode(title));s.setAttribute('aria-labelledby',heading.id);
    s.append(heading,body);root.append(s);
    const a=el('a',title);a.href=`#${id}`;nav.append(a);
  };
  if(profile.bio)section('about','About',el('p',profile.bio,'profile-bio'));
  if(about.research?.length){
    const list=el('ul',null,'research-list');
    for(const entry of about.research){const item=el('li');item.append(el('h3',entry.title),el('p',entry.description));list.append(item);}
    section('research','Research',list);
  }else if(profile.interests?.length)section('research','Research',el('p',profile.interests.join(' / ')));
  if(about.experience?.length){
    const list=el('ol',null,'profile-timeline');
    for(const entry of about.experience){
      const item=el('li');
      item.append(el('p',entry.period||'CURRENT','profile-date'),el('h3',entry.title),el('p',entry.organization,'profile-institution'),el('p',entry.team,'profile-note'));
      list.append(item);
    }
    section('experience','Experience',list);
  }
  const selected=about.selectedPublications||[],all=profile.publications||[];
  if(selected.length||all.length){
    const body=el('div',null,'publications-list');
    for(const paper of selected.length?selected:all)body.append(publication(paper));
    body.append(link('Google Scholar ↗',profile.source));section('publications','Publications',body);
  }
  if(about.awards?.length){
    const list=el('ul',null,'honor-list');
    for(const entry of about.awards){
      const item=el('li'),text=el('div');text.append(el('h3',entry.title),el('p',[entry.organization,entry.note].filter(Boolean).join(' · ')));
      item.append(el('span',entry.year,'profile-date'),text);list.append(item);
    }
    section('honors','Honors',list);
  }
  if(contacts.email||contacts.github){
    const body=el('div',null,'profile-contact'),mail=emailLink(contacts.email);if(mail)body.append(mail);
    if(contacts.github)body.append(link('GitHub ↗',contacts.github));
    section('contact','Contact',body);
  }
  if(about.source){const source=el('p',null,'profile-source');source.append(link('About on Notion ↗',about.source,''));root.append(source);}
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)document.querySelectorAll('.publication-media video').forEach(video=>video.pause());});
window.addEventListener('pagehide',()=>document.querySelectorAll('.publication-media video').forEach(video=>video.pause()));
