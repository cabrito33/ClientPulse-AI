import fs from 'node:fs';
import ts from 'typescript';

// Execute the actual module with explicit dependency substitutes; no copied business logic.
export function loadTypeScript(file, dependencies = {}, globals = {}) {
  const source = fs.readFileSync(file, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: file,
  });
  const module = { exports: {} };
  const require = (name) => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  };
  new Function('require', 'module', 'exports', ...Object.keys(globals), outputText)(
    require, module, module.exports, ...Object.values(globals),
  );
  return module.exports;
}

export function fakeDatabase(resolve) {
  const calls = [];
  return {
    calls,
    auth: { getUser: async () => ({ data: { user: { id: 'test-user' } }, error: null }) },
    from(table) {
      const call = { table, operation: 'select', filters: [] };
      const chain = new Proxy({}, { get(_, key) {
        if (key === 'then') return (ok, fail) => {
          calls.push(call);
          return Promise.resolve(resolve(call)).then(ok, fail);
        };
        return (...args) => {
          if (['insert', 'update', 'upsert', 'delete'].includes(key)) {
            call.operation = key; call.payload = args[0];
          } else if (['eq', 'is', 'in', 'gt'].includes(key)) call.filters.push([key, ...args]);
          return chain;
        };
      } });
      return chain;
    },
  };
}
