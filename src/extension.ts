import * as vscode from "vscode";
import { renderHost, renderPlaceholder } from "./host";

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand(
    "vscode-live-frame.open",
    () => {
      const config = vscode.workspace.getConfiguration("liveFrame");
      const url = config.get<string>("url");
      const title = config.get<string>("title") || url || "Live Frame";
      const pane = config.get<string>("pane");
      const column = getColumn(pane);
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

const getColumn = (pane: string | void): vscode.ViewColumn => {
  switch (pane) {
    case "Active":
      return vscode.ViewColumn.Active;
    case "Beside":
      return vscode.ViewColumn.Beside;
    case "One":
      return vscode.ViewColumn.One;
    case "Two":
      return vscode.ViewColumn.Two;
    case "Three":
      return vscode.ViewColumn.Three;
    case "Four":
      return vscode.ViewColumn.Four;
    case "Five":
      return vscode.ViewColumn.Five;
    case "Six":
      return vscode.ViewColumn.Six;
    case "Seven":
      return vscode.ViewColumn.Seven;
    case "Eight":
      return vscode.ViewColumn.Eight;
    case "Nine":
      return vscode.ViewColumn.Nine;
    default:
      return vscode.ViewColumn.Beside;
  }
};
