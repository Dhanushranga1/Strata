const fs = require('fs');
const path = require('path');

console.log('=== BUILD DEBUG INFO ===');
console.log('Current working directory:', process.cwd());
console.log('__dirname:', __dirname);
console.log('\n=== Checking src directory ===');
console.log('src exists:', fs.existsSync(path.join(process.cwd(), 'src')));
console.log('src/lib exists:', fs.existsSync(path.join(process.cwd(), 'src/lib')));
console.log('src/lib/supabaseClient.ts exists:', fs.existsSync(path.join(process.cwd(), 'src/lib/supabaseClient.ts')));

if (fs.existsSync(path.join(process.cwd(), 'src/lib'))) {
  console.log('\n=== Files in src/lib ===');
  console.log(fs.readdirSync(path.join(process.cwd(), 'src/lib')));
}

console.log('\n=== tsconfig.json exists ===');
console.log(fs.existsSync(path.join(process.cwd(), 'tsconfig.json')));

console.log('\n=== jsconfig.json exists ===');
console.log(fs.existsSync(path.join(process.cwd(), 'jsconfig.json')));

console.log('=== END DEBUG INFO ===\n');
