const ts = require('typescript');
require.extensions['.ts'] = (module, file) => {
  const source = require('fs').readFileSync(file, 'utf8');
  module._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, file);
};
