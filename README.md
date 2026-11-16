<p align="center"><img src="https://raw.githubusercontent.com/MTESSDev/vscode-mtess-frw-bacasable/refs/heads/master/docs/icon-400.png" width=200></p>
<h1 align="center">MTESS Bac à sable des formulaires</h1>
<p align="center">
<strong>Testez votre configuration des formulaires <i>dans</i> VS Code.</strong>
<br><br>

## Comment s'en servir

L'extension est disponible dans **VS Code desktop** ainsi que directement dans le navigateur via **[github.dev](https://github.dev)** et **[vscode.dev](https://vscode.dev)**, sans installation locale.

1. Installez **MTESS Formulaires bac a sable** à partir de [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=MTESS.vscode-mtess-frw-bacasable).
2. Ouvrez un fichier YAML avec un nom terminant par **.form.yml**
3. Faites (`F1`) ou (`Cmd`+`Shift`+`P`) et tapez `bac à sable` pour ouvrir la fenêtre, ou faites (`Ctrl`+`S`) pour enregistrer et prévisualiser.
4. Suivez les [instructions de configuration](#paramètres-de-lextension).

### Paramètres de l'extension

Ajouter ces configuration dans le fichier de configuration de votre VS code ou via les paramètres dans les préférences.

```js
{
  // Requis: Url du service de rendu
  "mtessFrwBacasable.url": "https://formulaires.it.mtess.gouv.qc.ca/form/700000/render",

  // Optionnel: Emplacement d'ouverture du panneau de preview
  "mtessFrwBacasable.pane": "Beside",

  // Optionnel: Déploiement des skills IA pour Claude Code (défaut: false)
  "mtessFrwBacasable.deployAiSkills": false
}
```

### Intégration avec les assistants IA

#### GitHub Copilot — intégré, rien à faire

Le skill **FRW** (génération et validation des fichiers `*.form.yml`, `*.bind.yml` et `*.transmission.yml`) est livré directement avec l'extension grâce au point de contribution `chatSkills` de VS Code. Dès l'installation, il est disponible dans le chat de Copilot : aucun fichier n'est ajouté à votre workspace et le skill se met à jour avec l'extension.

#### Claude Code — sur demande

Claude Code ne lit pas les skills fournis par une extension VS Code (il cherche dans `.claude/skills/`). Pour lui, l'extension peut copier le skill FRW dans votre workspace :

- **`.claude/skills/frw/`** — le skill FRW et ses références
- **`.mcp.json`** et **`.mtess/mcp/`** — l'outil de prévisualisation (serveur MCP), pour que Claude Code puisse afficher le rendu du formulaire
- **`.claude/settings.json`** — autorisation de l'outil de prévisualisation, pour éviter une demande de permission à chaque appel

Ce déploiement est **désactivé par défaut**. Deux façons de le faire :

- activer le paramètre `mtessFrwBacasable.deployAiSkills` pour un déploiement automatique à l'ouverture du workspace;
- ou lancer ponctuellement la commande **FRW - Initialiser le workspace pour Claude Code**.

Les fichiers existants (`.mcp.json`, `.claude/settings.json`) sont complétés, jamais remplacés.

#### Outil de prévisualisation

L'extension expose également un **outil de langage** (`mtess-frw-bacasable_preview`) compatible avec tout assistant IA supportant l'API Language Model Tools de VS Code (Claude, GitHub Copilot, etc.) : l'assistant peut déclencher lui-même la prévisualisation dans le bac à sable après avoir modifié un formulaire.

L'extension déclare aussi cet outil comme **serveur MCP** auprès de VS Code (`FRW bac à sable`), ce qui le rend disponible aux agents qui passent par MCP (par exemple Copilot CLI) sans aucun fichier dans le workspace.

### Outils de developpement

Si quelque chose cloche, il est possible d'ouvrir le panneau de développement de Chrome avec (`Cmd`+`Shift`+`P`) et voir la console.

### Développement local (pour les développeurs au MESS seulement)

Installez les dépendances avec `yarn`, puis démarrez le projet en debug `Run > Start Debugging` dans VS Code.

## License

[MIT](LICENSE)

## Crédits

Icons made by (https://www.freepik.com) from (https://www.flaticon.com)
