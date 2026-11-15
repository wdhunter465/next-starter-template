// #5218: lets a Node script import functions/_lib/*.ts files whose own relative imports have no extension
// (the planner imports './social-post-formatter'). Register it with node:module register() before the import.
// It only retries a relative, extensionless specifier from a .ts file with '.ts' added, and changes nothing else.
export async function resolve(specifier, context, nextResolve) {
  if (/^\.{1,2}\//.test(specifier) && !/\.[a-z]+$/i.test(specifier) && context.parentURL?.endsWith('.ts')) {
    try {
      return await nextResolve(`${specifier}.ts`, context);
    } catch {
      // fall through to the default resolution and its error
    }
  }
  return nextResolve(specifier, context);
}
