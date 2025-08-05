#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function fixImports(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    
    if (file.isDirectory()) {
      fixImports(fullPath);
    } else if (file.name.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Fix relative imports to add .js extension
      content = content.replace(/from '(\.\/[^']+)'/g, (match, importPath) => {
        return importPath.endsWith('.js') ? match : `from '${importPath}.js'`;
      });
      
      // Fix export statements
      content = content.replace(/export \* from '(\.\/[^']+)'/g, (match, importPath) => {
        return importPath.endsWith('.js') ? match : `export * from '${importPath}.js'`;
      });
      
      // Fix export * as X from statements
      content = content.replace(/export \* as \w+ from '(\.\/[^']+)'/g, (match, importPath) => {
        return importPath.endsWith('.js') ? match : match.replace(importPath, importPath + '.js');
      });
      
      fs.writeFileSync(fullPath, content);
    }
  }
}

// Run the fix on the ESM output directory
const esmDir = path.join(__dirname, '..', 'dist', 'esm');
if (fs.existsSync(esmDir)) {
  fixImports(esmDir);
  console.log('Fixed ESM imports');
} else {
  console.error('ESM directory not found:', esmDir);
  process.exit(1);
}