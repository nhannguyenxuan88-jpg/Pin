const fs = require('fs');
const path = require('path');

const files = [
    path.join('g:', 'Pin', 'Pin', 'components', 'PinSalesManager.tsx'),
    path.join('g:', 'Pin', 'Pin', 'components', 'PinProductManager.tsx')
];

for (const filePath of files) {
    if (!fs.existsSync(filePath)) continue;
    let content = fs.readFileSync(filePath, 'utf8');

    // Replace standard colors to PIN tokens
    content = content.replace(/bg-slate-/g, 'bg-pin-gray-');
    content = content.replace(/text-slate-/g, 'text-pin-gray-');
    content = content.replace(/border-slate-/g, 'border-pin-gray-');
    content = content.replace(/ring-slate-/g, 'ring-pin-gray-');
    content = content.replace(/shadow-slate-/g, 'shadow-pin-gray-');

    // Replace dark mode colors
    content = content.replace(/dark:bg-slate-/g, 'dark:bg-pin-dark-');
    content = content.replace(/dark:text-slate-/g, 'dark:text-pin-dark-');
    content = content.replace(/dark:border-slate-/g, 'dark:border-pin-dark-');
    content = content.replace(/dark:ring-slate-/g, 'dark:ring-pin-dark-');

    // Replace primary sky -> pin-blue
    content = content.replace(/text-sky-/g, 'text-pin-blue-');
    content = content.replace(/bg-sky-/g, 'bg-pin-blue-');
    content = content.replace(/focus:ring-sky-/g, 'focus:ring-pin-blue-');
    content = content.replace(/border-sky-/g, 'border-pin-blue-');

    fs.writeFileSync(filePath, content, 'utf8');
}
console.log('Replaced tokens in Feature Pages.');
