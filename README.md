# 🧮 Fabrique à Problèmes

Générateur de problèmes de mathématiques CUA pour l'école primaire.  
**Mode hybride : base JSON locale + Gemini API gratuite**

---

## 📁 Structure des fichiers

```
fabrique-problemes/
├── index.html          ← Page principale
├── css/style.css       ← Styles
├── js/app.js           ← Logique
├── data/problems.json  ← 50 problèmes intégrés (PS → CM2)
└── README.md
```

---

## 🚀 Mise en ligne sur GitHub Pages

### 1. Créer un dépôt GitHub
- Connecte-toi sur [github.com](https://github.com)
- Clique **+** → "New repository"
- Nom : `fabrique-problemes`, visibilité : **Public**
- Clique "Create repository"

### 2. Uploader les fichiers
Dans ton dépôt → "uploading an existing file" → glisse tous les fichiers en **respectant les dossiers** (`css/`, `js/`, `data/`) → "Commit changes"

### 3. Activer GitHub Pages
**Settings** → **Pages** → Source : `main` / `/ (root)` → **Save**

Ton site sera accessible sur :  
`https://TON-USERNAME.github.io/fabrique-problemes/`

---

## 🔑 Clé API Gemini (gratuite)

1. Va sur [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Connecte-toi avec Google → "Create API key"
3. Copie la clé (`AIza...`)
4. Dans le site → bouton **⚙ API** → colle la clé → Enregistrer

> ✅ Gemini 2.0 Flash = **1 500 requêtes gratuites/jour**  
> ✅ Clé stockée uniquement dans ton navigateur  
> ✅ Le site fonctionne **sans clé** avec la base JSON uniquement

---

## ⚙️ Logique hybride

```
Tu demandes N problèmes
     ↓
Cherche dans la base locale (JSON + problèmes déjà générés)
     ↓
Assez ?  →  Affiche directement (instantané)
     ↓
Pas assez ?  →  Gemini génère le manquant
              →  Nouveau problème sauvegardé dans le navigateur
              →  La base grossit automatiquement !
```

---

## ✨ Fonctionnalités

- 8 niveaux (PS → CM2), 11 types de problèmes, 3 difficultés
- Code couleur CUA (données rouge / question vert)
- Versions multiples : complet / simplifié / segmenté
- Modèle en barres optionnel
- Export Word (.docx)
- Mode présentation plein écran (raccourcis ← → V Échap)

---

## ⚠️ Limites

- La base générée est **locale au navigateur** de chaque enseignant (pas partagée)
- localStorage limité à ~5 MB (≈ 5 000–10 000 problèmes, largement suffisant)
- Pour partager la base : exporter le contenu du localStorage et l'intégrer dans `data/problems.json`
=======
# Fabrique-probleme

