const r = `
-- SCENE 1 ---
Text
Scene Dynamics:
Text`;
console.log(r.split(/(?:^|\n)(?=[\s\*\-\#\[\]]*Scene\s*\d+)/i));
