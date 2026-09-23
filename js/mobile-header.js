(function(){
  function init(){
    const toggle=document.querySelector('.mobile-menu-toggle');
    const menu=document.getElementById('ozziMobileMenu');
    if(!toggle||!menu)return;
    toggle.addEventListener('click',function(){const open=menu.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));});
    menu.addEventListener('click',function(e){if(e.target.closest('a,button:not(.mobile-menu-toggle)')){menu.classList.remove('open');toggle.setAttribute('aria-expanded','false');}});
    document.addEventListener('click',function(e){if(!menu.contains(e.target)&&!toggle.contains(e.target)){menu.classList.remove('open');toggle.setAttribute('aria-expanded','false');}});
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
