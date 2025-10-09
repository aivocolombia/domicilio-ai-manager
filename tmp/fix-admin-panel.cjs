const fs = require("fs");
const path = "src/components/AdminPanel.tsx";
let text = fs.readFileSync(path, "utf8");
text = text.replace(/('.*?')\s+(import\b)/g, '$1\n$2');
text = text.replace(/(".*?")\s+(import\b)/g, '$1\n$2');
text = text.replace(/([}\)\]])\s+(?=[A-Za-z_\$])/g, '$1\n');
fs.writeFileSync(path, text, "utf8");
