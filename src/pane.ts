import { ViewColumn } from "vscode";

export const getColumnFromPane = (pane: string | void): ViewColumn => {
  switch (pane) {
    case "Active":
      return ViewColumn.Active;
    case "Beside":
      return ViewColumn.Beside;
    case "One":
      return ViewColumn.One;
    case "Two":
      return ViewColumn.Two;
    case "Three":
      return ViewColumn.Three;
    case "Four":
      return ViewColumn.Four;
    case "Five":
      return ViewColumn.Five;
    case "Six":
      return ViewColumn.Six;
    case "Seven":
      return ViewColumn.Seven;
    case "Eight":
      return ViewColumn.Eight;
    case "Nine":
      return ViewColumn.Nine;
    default:
      return ViewColumn.Beside;
  }
};
