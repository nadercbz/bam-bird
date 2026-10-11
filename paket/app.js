/* Bam Bird One Pager. GSAP ScrollSmoother (weiches Scrollen, Parallax über data-speed), ScrollTrigger (pin, scrub).
   Auf dem Handy und bei reduzierter Bewegung läuft normales Scrollen ohne Pins. */
(function(){
  gsap.registerPlugin(ScrollTrigger, ScrollSmoother);
  var desktop = window.matchMedia("(min-width:901px)").matches, reduce = window.matchMedia("(prefers-reduced-motion:reduce)").matches;
  var smoother = null;
  if (!reduce) smoother = ScrollSmoother.create({wrapper:"#smooth-wrapper", content:"#smooth-content", smooth: desktop ? 1.2 : 0.6, effects: desktop, smoothTouch: 0.1});

  /* Hero: Schrift fährt rein, Produkte schweben (data-speed macht den Parallax) und drehen leicht beim Scrollen */
  gsap.from(".hero h1", {yPercent:40, opacity:0, duration:1.1, ease:"power3.out", delay:.15});
  gsap.from(".hero .kick, .hero .lead, .hero .btn", {y:24, opacity:0, stagger:.12, duration:.9, delay:.5});
  gsap.from(".f", {scale:.6, opacity:0, rotate:"+=20", stagger:.1, duration:1.1, ease:"back.out(1.6)", delay:.2});
  if (!reduce) gsap.utils.toArray(".f").forEach(function(f, i){
    gsap.to(f, {rotate:"+=" + (i % 2 ? -18 : 18), ease:"none", scrollTrigger:{trigger:".hero", start:"top top", end:"bottom top", scrub:true}});
  });

  /* Statement Wort für Wort */
  document.querySelectorAll(".reveal").forEach(function(el){
    el.innerHTML = el.textContent.trim().split(/\s+/).map(function(w){ return '<span class="w">' + w + "</span>"; }).join(" ");
    gsap.to(el.querySelectorAll(".w"), {opacity:1, stagger:.08, ease:"none", scrollTrigger:{trigger:el, start:"top 78%", end:"bottom 45%", scrub:true}});
  });

  /* Laufschrift, Zähler */
  gsap.fromTo(".mq span", {xPercent:0}, {xPercent:-30, ease:"none", scrollTrigger:{trigger:".stats", start:"top bottom", end:"bottom top", scrub:true}});
  document.querySelectorAll("[data-n]").forEach(function(el){
    var n = +el.dataset.n, o = {v:0};
    ScrollTrigger.create({trigger:el, start:"top 85%", once:true, onEnter:function(){ gsap.to(o, {v:n, duration:1.6, ease:"power2.out", onUpdate:function(){ el.textContent = Math.round(o.v); }}); }});
  });
  gsap.from(".st-grid > div", {y:60, opacity:0, stagger:.1, duration:.8, scrollTrigger:{trigger:".st-grid", start:"top 80%"}});

  /* Kapitel: Text bleibt stehen (pin), Bilder laufen mit eigenem Tempo vorbei und kommen mit leichtem Schwung herein */
  gsap.utils.toArray(".ch").forEach(function(ch){
    gsap.from(ch.querySelectorAll(".ch-l > *"), {y:40, opacity:0, stagger:.1, duration:.8, scrollTrigger:{trigger:ch, start:"top 70%"}});
    ch.querySelectorAll(".ch-r figure").forEach(function(f, i){
      gsap.from(f, {y:90, rotate:i % 2 ? 2.5 : -2.5, opacity:0, duration:1, ease:"power3.out", scrollTrigger:{trigger:f, start:"top 92%"}});
    });
    if (desktop && !reduce) ScrollTrigger.create({trigger:ch, start:"top top+=100", end:"bottom bottom", pin:ch.querySelector(".ch-l"), pinSpacing:false});
  });

  /* Produkt Reihen laufen gegeneinander */
  gsap.fromTo(".prod .r1 > div", {x:0}, {x:function(){ return -(document.querySelector(".prod .r1 > div").scrollWidth - innerWidth) - 40; }, ease:"none", scrollTrigger:{trigger:".prod", start:"top bottom", end:"bottom top", scrub:true, invalidateOnRefresh:true}});
  gsap.fromTo(".prod .r2 > div", {x:function(){ return -(document.querySelector(".prod .r2 > div").scrollWidth - innerWidth) - 40; }}, {x:0, ease:"none", scrollTrigger:{trigger:".prod", start:"top bottom", end:"bottom top", scrub:true, invalidateOnRefresh:true}});

  /* Streifen mit Posts */
  gsap.fromTo(".strip-in", {x:0}, {x:function(){ return -(document.querySelector(".strip-in").scrollWidth - innerWidth) - 30; }, ease:"none", scrollTrigger:{trigger:".strip", start:"top bottom", end:"bottom top", scrub:true, invalidateOnRefresh:true}});

  /* Kiosk: Handy bleibt stehen, die Bildschirme wechseln beim Scrollen */
  var shots = gsap.utils.toArray(".phone-in img"), steps = gsap.utils.toArray(".k-steps li");
  function showShot(i){ shots.forEach(function(im, k){ gsap.to(im, {opacity: k === i ? 1 : 0, duration:.35, overwrite:true}); }); steps.forEach(function(s, k){ s.classList.toggle("on", k === i); }); }
  showShot(0);
  if (desktop && !reduce){
    ScrollTrigger.create({trigger:".kiosk", start:"top top", end:"+=2400", pin:".k-pin", scrub:true, onUpdate:function(self){ showShot(Math.min(shots.length - 1, Math.floor(self.progress * shots.length * .999))); }});
  } else {
    steps.forEach(function(s, k){ ScrollTrigger.create({trigger:s, start:"top 60%", onEnter:function(){ showShot(k); }, onEnterBack:function(){ showShot(k); }}); });
  }

  /* TV Reihe, Präsentationen horizontal */
  gsap.from(".tvs-g figure", {y:100, opacity:0, stagger:.15, duration:1, scrollTrigger:{trigger:".tvs-g", start:"top 85%"}});
  if (desktop && !reduce){
    var track = document.querySelector(".d-track");
    var dist = function(){ return Math.max(0, track.scrollWidth - innerWidth + 80); };
    gsap.to(track, {x:function(){ return -dist(); }, ease:"none", scrollTrigger:{trigger:".decks", start:"top top", end:function(){ return "+=" + dist(); }, pin:".d-pin", scrub:true, invalidateOnRefresh:true}});
  } else {
    document.querySelector(".d-pin").style.overflowX = "auto"; document.querySelector(".d-pin").style.paddingBottom = "20px";
  }

  /* Zahlen, Preis, Ablauf, Kontakt */
  gsap.from(".zc", {y:70, rotate:-3, opacity:0, stagger:.12, duration:.9, ease:"back.out(1.4)", scrollTrigger:{trigger:".z-r", start:"top 85%"}});
  gsap.from(".pc", {y:100, opacity:0, stagger:.15, duration:1, ease:"power3.out", scrollTrigger:{trigger:".p-grid", start:"top 85%"}});
  gsap.from(".nicht", {y:60, opacity:0, duration:.9, scrollTrigger:{trigger:".nicht", start:"top 90%"}});
  gsap.from(".steps li", {y:70, opacity:0, stagger:.12, duration:.8, scrollTrigger:{trigger:".steps", start:"top 85%"}});
  gsap.from(".k-logo", {scale:.7, rotate:-8, opacity:0, ease:"back.out(2)", duration:1.1, scrollTrigger:{trigger:".kontakt", start:"top 70%"}});
  if (!smoother) gsap.to(".k-float", {y:-60, ease:"none", scrollTrigger:{trigger:".kontakt", start:"top bottom", end:"bottom bottom", scrub:true}});

  /* Anker, auch mit weichem Scrollen */
  document.querySelectorAll('a[href^="#"]').forEach(function(a){
    a.addEventListener("click", function(e){
      var t = document.querySelector(a.getAttribute("href")); if (!t) return; e.preventDefault();
      if (smoother) smoother.scrollTo(t, true, "top top+=" + 60); else t.scrollIntoView({behavior:"smooth"});
    });
  });
  /* Erklärvideo: Overlay mit Player */
  (function(){
    var m = document.getElementById("video"), v = document.getElementById("vid-el");
    function open(e){ if (e) e.preventDefault(); m.hidden = false; v.preload = "auto"; v.play().catch(function(){}); }
    function close(){ v.pause(); m.hidden = true; }
    document.getElementById("vid-open").addEventListener("click", open);
    var nav = document.getElementById("vid-nav"); nav.addEventListener("click", function(e){ e.stopImmediatePropagation(); open(e); }, true);
    document.getElementById("vid-close").addEventListener("click", close);
    m.addEventListener("click", function(e){ if (e.target === m) close(); });
    addEventListener("keydown", function(e){ if (e.key === "Escape" && !m.hidden) close(); });
    if (location.hash === "#video") open();
  })();
  function settle(){ ScrollTrigger.refresh(); }
  Promise.all([].slice.call(document.images).map(function(i){ return i.decode ? i.decode().catch(function(){}) : Promise.resolve(); })).then(settle);
  addEventListener("load", settle);
})();
