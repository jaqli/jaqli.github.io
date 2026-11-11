// Synchronous, tiny head script prevents a flash before destination assembly.
// Fail open if modules cannot load; a stale storage entry cannot hide the page.
try {
  const route=JSON.parse(sessionStorage.getItem('jaqli-route'));
  if(route&&route.to===location.pathname+location.search&&Date.now()-route.at<10000&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
    document.documentElement.classList.add('route-arriving');
    setTimeout(()=>document.documentElement.classList.remove('route-arriving'),1500);
  }
} catch {}
