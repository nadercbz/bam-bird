/* Bam Bird Website. Technik wie bei der Vorlage: GSAP ScrollSmoother (weiches Scrollen),
   ScrollTrigger mit pin und scrub, Videos werden beim Scrollen vor und zurück gespult,
   Text wird Wort für Wort eingeblendet, Laufschrift und Parallax laufen mit dem Scrollen. */
(function(){
  gsap.registerPlugin(ScrollTrigger, ScrollSmoother);
  var mobile = window.matchMedia("(max-width:820px)").matches;
  var reduce = window.matchMedia("(prefers-reduced-motion:reduce)").matches;
  document.body.classList.add("loading");

  /* ---------- Videos komplett laden (sonst ruckelt das Spulen), mit Fortschritt ---------- */
  var vids = [].slice.call(document.querySelectorAll("video[data-src]"));
  var loaded = vids.map(function(){return 0;}), totals = vids.map(function(){return 1;});
  var bar = document.querySelector(".ld-bar i"), num = document.querySelector(".ld-num span");
  function progress(){
    var a = 0, b = 0;
    for (var i = 0; i < vids.length; i++){ a += loaded[i]; b += totals[i]; }
    var p = Math.min(100, Math.round(a / b * 100));
    bar.style.width = p + "%"; num.textContent = p;
  }
  function loadVideo(v, i){
    var url = v.getAttribute("data-src") + (mobile ? "_m.mp4" : ".mp4");
    return fetch(url).then(function(r){
      if (!r.ok || !r.body) throw new Error("http");
      totals[i] = +r.headers.get("content-length") || 4e6;
      var reader = r.body.getReader(), chunks = [];
      function pump(){
        return reader.read().then(function(res){
          if (res.done) return new Blob(chunks, {type:"video/mp4"});
          chunks.push(res.value); loaded[i] += res.value.length; progress();
          return pump();
        });
      }
      return pump();
    }).then(function(blob){
      v.src = URL.createObjectURL(blob);
      loaded[i] = totals[i]; progress();
      return new Promise(function(res){
        if (v.readyState >= 1) return res();
        v.addEventListener("loadedmetadata", function(){ res(); }, {once:true});
        setTimeout(res, 4000);
      });
    }).catch(function(){
      v.src = url; loaded[i] = totals[i]; progress();
    });
  }
  var timeout = new Promise(function(res){ setTimeout(res, 20000); });
  Promise.race([Promise.all(vids.map(loadVideo)), timeout]).then(start);

  /* Ziel Zeit für ein Video setzen, weich nachgezogen */
  function scrubber(v){
    var target = 0, cur = 0;
    gsap.ticker.add(function(){
      if (!v.duration) return;
      cur += (target - cur) * 0.35;
      if (Math.abs(v.currentTime - cur) > 0.012) { try { v.currentTime = cur; } catch(e){} }
    });
    return function(p){ if (v.duration) target = Math.max(0, Math.min(v.duration - 0.05, p * v.duration)); };
  }

  function start(){
    document.getElementById("loader").classList.add("done");
    document.body.classList.remove("loading");

    if (!reduce) ScrollSmoother.create({ wrapper:"#smooth-wrapper", content:"#smooth-content", smooth:1.2, smoothTouch:0.1, effects:true, normalizeScroll:false });

    /* 1 Hero: Burger dreht sich, Schrift kommt rein */
    gsap.from(".hero-claim h1 span", {yPercent:110, opacity:0, rotate:6, stagger:.12, duration:1, ease:"back.out(1.6)", delay:.35});
    gsap.from(".hero-claim .kicker", {opacity:0, y:10, duration:.8, delay:.2});
    var heroSet = scrubber(document.getElementById("v-hero"));
    ScrollTrigger.create({ trigger:".hero-pin", start:"top top", end:"+=1600", pin:true, scrub:true,
      onUpdate:function(s){ heroSet(s.progress); } });
    gsap.to(".hero-claim", { yPercent:-40, opacity:0, ease:"none",
      scrollTrigger:{ trigger:".hero", start:"top top", end:"+=1400", scrub:true } });

    /* 2 Wort für Wort einblenden (wie SplitType bei der Vorlage) */
    document.querySelectorAll(".reveal").forEach(function(el){
      el.innerHTML = el.textContent.trim().split(/\s+/).map(function(w){ return '<span class="w">' + w + '</span>'; }).join(" ");
      gsap.to(el.querySelectorAll(".w"), { opacity:1, stagger:.1, ease:"none",
        scrollTrigger:{ trigger:el, start:"top 75%", end:"bottom 45%", scrub:true } });
    });
    gsap.from(".statement .big", { xPercent:-12, opacity:0, ease:"none",
      scrollTrigger:{ trigger:".statement", start:"top 90%", end:"top 40%", scrub:true } });

    /* 3 Laufschrift läuft mit dem Scrollen */
    gsap.utils.toArray(".mq").forEach(function(m, i){
      var dir = i % 2 ? 1 : -1;
      gsap.fromTo(m, {xPercent: dir < 0 ? 0 : -30}, {xPercent: dir < 0 ? -30 : 0, ease:"none",
        scrollTrigger:{ trigger:m.parentNode, start:"top bottom", end:"bottom top", scrub:true } });
    });

    /* 4 Burger zerlegt sich, danach erscheinen die Zutaten */
    var exSet = scrubber(document.getElementById("v-explode"));
    var labels = gsap.utils.toArray(".labels li");
    var exTl = gsap.timeline({ scrollTrigger:{ trigger:".ex-pin", start:"top top", end:"+=2600", pin:true, scrub:true,
      onUpdate:function(s){ exSet(Math.min(1, s.progress / .62)); } } });
    exTl.to({}, {duration:.6});
    labels.forEach(function(l, i){
      exTl.fromTo(l, {opacity:0, x: l.classList.contains("r") ? 30 : -30}, {opacity:1, x:0, duration:.06}, .6 + i * .055);
    });
    exTl.to({}, {duration:.1});
    gsap.from(".ex-head > *", { y:40, opacity:0, stagger:.1,
      scrollTrigger:{ trigger:".explode", start:"top 70%", end:"top 20%", scrub:true } });

    /* 5 Stars fahren horizontal durch */
    var track = document.querySelector(".st-track");
    function dist(){ return Math.max(0, track.scrollWidth - window.innerWidth + 40); }
    gsap.to(track, { x:function(){ return -dist(); }, ease:"none",
      scrollTrigger:{ trigger:".st-pin", start:"top top", end:function(){ return "+=" + (dist() + 400); }, pin:true, scrub:true, invalidateOnRefresh:true } });
    gsap.from(".card", { y:80, rotate:4, opacity:0, stagger:.08,
      scrollTrigger:{ trigger:".stars", start:"top 80%", end:"top 20%", scrub:true } });

    /* 6 Box füllt sich */
    var bxSet = scrubber(document.getElementById("v-box"));
    var bxTl = gsap.timeline({ scrollTrigger:{ trigger:".bx-pin", start:"top top", end:"+=2200", pin:true, scrub:true,
      onUpdate:function(s){ bxSet(Math.min(1, s.progress / .8)); } } });
    bxTl.from(".bx-text > *:not(.tag)", {y:40, opacity:0, stagger:.05, duration:.2})
        .to({}, {duration:.5})
        .from(".tag", {scale:0, rotate:-30, duration:.15, ease:"back.out(2)"})
        .to({}, {duration:.15});

    /* 7 und 10 Text, Dips kommen nacheinander */
    gsap.from(".dp-list li", { x:-40, opacity:0, stagger:.08,
      scrollTrigger:{ trigger:".dp-list", start:"top 85%", end:"bottom 60%", scrub:true } });

    /* 8 Parallax in den Laden Bildern */
    gsap.utils.toArray(".pimg img").forEach(function(img){
      gsap.fromTo(img, {yPercent:-8}, {yPercent:8, ease:"none",
        scrollTrigger:{ trigger:img.parentNode, start:"top bottom", end:"bottom top", scrub:true } });
    });
    gsap.utils.toArray(".sto-grid figure").forEach(function(f){
      gsap.from(f, { y:120, opacity:0, ease:"power2.out",
        scrollTrigger:{ trigger:f, start:"top 95%", end:"top 55%", scrub:true } });
    });

    /* 11 Schluss: Logo springt */
    gsap.from(".end-logo", { scale:.6, rotate:-10, opacity:0, ease:"back.out(2)",
      scrollTrigger:{ trigger:".end", start:"top 75%", end:"top 35%", scrub:true } });

    /* Kopfleiste: Links weich scrollen */
    document.querySelectorAll('.bar a[href^="#"]').forEach(function(a){
      a.addEventListener("click", function(e){
        var t = document.querySelector(a.getAttribute("href")); if (!t) return;
        e.preventDefault();
        var sm = ScrollSmoother.get();
        if (sm) sm.scrollTo(t, true, "top top"); else t.scrollIntoView({behavior:"smooth"});
      });
    });

    ScrollTrigger.refresh();
  }
})();
