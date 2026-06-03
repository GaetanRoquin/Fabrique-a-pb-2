/* ===================================
   FABRIQUE À PROBLÈMES - app.js
   Mode hybride : JSON local + Gemini API
   =================================== */

// ─── CONSTANTES ──────────────────────────────────────────────────────────────

const NIVEAUX = {
  PS:  { label: 'Petite Section',     maxNum: 6 },
  MS:  { label: 'Moyenne Section',    maxNum: 12 },
  GS:  { label: 'Grande Section',     maxNum: 30 },
  CP:  { label: 'Cours Préparatoire', maxNum: 100 },
  CE1: { label: 'CE1',                maxNum: 1000 },
  CE2: { label: 'CE2',                maxNum: 10000 },
  CM1: { label: 'CM1',                maxNum: 100000 },
  CM2: { label: 'CM2',                maxNum: 100000000 },
};

const TYPES_LABELS = {
  'parties-tout':               'Parties-tout',
  'transformation':             'Transformation',
  'groupements':                'Groupements',
  'partage-equitable':          'Partage équitable',
  'comparaison-additive':       'Comparaison additive',
  'multiplicatif':              'Multiplicatif',
  'comparaison-multiplicative': 'Comparaison multiplicative',
  'produit-cartesien':          'Produit cartésien',
  'denombrement':               'Dénombrement',
  'optimisation':               'Optimisation',
  'mixte':                      'Mixte (multi-étapes)',
};

const DIFF_LABELS = {
  facile:    '⭐ Facile',
  moyen:     '⭐⭐ Moyen',
  difficile: '⭐⭐⭐ Difficile',
};

const LS_KEY_EXTRA  = 'fabrique_extra_problems';
const LS_KEY_GEMINI = 'fabrique_gemini_key';

// ─── STATE ────────────────────────────────────────────────────────────────────

let baseProblems      = [];
let extraProblems     = [];
let generatedProblems = [];
let selectedProblems  = new Set();
let presIndex         = 0;
let presVersionIndex  = 0;

// ─── DOM REFS ─────────────────────────────────────────────────────────────────

const $ = id => document.getElementById(id);

// ─── INIT ─────────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', async () => {
  await loadBaseProblems();
  loadExtraProblems();
  updateDbStats();
  if (!getGeminiKey()) $('modalApi').classList.remove('hidden');
});

async function loadBaseProblems() {
  try {
    const res  = await fetch('problems.json');
    const data = await res.json();
    baseProblems = data.problems || [];
  } catch (e) {
    console.warn('[DB] Impossible de charger problems.json :', e);
    baseProblems = [];
  }
}

function loadExtraProblems() {
  try {
    const raw = localStorage.getItem(LS_KEY_EXTRA);
    extraProblems = raw ? JSON.parse(raw) : [];
  } catch { extraProblems = []; }
}

function saveExtraProblems() {
  try { localStorage.setItem(LS_KEY_EXTRA, JSON.stringify(extraProblems)); }
  catch (e) { console.warn('[DB] Erreur localStorage :', e); }
}

function updateDbStats() {
  const total = baseProblems.length + extraProblems.length;
  const el = $('dbStats');
  if (el) el.textContent = `Base : ${total} problème(s)  (${baseProblems.length} intégrés + ${extraProblems.length} générés)`;
}

// ─── CLÉS API ─────────────────────────────────────────────────────────────────

function getGeminiKey() { return localStorage.getItem(LS_KEY_GEMINI) || ''; }
function setGeminiKey(k){ localStorage.setItem(LS_KEY_GEMINI, k); }

$('btnSettings').addEventListener('click', () => {
  $('geminiKeyInput').value = getGeminiKey();
  $('modalApi').classList.remove('hidden');
});
$('btnCancelApi').addEventListener('click', () => $('modalApi').classList.add('hidden'));
$('btnSaveApi').addEventListener('click', () => {
  const k = $('geminiKeyInput').value.trim();
  setGeminiKey(k);
  $('modalApi').classList.add('hidden');
  if (!k) showToast('Mode hors-ligne : uniquement la base locale sera utilisée.', 'info');
  else showToast('Clé Gemini enregistrée ✓', 'success');
});

// ─── PILLS ────────────────────────────────────────────────────────────────────

document.querySelectorAll('#classeGroup .pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#classeGroup .pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

document.querySelectorAll('.pill-group.multi .pill').forEach(btn => {
  btn.addEventListener('click', () => btn.classList.toggle('active'));
});

$('btnMinus').addEventListener('click', () => {
  const inp = $('nbProblemes');
  if (+inp.value > 1) inp.value = +inp.value - 1;
});
$('btnPlus').addEventListener('click', () => {
  const inp = $('nbProblemes');
  if (+inp.value < 10) inp.value = +inp.value + 1;
});

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function getSelected(groupId) {
  return [...document.querySelectorAll(`#${groupId} .pill.active`)].map(b => b.dataset.value);
}

function showLoading(text = 'Génération en cours…') {
  $('loadingText').textContent = text;
  $('loadingOverlay').classList.remove('hidden');
}
function hideLoading() { $('loadingOverlay').classList.add('hidden'); }

function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3500);
}

// ─── GÉNÉRATION HYBRIDE ───────────────────────────────────────────────────────

$('btnGenerate').addEventListener('click', generateProblems);
$('btnRegenerate').addEventListener('click', () => {
  $('stepResults').classList.add('hidden');
  generateProblems();
});

async function generateProblems() {
  const classe      = getSelected('classeGroup')[0];
  const types       = getSelected('typeGroup');
  const difficultes = getSelected('diffGroup');
  const nb          = parseInt($('nbProblemes').value);

  if (!classe)           { showToast('Veuillez sélectionner un niveau.', 'error'); return; }
  if (!types.length)     { showToast('Veuillez sélectionner au moins un type.', 'error'); return; }
  if (!difficultes.length){ showToast('Veuillez sélectionner au moins une difficulté.', 'error'); return; }

  const opts = {
    cuaCodeCouleur:  $('optCodeCouleur').checked,
    cuaVersionsMult: $('optVersionsMultiples').checked,
    cuaModelisation: $('optModelisation').checked,
    cuaVieReelle:    $('optVieReelle').checked,
  };

  showLoading('Recherche dans la base locale…');

  // 1. Piocher dans la base locale (JSON + extras)
  const allProblems = [...baseProblems, ...extraProblems];
  const pool = allProblems
    .filter(p => p.classe === classe && types.includes(p.type) && difficultes.includes(p.difficulte))
    .sort(() => Math.random() - 0.5);

  const fromBase = pool.slice(0, nb);
  const needed   = nb - fromBase.length;
  let results    = [...fromBase];

  // 2. Compléter avec Gemini si besoin
  if (needed > 0) {
    const geminiKey = getGeminiKey();
    if (!geminiKey) {
      showToast(`${fromBase.length}/${nb} problèmes trouvés. Ajoutez une clé Gemini pour en générer plus.`, 'info');
    } else {
      $('loadingText').textContent = `Génération de ${needed} problème(s) via Gemini…`;
      try {
        const generated = await generateWithGemini({ classe, types, difficultes, nb: needed, niveauInfo: NIVEAUX[classe], ...opts });
        const tagged = generated.map((p, i) => ({ ...p, id: `gemini_${Date.now()}_${i}`, classe, source: 'gemini' }));

        extraProblems.push(...tagged);
        saveExtraProblems();
        updateDbStats();
        if (tagged.length < needed) {
          showToast(`⚠️ Gemini n'a retourné que ${tagged.length}/${needed} problème(s). Réessayez ou réduisez le nombre demandé.`, 'info');
        } else {
          showToast(`✓ ${tagged.length} nouveau(x) problème(s) sauvegardé(s) dans votre base !`, 'success');
        }
        results = [...results, ...tagged];
      } catch (err) {
        console.error('[Gemini]', err);
        showToast(`Erreur Gemini : ${err.message}`, 'error');
      }
    }
  }

  hideLoading();

  if (!results.length) {
    showToast('Aucun problème trouvé. Modifiez vos critères ou ajoutez une clé Gemini.', 'error');
    return;
  }

  generatedProblems = results.slice(0, nb);
  selectedProblems  = new Set(generatedProblems.map((_, i) => i));
  renderProblems();
  $('stepResults').classList.remove('hidden');
  $('stepResults').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── GEMINI API ───────────────────────────────────────────────────────────────

async function generateWithGemini({ classe, types, difficultes, nb, niveauInfo,
                                     cuaCodeCouleur, cuaVersionsMult, cuaModelisation, cuaVieReelle }) {
  const key      = getGeminiKey();
  const typesStr = types.map(t => TYPES_LABELS[t] || t).join(', ');
  const diffStr  = difficultes.map(d => DIFF_LABELS[d] || d).join(', ');

  const prompt = `Tu es un expert en didactique des mathématiques à l'école primaire (CUA).

Génère exactement ${nb} problème(s) pour : ${niveauInfo.label} (${classe}).
Nombres ≤ ${niveauInfo.maxNum.toLocaleString('fr-FR')}.
Types : ${typesStr}. Difficultés : ${diffStr}.
${cuaVieReelle ? 'Contextes de vie réelle variés (achats, sport, nature, cuisine, école...).' : ''}
${difficultes.includes('difficile') ? 'Niveau difficile = données parasites + plusieurs étapes.' : ''}

Réponds UNIQUEMENT en JSON valide (tableau), sans texte avant ni après :

[
  {
    "type": "parties-tout",
    "difficulte": "facile",
    "versions": {
      "long": "Énoncé${cuaCodeCouleur ? '. Données dans <span class=\\"data\\">valeur</span>, question dans <span class=\\"question\\">question</span>' : ''}",
      "simplifie": "${cuaVersionsMult ? 'Version courte avec même balisage.' : ''}",
      "segmente": "${cuaVersionsMult ? '[{\\"type\\":\\"contexte\\",\\"text\\":\\"...\\"},{...}]' : ''}"
    }${cuaModelisation ? ',\n    "modele_barres": {"description":"...","barres":[{"label":"Total","valeur":0,"type":"total"}]}' : ''}
  }
]`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.9, maxOutputTokens: 8192 },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }

  const data = await res.json();
  const raw  = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return parseProblems(raw);
}

// ─── PARSER ──────────────────────────────────────────────────────────────────

function parseProblems(raw) {
  const clean = raw.replace(/```json|```/g, '').trim();
  try {
    const arr = JSON.parse(clean);
    return Array.isArray(arr) ? arr : [];
  } catch {
    const match = clean.match(/\[[\s\S]*\]/);
    if (match) { try { return JSON.parse(match[0]); } catch {} }
    return [];
  }
}

// ─── RENDER PROBLEMS ─────────────────────────────────────────────────────────

function renderProblems() {
  const list = $('problemsList');
  list.innerHTML = '';
  generatedProblems.forEach((prob, idx) => list.appendChild(buildCard(prob, idx)));
  updateSelectionCount();
}

function buildCard(prob, idx) {
  const div = document.createElement('div');
  div.className = 'problem-card' + (selectedProblems.has(idx) ? ' selected' : '');
  div.dataset.index = idx;

  const typeLabel = TYPES_LABELS[prob.type] || prob.type || 'Mixte';
  const diffLabel = DIFF_LABELS[prob.difficulte] || prob.difficulte || '';
  const diffClass = `tag-diff-${prob.difficulte || 'moyen'}`;
  const srcTag    = prob.source === 'gemini' ? '<span class="tag tag-gemini">✨ Gemini</span>' : '<span class="tag tag-base">📚 Base</span>';

  const hasSimp  = prob.versions?.simplifie && prob.versions.simplifie !== '';
  const hasSeg   = prob.versions?.segmente  && prob.versions.segmente  !== '';
  const hasBarre = !!prob.modele_barres;

  div.innerHTML = `
    <div class="card-header">
      <div class="card-meta">
        <span class="card-num">#${idx + 1}</span>
        <div class="card-tags">
          <span class="tag tag-type">${typeLabel}</span>
          <span class="tag ${diffClass}">${diffLabel}</span>
          ${srcTag}
        </div>
      </div>
      <button class="card-select-btn" data-idx="${idx}">${selectedProblems.has(idx) ? '✓ Sélectionné' : 'Sélectionner'}</button>
    </div>
    <div class="card-body">
      ${(hasSimp || hasSeg) ? `<div class="version-tabs">
        <button class="vtab active" data-ver="long">Texte complet</button>
        ${hasSimp ? '<button class="vtab" data-ver="simplifie">Simplifié</button>' : ''}
        ${hasSeg  ? '<button class="vtab" data-ver="segmente">Segmenté</button>'  : ''}
      </div>` : ''}
      <div class="problem-text" id="prob-text-${idx}">${renderVersion(prob, 'long')}</div>
      ${hasBarre ? renderBarModel(prob.modele_barres) : ''}
      <div class="cua-legend">
        <span class="legend-item"><span class="legend-dot" style="background:var(--cua-data)"></span>Données</span>
        <span class="legend-item"><span class="legend-dot" style="background:var(--cua-question)"></span>Question</span>
      </div>
    </div>`;

  div.querySelector('.card-select-btn').addEventListener('click', e => { e.stopPropagation(); toggleSelect(idx); });
  div.querySelectorAll('.vtab').forEach(tab => {
    tab.addEventListener('click', () => {
      div.querySelectorAll('.vtab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      $(`prob-text-${idx}`).innerHTML = renderVersion(prob, tab.dataset.ver);
    });
  });
  return div;
}

function renderVersion(prob, ver) {
  if (ver === 'segmente' && prob.versions?.segmente) {
    let segs = prob.versions.segmente;
    if (typeof segs === 'string') { try { segs = JSON.parse(segs); } catch { return prob.versions.long || ''; } }
    if (Array.isArray(segs)) return `<div class="problem-text-segmented">${segs.map(s => `<p class="segment-${s.type||''}">${s.text||''}</p>`).join('')}</div>`;
  }
  const txt = ver === 'simplifie' ? prob.versions?.simplifie : prob.versions?.long;
  return `<p class="problem-text">${txt || prob.versions?.long || ''}</p>`;
}

function renderBarModel(model) {
  if (!model?.barres) return '';
  const max = Math.max(...model.barres.map(b => b.valeur || 1), 1);
  return `<div class="bar-model"><div class="bar-model-title">📊 Modèle en barres</div><div class="bars-container">${
    model.barres.map(b => {
      const pct = Math.max(15, Math.round((b.valeur / max) * 100));
      return `<div class="bar-row"><span class="bar-label">${b.label}</span><div class="bar-fill bar-${b.type||'part1'}" style="width:${pct}%">${b.valeur === 0 ? '?' : b.valeur.toLocaleString('fr-FR')}</div></div>`;
    }).join('')
  }</div></div>`;
}

function toggleSelect(idx) {
  if (selectedProblems.has(idx)) selectedProblems.delete(idx); else selectedProblems.add(idx);
  const card = document.querySelector(`.problem-card[data-index="${idx}"]`);
  if (!card) return;
  card.classList.toggle('selected', selectedProblems.has(idx));
  card.querySelector('.card-select-btn').textContent = selectedProblems.has(idx) ? '✓ Sélectionné' : 'Sélectionner';
  updateSelectionCount();
}

function updateSelectionCount() {
  $('selectionCount').textContent = `${selectedProblems.size} sélectionné(s)`;
}

// ─── EXPORT WORD ─────────────────────────────────────────────────────────────

$('btnExportWord').addEventListener('click', exportWord);

async function exportWord() {
  if (!selectedProblems.size) { showToast('Sélectionnez au moins un problème.', 'error'); return; }
  
  // Vérifier que docx a bien chargé
  if (!window.docx) {
    showToast('❌ Erreur : la libraire Word n\'a pas pu charger. Rechargez la page et réessayez.', 'error');
    console.error('[EXPORT] docx est undefined');
    return;
  }

  try {
    const { Document, Paragraph, TextRun, HeadingLevel, Packer, AlignmentType } = window.docx;
    
    // Fallback si les classes ne sont pas disponibles
    if (!Document || !Paragraph || !Packer) {
      throw new Error('Classes docx manquantes. Rechargez la page.');
    }

    const children = [];
    const stripHtml = h => h.replace(/<[^>]+>/g, '');

    // Titre
    children.push(new Paragraph({
      text: 'Problèmes de Mathématiques',
      heading: HeadingLevel?.HEADING_1 || undefined,
      alignment: AlignmentType?.CENTER || undefined
    }));
    children.push(new Paragraph({ text: '' }));

    // Chaque problème sélectionné
    [...selectedProblems].sort((a, b) => a - b).forEach((idx, i) => {
      const prob = generatedProblems[idx];
      if (!prob) return;

      // En-tête du problème
      children.push(new Paragraph({
        children: [new TextRun({
          text: `Problème ${i + 1} — ${TYPES_LABELS[prob.type] || prob.type} — ${DIFF_LABELS[prob.difficulte] || ''}`,
          bold: true,
          size: 26
        })]
      }));
      children.push(new Paragraph({ text: '' }));

      // Texte principal
      const mainText = prob.versions?.long || prob.enonce || '';
      children.push(new Paragraph({
        text: stripHtml(mainText),
        spacing: { line: 360 }
      }));
      children.push(new Paragraph({ text: '' }));

      // Version simplifiée si elle existe
      if (prob.versions?.simplifie) {
        children.push(new Paragraph({
          children: [new TextRun({
            text: '📖 Version simplifiée :',
            bold: true,
            size: 22
          })]
        }));
        children.push(new Paragraph({
          text: stripHtml(prob.versions.simplifie),
          spacing: { line: 320 }
        }));
        children.push(new Paragraph({ text: '' }));
      }

      // Séparateur
      children.push(new Paragraph({
        border: {
          bottom: {
            color: 'CCCCCC',
            space: 1,
            value: 'single',
            size: 6
          }
        }
      }));
      children.push(new Paragraph({ text: '' }));
    });

    // Créer et télécharger le document
    const doc = new Document({ sections: [{ children }] });
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `problemes_maths_${new Date().toISOString().slice(0, 10)}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`✓ Export réussi ! ${selectedProblems.size} problème(s) exporté(s)`, 'success');
  } catch (error) {
    console.error('[EXPORT] Erreur lors de l\'export Word :', error);
    showToast(`❌ Erreur lors de l\'export : ${error.message || 'Erreur inconnue'}. Rechargez la page et réessayez.`, 'error');
  }
}

// ─── MODE PRÉSENTATION ───────────────────────────────────────────────────────

$('btnPresentation').addEventListener('click', openPresentation);
$('presClose').addEventListener('click', closePresentation);
$('presNext').addEventListener('click', () => navigatePres(1));
$('presPrev').addEventListener('click', () => navigatePres(-1));
$('presVersion').addEventListener('click', cyclePresVersion);
$('presFullscreen').addEventListener('click', () => {
  if (!document.fullscreenElement) $('presentationMode').requestFullscreen?.();
  else document.exitFullscreen?.();
});

document.addEventListener('keydown', e => {
  if ($('presentationMode').classList.contains('hidden')) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') navigatePres(1);
  if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')  navigatePres(-1);
  if (e.key === 'Escape') closePresentation();
  if (e.key === 'v')      cyclePresVersion();
});

function openPresentation() {
  if (!selectedProblems.size) { showToast('Sélectionnez au moins un problème.', 'error'); return; }
  presIndex = 0; presVersionIndex = 0;
  $('presentationMode').classList.remove('hidden');
  renderSlide();
}

function closePresentation() {
  $('presentationMode').classList.add('hidden');
  if (document.fullscreenElement) document.exitFullscreen?.();
}

function navigatePres(dir) {
  const arr = [...selectedProblems].sort((a, b) => a - b);
  presIndex = Math.max(0, Math.min(arr.length - 1, presIndex + dir));
  presVersionIndex = 0;
  renderSlide();
}

function cyclePresVersion() {
  const arr  = [...selectedProblems].sort((a, b) => a - b);
  const vers = getAvailableVersions(generatedProblems[arr[presIndex]]);
  presVersionIndex = (presVersionIndex + 1) % vers.length;
  renderSlide();
}

function getAvailableVersions(prob) {
  const v = ['long'];
  if (prob.versions?.simplifie) v.push('simplifie');
  if (prob.versions?.segmente)  v.push('segmente');
  return v;
}

const VER_LABELS = { long: 'Texte complet', simplifie: 'Simplifié', segmente: 'Segmenté' };

function renderSlide() {
  const arr  = [...selectedProblems].sort((a, b) => a - b);
  const prob = generatedProblems[arr[presIndex]];
  const vers = getAvailableVersions(prob);
  const ver  = vers[presVersionIndex] || 'long';

  $('presCounter').textContent = `${presIndex + 1} / ${arr.length}`;
  $('presVersion').textContent = `📖 ${VER_LABELS[ver]}`;

  $('presSlide').innerHTML = `
    <div class="slide-content">
      <div class="slide-meta">
        <span class="tag tag-type">${TYPES_LABELS[prob.type] || prob.type}</span>
        <span class="tag tag-diff-${prob.difficulte || 'moyen'}">${DIFF_LABELS[prob.difficulte] || ''}</span>
        ${vers.length > 1 ? `<span class="tag" style="background:#f0f0f0;color:#666">${VER_LABELS[ver]}</span>` : ''}
      </div>
      <div class="slide-problem">${renderVersion(prob, ver)}</div>
      ${prob.modele_barres ? renderBarModel(prob.modele_barres) : ''}
      <div class="cua-legend">
        <span class="legend-item"><span class="legend-dot" style="background:var(--cua-data)"></span>Données</span>
        <span class="legend-item"><span class="legend-dot" style="background:var(--cua-question)"></span>Question</span>
      </div>
    </div>`;
}

// ─── GESTION BASE LOCALE ─────────────────────────────────────────────────────

document.getElementById('btnClearExtra')?.addEventListener('click', () => {
  if (!extraProblems.length) { showToast('La base Gemini est déjà vide.', 'info'); return; }
  if (confirm(`Supprimer les ${extraProblems.length} problèmes générés par Gemini ?`)) {
    extraProblems = [];
    saveExtraProblems();
    updateDbStats();
    showToast('Base Gemini réinitialisée.', 'info');
  }
});