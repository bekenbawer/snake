
"use strict";
// ================== Réglages ==================
const CASES = 24;                 // grille de 24 x 24
const TAILLE = 576 / CASES;       // taille d’une case en pixels
const RANGS = [                   // titre selon la longueur du serpent
  [0, "Petit serpent"], [8, "Couleuvre"], [15, "Vipère"],
  [25, "Python"], [40, "Anaconda"], [60, "Serpent géant"]
];

// ================== Éléments de la page ==================
const canvas = document.getElementById("jeu");
const ctx = canvas.getContext("2d");
const el = id => document.getElementById(id);
const voile = el("voile");

// ================== État du jeu ==================
let serpent, direction, file, nourriture, score, aGrandir, bosses, particules;
let etat = "accueil";             // accueil | jeu | pause | fin
let delai = 130, cumul = 0, dernierTemps = 0;
let record = 0;
try { record = Number(localStorage.getItem("snake-record")) || 0; } catch (e) {}
el("record").textContent = record;

function initialiser() {
  serpent = [{ x: 12, y: 12 }, { x: 11, y: 12 }, { x: 10, y: 12 }];
  direction = { x: 1, y: 0 };
  file = [];                      // file d’attente des changements de direction
  score = 0;
  aGrandir = 0;                   // segments encore à ajouter
  bosses = [];                    // “bosses” de nourriture qui descendent le long du corps
  particules = [];
  delai = 130;
  cumul = 0;
  nourriture = nouvelleNourriture(false);
  majHud();
}

// ================== Nourriture ==================
function caseLibre() {
  let c;
  do {
    c = { x: Math.floor(Math.random() * CASES), y: Math.floor(Math.random() * CASES) };
  } while (serpent.some(s => s.x === c.x && s.y === c.y));
  return c;
}

function nouvelleNourriture(peutEtreDoree) {
  const doree = peutEtreDoree && Math.random() < 0.15;
  return Object.assign(caseLibre(), doree
    ? { doree: true, croissance: 3, valeur: 50, duree: 55 }   // disparaît après 55 tours
    : { doree: false, croissance: 1, valeur: 10, duree: Infinity });
}

// ================== Un tour de jeu ==================
function tour() {
  if (file.length) direction = file.shift();
  const tete = { x: serpent[0].x + direction.x, y: serpent[0].y + direction.y };
  const mange = tete.x === nourriture.x && tete.y === nourriture.y;
  const grandit = mange || aGrandir > 0;

  // La queue libère sa case sauf si le serpent grandit
  const corps = grandit ? serpent : serpent.slice(0, -1);
  const mur = tete.x < 0 || tete.y < 0 || tete.x >= CASES || tete.y >= CASES;
  if (mur || corps.some(s => s.x === tete.x && s.y === tete.y)) return finDePartie();

  serpent.unshift(tete);
  bosses = bosses.map(i => i + 1).filter(i => i < serpent.length);

  if (mange) {
    score += nourriture.valeur;
    aGrandir += nourriture.croissance - 1;   // -1 : ce tour-ci compte déjà
    bosses.push(0);
    eclabousser(tete, nourriture.doree ? "#ffd166" : "#ff6b6b");
    bip(nourriture.doree ? 880 : 520, 0.12);
    nourriture = nouvelleNourriture(true);
    // Plus le serpent est long, plus il va vite (limite à 70 ms)
    delai = Math.max(70, 130 - (serpent.length - 3) * 1.5);
  } else {
    if (aGrandir > 0) aGrandir--; else serpent.pop();
    if (--nourriture.duree <= 0) nourriture = nouvelleNourriture(false);
  }
  majHud();
}

function rangActuel() {
  let titre = RANGS[0][1];
  for (const [min, nom] of RANGS) if (serpent.length >= min) titre = nom;
  return titre;
}

function majHud() {
  el("score").textContent = score;
  el("longueur").textContent = serpent.length;
  el("rang").textContent = rangActuel();
}

// ================== États : démarrer, pause, fin ==================
function montrerVoile(titre, texte, bouton) {
  el("voileTitre").textContent = titre;
  el("voileTexte").textContent = texte;
  el("bouton").textContent = bouton;
  voile.classList.remove("cache");
}

function demarrer() {
  initialiser();
  etat = "jeu";
  voile.classList.add("cache");
}

function pause() {
  if (etat === "jeu") { etat = "pause"; montrerVoile("Pause", "Appuie sur Espace pour reprendre.", "Reprendre"); }
  else if (etat === "pause") { etat = "jeu"; voile.classList.add("cache"); }
}

function finDePartie() {
  etat = "fin";
  bip(160, 0.4, "sawtooth");
  if (score > record) {
    record = score;
    el("record").textContent = record;
    try { localStorage.setItem("snake-record", record); } catch (e) {}
  }
  montrerVoile("Perdu !", "Longueur " + serpent.length + " (" + rangActuel() + ") · Score " + score, "Rejouer");
}

// ================== Dessin ==================
function dessiner(temps) {
  // Fond en damier discret
  for (let y = 0; y < CASES; y++) for (let x = 0; x < CASES; x++) {
    ctx.fillStyle = (x + y) % 2 ? "#142225" : "#17282b";
    ctx.fillRect(x * TAILLE, y * TAILLE, TAILLE, TAILLE);
  }
  dessinerNourriture(temps);
  dessinerSerpent();
  dessinerParticules();
}

function centre(c) { return { x: (c.x + 0.5) * TAILLE, y: (c.y + 0.5) * TAILLE }; }

function dessinerNourriture(temps) {
  const p = centre(nourriture);
  const pulse = 1 + Math.sin(temps / 180) * 0.08;
  const r = TAILLE * 0.36 * pulse;
  if (nourriture.doree) {
    ctx.shadowColor = "#ffd166";
    ctx.shadowBlur = 18;
  }
  ctx.fillStyle = nourriture.doree ? "#ffd166" : "#ef5350";
  ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#6bbf59";                       // petite feuille
  ctx.beginPath(); ctx.ellipse(p.x + 3, p.y - r, 4, 2, -0.6, 0, Math.PI * 2); ctx.fill();
}

function dessinerSerpent() {
  const n = serpent.length;
  const rond = (x, y, r, i) => {
    const t = i / Math.max(n - 1, 1);              // 0 = tête, 1 = queue
    ctx.fillStyle = "hsl(" + (150 + t * 40) + "," + (70 - t * 10) + "%," + (56 - t * 20) + "%)";
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  };
  for (let i = n - 1; i >= 0; i--) {
    const p = centre(serpent[i]);
    const t = i / Math.max(n - 1, 1);
    let r = TAILLE * (0.46 - t * 0.12);            // le corps s’affine vers la queue
    if (bosses.includes(i)) r *= 1.28;             // la nourriture gonfle le corps
    if (i < n - 1) {                               // pont entre deux segments : corps continu
      const q = centre(serpent[i + 1]);
      rond((p.x + q.x) / 2, (p.y + q.y) / 2, r * 0.97, i);
    }
    rond(p.x, p.y, r, i);
  }
  // Yeux, orientés dans le sens du déplacement
  const h = centre(serpent[0]);
  const dx = direction.x, dy = direction.y;
  for (const cote of [-1, 1]) {
    const ex = h.x + dx * 5 - dy * cote * 6;
    const ey = h.y + dy * 5 + dx * cote * 6;
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(ex, ey, 3.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(ex + dx * 1.2, ey + dy * 1.2, 1.8, 0, Math.PI * 2); ctx.fill();
  }
}

// ================== Particules ==================
function eclabousser(case_, couleur) {
  const p = centre(case_);
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 90;
    particules.push({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vie: 1, couleur });
  }
}
function dessinerParticules() {
  for (const p of particules) {
    ctx.globalAlpha = Math.max(p.vie, 0);
    ctx.fillStyle = p.couleur;
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
}

// ================== Boucle principale ==================
function boucle(temps) {
  const dt = Math.min(temps - dernierTemps, 100);  // évite les sauts après un changement d’onglet
  dernierTemps = temps;
  if (etat === "jeu") {
    cumul += dt;
    while (cumul >= delai && etat === "jeu") { cumul -= delai; tour(); }
  }
  for (const p of particules) { p.x += p.vx * dt / 1000; p.y += p.vy * dt / 1000; p.vie -= dt / 500; }
  particules = particules.filter(p => p.vie > 0);
  dessiner(temps);
  requestAnimationFrame(boucle);
}

// ================== Sons ==================
let audio = null, sonActif = true;
function bip(freq, duree, type) {
  if (!sonActif) return;
  try {
    audio = audio || new AudioContext();
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = type || "sine"; o.frequency.value = freq;
    g.gain.setValueAtTime(0.12, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duree);
    o.connect(g); g.connect(audio.destination);
    o.start(); o.stop(audio.currentTime + duree);
  } catch (e) {}
}
el("son").addEventListener("click", e => {
  sonActif = !sonActif;
  e.target.textContent = "Son : " + (sonActif ? "oui" : "non");
  e.target.setAttribute("aria-pressed", sonActif);
});

// ================== Commandes ==================
function tourner(x, y) {
  if (etat === "accueil" || etat === "fin") return;
  // On compare avec la dernière direction prévue pour interdire le demi-tour
  const derniere = file.length ? file[file.length - 1] : direction;
  if ((x === -derniere.x && y === -derniere.y) || (x === derniere.x && y === derniere.y)) return;
  if (file.length < 2) file.push({ x, y });
}

const touches = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  w: [0, -1], z: [0, -1], s: [0, 1], a: [-1, 0], q: [-1, 0], d: [1, 0]
};
document.addEventListener("keydown", e => {
  if (e.key === " ") { e.preventDefault(); return (etat === "jeu" || etat === "pause") ? pause() : demarrer(); }
  const t = touches[e.key] || touches[e.key.toLowerCase()];
  if (!t) return;
  e.preventDefault();
  if (etat === "accueil" || etat === "fin") demarrer();
  else if (etat === "jeu") tourner(t[0], t[1]);
});

let depart = null;
canvas.addEventListener("touchstart", e => { depart = e.touches[0]; });
canvas.addEventListener("touchend", e => {
  if (!depart || etat !== "jeu") return;
  const dx = e.changedTouches[0].clientX - depart.clientX;
  const dy = e.changedTouches[0].clientY - depart.clientY;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
  if (Math.abs(dx) > Math.abs(dy)) tourner(dx > 0 ? 1 : -1, 0); else tourner(0, dy > 0 ? 1 : -1);
});

el("bouton").addEventListener("click", () => (etat === "pause" ? pause() : demarrer()));
document.addEventListener("visibilitychange", () => { if (document.hidden && etat === "jeu") pause(); });

initialiser();
requestAnimationFrame(boucle);