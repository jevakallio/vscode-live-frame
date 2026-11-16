import * as vscode from "vscode";
import { renderHost, renderPlaceholder } from "./host";
import { getColumnFromPane } from "./pane";
import skillContent from '../skills-externe/frw/SKILL.md';
import refForm from '../skills-externe/frw/references/form.md';
import refBind from '../skills-externe/frw/references/bind.md';
import refTransmission from '../skills-externe/frw/references/transmission.md';

const REFERENCES: Record<string, string> = {
  'references/form.md': refForm,
  'references/bind.md': refBind,
  'references/transmission.md': refTransmission,
};

async function deploySkill(extensionUri: vscode.Uri) {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) { return; }

  const rootUri = folders[0].uri;
  const skillsDir = vscode.Uri.joinPath(rootUri, '.claude', 'skills');

  const write = async (name: string, content: string) => {
    const uri = vscode.Uri.joinPath(skillsDir, name);
    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
  };

  await write('frw/SKILL.md', skillContent);

  for (const [name, content] of Object.entries(REFERENCES)) {
    await write(`frw/${name}`, content);
  }

  // Deploy the MCP server script
  const mcpSourceUri = vscode.Uri.joinPath(extensionUri, 'out', 'mcp-server.js');
  const mcpTargetUri = vscode.Uri.joinPath(rootUri, '.mtess', 'mcp', 'frw-preview.js');
  try {
    const mcpBytes = await vscode.workspace.fs.readFile(mcpSourceUri);
    await vscode.workspace.fs.writeFile(mcpTargetUri, mcpBytes);
  } catch (err: any) {
    console.warn('FRW: impossible de déployer le serveur MCP:', err.message);
  }

  // Configure .mcp.json at workspace root (read by Claude Code and GitHub Copilot)
  const mcpJsonUri = vscode.Uri.joinPath(rootUri, '.mcp.json');
  let mcpConfig: any = {};
  try {
    const existing = await vscode.workspace.fs.readFile(mcpJsonUri);
    mcpConfig = JSON.parse(new TextDecoder().decode(existing));
  } catch {
    // File doesn't exist or isn't valid JSON — start fresh
  }

  if (!mcpConfig.mcpServers) { mcpConfig.mcpServers = {}; }
  mcpConfig.mcpServers['frw-bacasable'] = {
    command: 'node',
    args: ['.mtess/mcp/frw-preview.js'],
  };

  await vscode.workspace.fs.writeFile(
    mcpJsonUri,
    new TextEncoder().encode(JSON.stringify(mcpConfig, null, 2))
  );

  // Auto-allow the MCP tool in .claude/settings.json so Claude doesn't ask permission
  const settingsUri = vscode.Uri.joinPath(rootUri, '.claude', 'settings.json');
  let settings: any = {};
  try {
    const existing = await vscode.workspace.fs.readFile(settingsUri);
    settings = JSON.parse(new TextDecoder().decode(existing));
  } catch {
    // File doesn't exist or isn't valid JSON — start fresh
  }

  if (!settings.permissions) { settings.permissions = {}; }
  if (!Array.isArray(settings.permissions.allow)) { settings.permissions.allow = []; }

  const mcpPermission = 'mcp__frw-bacasable__preview';
  if (!settings.permissions.allow.includes(mcpPermission)) {
    settings.permissions.allow.push(mcpPermission);
  }

  await vscode.workspace.fs.writeFile(
    settingsUri,
    new TextEncoder().encode(JSON.stringify(settings, null, 2))
  );
}


function* iterateSymbols(symbols: vscode.DocumentSymbol[], selection: any): Iterable<vscode.DocumentSymbol> {
  for (const symbol of symbols) {
    if (symbol.range.contains(selection)) {
      yield symbol;
      yield* iterateSymbols(symbol.children, selection);
    }
  }
}

export function activate(context: vscode.ExtensionContext) {
  let currentPanel: vscode.WebviewPanel | undefined;
  let lastBreadcrumb = '';

  interface OpenArgs {
    /** Fichier .form.yml à prévisualiser (sinon: éditeur actif, puis premier .form.yml visible). */
    filePath?: string;
    /** Ligne (1-based) à cibler pour le fil d'Ariane. */
    line?: number;
  }

  /**
   * Position sur la ligne (1-based) au premier caractère non blanc. En colonne 0, la position
   * est avant le début du symbole YAML de la ligne et le fil d'Ariane perd son dernier niveau.
   */
  const positionForLine = (doc: vscode.TextDocument, line: number): vscode.Position => {
    const idx = Math.min(Math.max(0, line - 1), Math.max(0, doc.lineCount - 1));
    // Le symbole d'un élément de liste YAML commence après « - »: viser le « - » lui-même fait perdre un niveau.
    const text = doc.lineAt(idx).text;
    const col = /^\s*(?:-\s+)*/.exec(text)?.[0].length ?? 0;
    return new vscode.Position(idx, col);
  };

  /**
   * Colonne d'ouverture du preview. Avec « Beside », si le groupe voisin contient déjà des onglets,
   * le preview s'y ouvrirait en onglet inactif (donc masqué, sans rendu): on crée alors un groupe dédié.
   */
  const resolvePreviewColumn = async (pane: string | undefined): Promise<vscode.ViewColumn> => {
    const column = getColumnFromPane(pane);
    if (column !== vscode.ViewColumn.Beside) { return column; }
    const active = vscode.window.tabGroups.activeTabGroup;
    const beside = vscode.window.tabGroups.all.find(g => g.viewColumn === active.viewColumn + 1);
    if (beside && beside.tabs.length > 0) {
      await vscode.commands.executeCommand('workbench.action.newGroupRight');
      return vscode.ViewColumn.Active;
    }
    return column;
  };

  /** Ouvre ou rafraîchit le preview. Retourne l'URI du document prévisualisé. */
  const doRefreshPreview = async (args?: OpenArgs | vscode.Uri): Promise<vscode.Uri | undefined> => {
    const opts: OpenArgs = args instanceof vscode.Uri ? { filePath: args.fsPath } : (args ?? {});
    const config = vscode.workspace.getConfiguration("mtessFrwBacasable");
    const url = config.get<string>("url");
    const title = "FRW Bac à sable";
    const showAll = config.get<boolean>("showAll") ?? true;

    // 1. Quel document? Le fichier demandé en priorité, sinon l'éditeur actif.
    let editor: vscode.TextEditor | undefined;
    let document: vscode.TextDocument | undefined;
    if (opts.filePath) {
      const target = vscode.Uri.file(opts.filePath);
      editor = vscode.window.visibleTextEditors.find(e => e.document.uri.fsPath === target.fsPath);
      try {
        document = editor?.document ?? await vscode.workspace.openTextDocument(target);
      } catch {
        return undefined;
      }
    } else {
      editor = vscode.window.activeTextEditor?.document.fileName.endsWith('.form.yml')
        ? vscode.window.activeTextEditor
        : vscode.window.visibleTextEditors.find(e => e.document.fileName.endsWith('.form.yml'));
      document = editor?.document;
    }
    if (!document) { return undefined; }

    // 2. Quelle position? La ligne demandée, sinon le curseur de l'éditeur.
    let selection: vscode.Selection;
    if (opts.line !== undefined) {
      const pos = positionForLine(document, opts.line);
      selection = new vscode.Selection(pos, pos);
      if (editor) {
        editor.selection = selection;
        editor.revealRange(new vscode.Range(pos, pos));
      }
    } else {
      selection = editor?.selection ?? new vscode.Selection(0, 0, 0, 0);
    }

    if (!document.isUntitled && document.isDirty) {
      await document.save();
    }

    // 3. Fil d'Ariane à partir des symboles YAML
    let breadcrumb = "";
    try {
      const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
        'vscode.executeDocumentSymbolProvider', document.uri);
      if (symbols !== undefined) {
        for (const symbol of iterateSymbols(symbols, selection)) {
          breadcrumb = breadcrumb + '/' + symbol.name;
        }
      }
    } catch {
      // Le fournisseur de symboles YAML peut ne pas être prêt: on rend quand même, sans fil d'Ariane.
    }

    const fileBytes = await vscode.workspace.fs.readFile(document.uri);
    lastBreadcrumb = breadcrumb;
    const text = new TextDecoder().decode(fileBytes);
    const base64Text = btoa(unescape(encodeURIComponent(text)));

    // Groupe dédié au preview: créé avant le garde-focus (la création déplace le focus et décale les colonnes).
    const column = currentPanel ? undefined : await resolvePreviewColumn(config.get<string>("pane"));
    const newGroupCreated = column === vscode.ViewColumn.Active;

    // Garde-focus : dès que le webview vole le focus, on le redonne à l'éditeur.
    // On utilise un événement plutôt qu'un setTimeout pour être réactif peu importe le timing.
    const docToRestore = document;
    const colToRestore = editor?.viewColumn;
    if (!newGroupCreated && colToRestore !== undefined) {
      const focusGuard = vscode.window.onDidChangeActiveTextEditor(() => {
        if (currentPanel?.active) {
          focusGuard.dispose();
          vscode.window.showTextDocument(docToRestore, { viewColumn: colToRestore, preserveFocus: false });
        }
      });
      setTimeout(() => focusGuard.dispose(), 2000);
    }

    if (!currentPanel) {
      const panel = (currentPanel = vscode.window.createWebviewPanel(
        "vscode-mtess-frw-bacasable",
        title,
        { viewColumn: column ?? vscode.ViewColumn.Beside, preserveFocus: true },
        {
          enableCommandUris: true,
          enableFindWidget: true,
          localResourceRoots: [],
          enableScripts: true,
        }
      ));

      const configListener = vscode.workspace.onDidChangeConfiguration(() => {
        const newConfig = vscode.workspace.getConfiguration("mtessFrwBacasable");
        const newUrl = newConfig.get<string>("url");
        const newShowAll = newConfig.get<boolean>("showAll") ?? true;

        panel.webview.html = newUrl
          ? renderHost(newUrl, base64Text, breadcrumb, newShowAll)
          : renderPlaceholder();
      });

      panel.webview.html = url ? renderHost(url, base64Text, breadcrumb, showAll) : renderPlaceholder();

      panel.onDidDispose(() => {
        currentPanel = undefined;
        configListener.dispose();
      });

      // Un groupe vient d'être créé pour le preview et a pris le focus: retour au groupe d'origine.
      if (newGroupCreated) { await vscode.commands.executeCommand('workbench.action.focusPreviousGroup'); }
    } else {
      currentPanel.webview.html = url ? renderHost(url, base64Text, breadcrumb, showAll) : renderPlaceholder();
      // Onglet du preview masqué derrière un autre: le webview ne charge rien tant qu'il n'est pas visible.
      if (!currentPanel.visible) { currentPanel.reveal(currentPanel.viewColumn, true); }
    }
    return document.uri;
  };

  // Les actualisations sont traitées une à la fois: la création du panneau (et de son groupe)
  // est asynchrone, deux appels simultanés (Ctrl+S, outil IA, déclencheur MCP) créeraient deux panneaux.
  let refreshQueue: Promise<unknown> = Promise.resolve();
  const refreshPreview = (args?: OpenArgs | vscode.Uri): Promise<vscode.Uri | undefined> => {
    const run = refreshQueue.then(() => doRefreshPreview(args), () => doRefreshPreview(args));
    refreshQueue = run.catch(() => undefined);
    return run;
  };

  const disposable = vscode.commands.registerCommand(
    "vscode-mtess-frw-bacasable.open",
    (args?: OpenArgs | vscode.Uri) => refreshPreview(args)
  );

  context.subscriptions.push(disposable);

  interface PreviewInput {
    filePath?: string;
    line?: number;
  }

  const toolDisposable = vscode.lm.registerTool<PreviewInput>(
    'mtess-frw-bacasable_preview',
    {
      async invoke(options, _token) {
        const { filePath, line } = options.input ?? {};

        let targetUri: vscode.Uri | undefined;

        if (filePath) {
          targetUri = vscode.Uri.file(filePath);
          const existingEditor = vscode.window.visibleTextEditors.find(
            e => e.document.uri.fsPath === targetUri!.fsPath
          );
          if (!existingEditor) {
            const doc = await vscode.workspace.openTextDocument(targetUri);
            // Ouvrir dans la colonne opposée au panel preview pour éviter la collision
            const panelColumn = currentPanel?.viewColumn;
            const editorColumn = (panelColumn === vscode.ViewColumn.One)
              ? vscode.ViewColumn.Two
              : vscode.ViewColumn.One;
            await vscode.window.showTextDocument(doc, {
              preserveFocus: true,
              viewColumn: editorColumn,
            });
          }
        }

        // Rafraîchir le preview sur le fichier et la ligne demandés (et non sur l'éditeur actif)
        const usedUri = await vscode.commands.executeCommand<vscode.Uri | undefined>(
          'vscode-mtess-frw-bacasable.open', { filePath: targetUri?.fsPath, line } as OpenArgs);
        targetUri = targetUri ?? usedUri;

        const targetFile = targetUri?.fsPath
          ?? vscode.window.activeTextEditor?.document.fileName
          ?? 'le fichier actif';

        // Try to POST to the backend and capture errors
        const config = vscode.workspace.getConfiguration("mtessFrwBacasable");
        const backendUrl = config.get<string>("url");

        if (backendUrl && targetUri) {
          try {
            const fileBytes = await vscode.workspace.fs.readFile(targetUri);
            const yamlText = new TextDecoder().decode(fileBytes);
            const base64Text = btoa(unescape(encodeURIComponent(yamlText)));

            const body = new URLSearchParams({
              content: base64Text,
              breadcrumb: '',
            });

            const response = await fetch(backendUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: body.toString(),
            });

            const responseText = await response.text();

            if (!response.ok) {
              // Return error details so the LLM can auto-correct
              return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                  `ERREUR du bac à sable FRW (HTTP ${response.status}) pour ${targetFile}:\n${responseText}\n\nCorrige le YAML selon les erreurs ci-dessus puis rappelle cet outil.`
                ),
              ]);
            }

            // Check if the response body contains error indicators (JSON error response)
            try {
              const json = JSON.parse(responseText);
              if (json.errors || json.error || json.erreurs) {
                const errorDetail = JSON.stringify(json.errors || json.error || json.erreurs, null, 2);
                return new vscode.LanguageModelToolResult([
                  new vscode.LanguageModelTextPart(
                    `ERREUR de validation FRW pour ${targetFile}:\n${errorDetail}\n\nCorrige le YAML selon les erreurs ci-dessus puis rappelle cet outil.`
                  ),
                ]);
              }
            } catch {
              // Response is not JSON (likely HTML success page) — that's fine
            }

            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(
                `Le bac à sable FRW a été ouvert/rafraîchi avec succès pour : ${targetFile}\nFil d'Ariane utilisé : ${lastBreadcrumb || '(aucun)'}`
              ),
            ]);

          } catch (err: any) {
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(
                `Le bac à sable FRW a été rafraîchi pour ${targetFile}, mais impossible de valider via le backend: ${err.message}`
              ),
            ]);
          }
        }

        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(
            `Le bac à sable FRW a été ouvert/rafraîchi pour : ${targetFile}`
          ),
        ]);
      },
    }
  );

  context.subscriptions.push(toolDisposable);

  // Enregistre le serveur MCP auprès de VS Code : tous les agents (dont Copilot CLI) peuvent
  // ainsi appeler l'outil preview sans fichier .mcp.json dans le workspace.
  const mcpProviderDisposable = vscode.lm.registerMcpServerDefinitionProvider('frw-bacasable', {
    provideMcpServerDefinitions() {
      const serverPath = vscode.Uri.joinPath(context.extensionUri, 'out', 'mcp-server.js').fsPath;
      const url = vscode.workspace.getConfiguration('mtessFrwBacasable').get<string>('url') ?? '';
      const definition = new vscode.McpStdioServerDefinition(
        'FRW bac à sable', 'node', [serverPath], { FRW_BACKEND_URL: url }
      );
      definition.cwd = vscode.workspace.workspaceFolders?.[0]?.uri;
      return [definition];
    },
  });
  context.subscriptions.push(mcpProviderDisposable);

  // File watcher: when MCP server writes .frw-trigger, refresh the webview
  const triggerPattern = new vscode.RelativePattern(
    vscode.workspace.workspaceFolders?.[0]?.uri ?? '',
    '.mtess/.frw-trigger'
  );
  const triggerWatcher = vscode.workspace.createFileSystemWatcher(triggerPattern);
  const handleTrigger = async () => {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) { return; }
    const triggerUri = vscode.Uri.joinPath(folders[0].uri, '.mtess', '.frw-trigger');
    try {
      const bytes = await vscode.workspace.fs.readFile(triggerUri);
      const raw = new TextDecoder().decode(bytes).trim();
      // Format: "filePath:line" or just "filePath"
      const colonIdx = raw.lastIndexOf(':');
      const lineNum = colonIdx > 1 ? parseInt(raw.slice(colonIdx + 1), 10) : NaN;
      const filePath = (!isNaN(lineNum) && colonIdx > 1) ? raw.slice(0, colonIdx) : raw;

      if (filePath) {
        const uri = vscode.Uri.file(filePath);
        const openDoc = vscode.workspace.textDocuments.find(d => d.uri.fsPath === uri.fsPath);
        if (openDoc && openDoc.isDirty) {
          await openDoc.save();
        }
      }
      // Le fichier et la ligne sont transmis tels quels: pas d'ouverture d'éditeur dans le groupe actif
      // (il pouvait recouvrir le preview).
      await vscode.commands.executeCommand(
        'vscode-mtess-frw-bacasable.open',
        filePath ? { filePath, line: isNaN(lineNum) ? undefined : lineNum } as OpenArgs : undefined);
      await vscode.workspace.fs.delete(triggerUri);
    } catch {
      // Trigger file may already be deleted or unreadable
    }
  };
  triggerWatcher.onDidCreate(handleTrigger);
  triggerWatcher.onDidChange(handleTrigger);
  context.subscriptions.push(triggerWatcher);

  const config = vscode.workspace.getConfiguration("mtessFrwBacasable");
  // Opt-in: GitHub Copilot reçoit le skill FRW via `chatSkills` (package.json),
  // ce déploiement ne sert qu'à Claude Code.
  if (config.get<boolean>("deployAiSkills") === true) {
    deploySkill(context.extensionUri);
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-mtess-frw-bacasable.init', async () => {
      // Commande explicite: elle déploie même si le réglage automatique est désactivé.
      await deploySkill(context.extensionUri);
      vscode.window.showInformationMessage('FRW: skill FRW déployé pour Claude Code (.claude/skills/frw/, .mcp.json, .mtess/)');
    })
  );
}

// this method is called when your extension is deactivated
export function deactivate() { }
