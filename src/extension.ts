import * as vscode from "vscode";
import { renderHost, renderPlaceholder } from "./host";
import { getColumnFromPane } from "./pane";

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand(
    "vscode-live-frame.open",
    () => {
      const config = vscode.workspace.getConfiguration("liveFrame");
      const url = config.get<string>("url");
      const title = config.get<string>("title") || url || "Live Frame";
      const pane = config.get<string>("pane");
      const column = getColumnFromPane(pane);
      const panel = vscode.window.createWebviewPanel(
        "vscode-live-frame",
        title,
        column,
        {
          localResourceRoots: [],
          enableScripts: true,
        }
      );

      vscode.workspace.onDidChangeConfiguration((e) => {
        const newConfig = vscode.workspace.getConfiguration("liveFrame");
        const newUrl = newConfig.get<string>("url");
        const newTitle =
          newConfig.get<string>("title") || newUrl || "Live Frame";
        panel.webview.html = newUrl ? renderHost(newUrl) : renderPlaceholder();
        panel.title = newTitle;
      });

      panel.webview.html = url ? renderHost(url) : renderPlaceholder();
    }
  );

  context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
