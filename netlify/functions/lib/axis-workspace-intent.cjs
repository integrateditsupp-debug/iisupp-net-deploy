// Routing only: never authorizes spending, messaging or computer commands.
exports.workspaceIntent = (text) => {
  const value = String(text || '').trim();
  if (!/^(?:(?:please|axis)[,\s]+)*(?:pull\s+up|bring\s+up|show\s+me|let[’']?s\s+work\s+on)\s+\S/i.test(value)) return null;
  if (/\b(?:my pc|on my computer|local file|run a command|terminal|powershell|open (?:an? )?app)\b/i.test(value)) return null;
  return value.slice(0, 3000);
};