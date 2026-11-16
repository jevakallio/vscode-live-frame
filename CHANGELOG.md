# Change Log

## [1.1.0] - 2026-11-16

### Ajouts
- Le skill FRW est maintenant livré nativement avec l'extension pour GitHub Copilot (point de contribution `chatSkills`), sans copie de fichiers dans le workspace
- L'extension déclare le serveur MCP de prévisualisation auprès de VS Code (`mcpServerDefinitionProviders`): les agents compatibles, dont Copilot CLI, peuvent appeler l'outil sans fichier `.mcp.json` dans le workspace
- L'outil de prévisualisation peut être référencé dans un prompt (`#mtess-frw-bacasable_preview`)

### Corrections
- L'outil de prévisualisation fonctionne maintenant depuis Copilot CLI: l'extension s'active au démarrage de VS Code (`onStartupFinished`), l'outil est donc déjà enregistré quand l'agent l'appelle
- Le preview s'ouvre dans un groupe dédié avec `pane: Beside` quand le groupe voisin contient déjà des onglets (il s'ouvrait avant en onglet masqué, sans rendu); un onglet de preview masqué est ramené au premier plan à l'actualisation
- L'actualisation demandée par l'IA (outil de prévisualisation ou serveur MCP) cible maintenant le fichier et la ligne demandés au lieu de l'éditeur actif
- La ligne ciblée place le curseur sur le premier caractère non blanc: le fil d'Ariane ne perd plus son dernier niveau
- Les actualisations simultanées (Ctrl+S, outil IA, déclencheur MCP) sont traitées une à la fois, pour ne jamais créer deux panneaux
- Le déclencheur MCP n'ouvre plus d'éditeur dans le groupe actif (il pouvait recouvrir le preview)

### Retraits
- Le support de Gemini CLI est abandonné: `GEMINI.md` et `.gemini/settings.json` ne sont plus déployés
- `CLAUDE.md` n'est plus déployé: la règle de prévisualisation est déjà dans le skill FRW

### Modifications
- **Changement de comportement**: `mtessFrwBacasable.deployAiSkills` est désormais désactivé par défaut. Le déploiement dans le workspace ne sert plus qu'à Claude Code (`.claude/skills/frw/`, `.mcp.json`, `.claude/settings.json`); l'activer au besoin
- Le skill est déployé dans `.claude/skills/frw/` (minuscules, au lieu de `FRW/`); un ancien dossier `FRW/` doit être supprimé manuellement
- Le serveur MCP de prévisualisation et son fichier de déclenchement passent de `.claude/` à `.mtess/` (`.mtess/mcp/frw-preview.js`); l'ancien `.claude/mcp/` peut être supprimé
- La commande « FRW - Initialiser le workspace pour Claude Code » déploie maintenant même si le paramètre est désactivé

## [1.0.6] - 2026-03-22

### Ajouts
- Déploiement automatique des skills IA pour Claude et Gemini au démarrage de l'extension
- Déploiement du skill FRW (`SKILL.md` et références) dans `.claude/skills/FRW/`
- Déploiement de `CLAUDE.md` et `GEMINI.md` à la racine du workspace
- Configuration automatique de `.gemini/settings.json` avec le serveur MCP
- Nouveau paramètre `mtessFrwBacasable.deployAiSkills` pour désactiver le déploiement automatique des skills IA
- Les skills FRW proviennent désormais d'un sous-module Git externe (`MTESSDev/skills`)

### Modifications
- Corrections diverses de messages et de gestion des erreurs

## [1.0.2]
- Ajout du support de claude AI

## [1.0.0]

- L'extension fonctionne maintenant directement dans le navigateur via **github.dev** et **vscode.dev**, sans installation locale
- Correction d'un problème où le prévisualiseur ne se comportait pas correctement selon vos préférences de configuration
- Amélioration de la stabilité générale de l'extension

## [0.0.4]

- Première version publique
- Correction de la documentation
