// Copie le skill FRW du sous-module `skills-externe` vers `skills/frw/`, le dossier
// référencé par le point de contribution `chatSkills` (package.json).
// La copie évite d'embarquer tout le sous-module (autres skills, historique git) dans le .vsix.
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'skills-externe', 'frw');
const target = path.join(root, 'skills', 'frw');

if (!fs.existsSync(path.join(source, 'SKILL.md'))) {
  console.error(`Skill FRW introuvable: ${source}\nInitialisez le sous-module: git submodule update --init`);
  process.exit(1);
}

fs.rmSync(target, { recursive: true, force: true });
fs.cpSync(source, target, { recursive: true });
console.log(`Skill FRW copié vers ${path.relative(root, target)}`);
