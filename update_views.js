const fs = require('fs');
const path = require('path');

function replaceInDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            replaceInDir(fullPath);
        } else if (fullPath.endsWith('.ejs')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            content = content.replace(/#e52e2e/gi, '#D62828');
            content = content.replace(/#ff5252/gi, '#D62828');
            content = content.replace(/#b91c1c/gi, '#991B1B');
            content = content.replace(/#061B3A/gi, '#061A36');
            content = content.replace(/#0A2347/gi, '#082044');
            content = content.replace(/#0D2A52/gi, '#082044');
            content = content.replace(/#102F5A/gi, '#102F59');
            fs.writeFileSync(fullPath, content);
        }
    }
}

replaceInDir(path.join(__dirname, 'views'));
console.log('Replaced colors in EJS files.');
