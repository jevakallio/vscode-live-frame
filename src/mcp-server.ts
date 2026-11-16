#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import * as http from 'http';
import * as https from 'https';

function getBackendUrl(): string {
  if (process.env.FRW_BACKEND_URL) { return process.env.FRW_BACKEND_URL; }
  const workspaceDir = process.cwd();
  try {
    const settingsPath = path.join(workspaceDir, '.vscode', 'settings.json');
    const raw = fs.readFileSync(settingsPath, 'utf-8');
    // Strip single-line comments (// ...) to handle JSONC
    const cleaned = raw.replace(/\/\/.*$/gm, '');
    const settings = JSON.parse(cleaned);
    return settings['mtessFrwBacasable.url'] || '';
  } catch {
    return '';
  }
}

const rl = readline.createInterface({ input: process.stdin, terminal: false });

function send(msg: object) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

rl.on('line', async (line: string) => {
  if (!line.trim()) { return; }
  let msg: any;
  try { msg = JSON.parse(line); } catch { return; }

  const { id, method, params } = msg;

  switch (method) {
    case 'initialize':
      send({
        jsonrpc: '2.0', id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'frw-bacasable', version: '1.0.0' },
        },
      });
      break;

    case 'notifications/initialized':
    case 'initialized':
      break;

    case 'ping':
      send({ jsonrpc: '2.0', id, result: {} });
      break;

    case 'tools/list':
      send({
        jsonrpc: '2.0', id,
        result: {
          tools: [{
            name: 'preview',
            description:
              'OBLIGATOIRE — appelle cet outil après chaque modification de fichier .form.yml. ' +
              'Prévisualise le formulaire dans le bac à sable FRW et retourne les erreurs de validation. ' +
              'Si des erreurs sont retournées, corrige le YAML et rappelle cet outil.',
            inputSchema: {
              type: 'object',
              properties: {
                filePath: {
                  type: 'string',
                  description: 'Chemin absolu vers le fichier .form.yml à prévisualiser',
                },
                line: {
                  type: 'number',
                  description: 'Numéro de ligne (1-based) de la modification effectuée, pour positionner le breadcrumb sur le bon composant.',
                },
              },
              required: ['filePath'],
            },
          }],
        },
      });
      break;

    case 'tools/call':
      try {
        const result = await handleToolCall(params);
        send({ jsonrpc: '2.0', id, result });
      } catch (err: any) {
        send({
          jsonrpc: '2.0', id,
          result: {
            content: [{ type: 'text', text: `Erreur interne MCP: ${err.message}` }],
            isError: true,
          },
        });
      }
      break;

    default:
      if (id !== undefined) {
        send({
          jsonrpc: '2.0', id,
          error: { code: -32601, message: `Méthode inconnue: ${method}` },
        });
      }
      break;
  }
});

async function handleToolCall(params: any): Promise<object> {
  const toolName = params.name;
  if (toolName !== 'preview') {
    return { content: [{ type: 'text', text: `Outil inconnu: ${toolName}` }], isError: true };
  }

  const { filePath, line } = params.arguments || {};
  if (!filePath) {
    return { content: [{ type: 'text', text: 'filePath est requis' }], isError: true };
  }

  // Read the YAML file
  let yamlContent: string;
  try {
    yamlContent = fs.readFileSync(filePath, 'utf-8');
  } catch (err: any) {
    return {
      content: [{ type: 'text', text: `Impossible de lire ${filePath}: ${err.message}` }],
      isError: true,
    };
  }

  // Write trigger file so the VS Code extension refreshes the webview
  const workspaceDir = process.cwd();
  const triggerFile = path.join(workspaceDir, '.mtess', '.frw-trigger');
  try {
    fs.mkdirSync(path.dirname(triggerFile), { recursive: true });
    const triggerContent = line !== undefined ? `${filePath}:${line}` : filePath;
    fs.writeFileSync(triggerFile, triggerContent, 'utf-8');
  } catch {
    // Non-critical — webview won't refresh but validation still works
  }

  if (!getBackendUrl()) {
    return {
      content: [{
        type: 'text',
        text: `Le panneau de prévisualisation a été rafraîchi pour ${filePath}.\n` +
          `Note: URL du backend non configurée (FRW_getBackendUrl()) — la validation automatique est désactivée.`,
      }],
    };
  }

  // POST to backend for validation
  const base64 = Buffer.from(yamlContent).toString('base64');
  const body = `content=${encodeURIComponent(base64)}&breadcrumb=`;

  try {
    const response = await httpPost(getBackendUrl(), body);

    if (response.status >= 400) {
      return {
        content: [{
          type: 'text',
          text: `ERREUR du bac à sable FRW (HTTP ${response.status}) pour ${filePath}:\n` +
            `${response.body}\n\nCorrige le YAML selon les erreurs ci-dessus puis rappelle cet outil.`,
        }],
        isError: true,
      };
    }

    // Try to detect structured error in JSON response
    try {
      const json = JSON.parse(response.body);
      const errors = json.errors || json.error || json.erreurs;
      if (errors) {
        const detail = typeof errors === 'string' ? errors : JSON.stringify(errors, null, 2);
        return {
          content: [{
            type: 'text',
            text: `ERREUR de validation FRW pour ${filePath}:\n${detail}\n\n` +
              `Corrige le YAML selon les erreurs ci-dessus puis rappelle cet outil.`,
          }],
          isError: true,
        };
      }
    } catch {
      // Not JSON (likely HTML success page) — fine
    }

    return {
      content: [{
        type: 'text',
        text: `Le bac à sable FRW a été prévisualisé avec succès pour ${filePath}.`,
      }],
    };

  } catch (err: any) {
    return {
      content: [{
        type: 'text',
        text: `Le panneau a été rafraîchi mais le backend n'est pas joignable: ${err.message}`,
      }],
    };
  }
}

function httpPost(url: string, body: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
      rejectUnauthorized: false,
    }, (res) => {
      let data = '';
      res.on('data', (chunk: string) => { data += chunk; });
      res.on('end', () => { resolve({ status: res.statusCode || 0, body: data }); });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}
