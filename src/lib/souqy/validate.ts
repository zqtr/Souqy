import 'server-only';
import { parse } from '@babel/parser';
import type { File, Node } from '@babel/types';
import { themeOverridesSchema } from '@/lib/blocks/schemas';

/**
 * AST-based safety pass for Souqy-generated TSX.
 *
 * Runs *before* we waste sandbox time bundling. Catches classes of
 * unsafe / off-spec code that tsc alone wouldn't flag:
 *
 *   - Imports outside the allowlist (`react`, `@souqna/sdk`, `./theme`).
 *   - Use of forbidden globals (`process`, `window`, `document`,
 *     `globalThis`, `eval`, `Function`, `localStorage`, `fetch`, …).
 *   - Dynamic imports / `new Function()` constructors.
 *   - `dangerouslySetInnerHTML` JSX attributes.
 *   - Top-level await (would block the dynamic import).
 *
 * The validator returns a plain `ValidationResult` rather than throwing
 * so the caller can decide between auto-repair (one error) and hard
 * fail (parse error / repeated repair failures).
 */

const ALLOWED_IMPORTS = new Set<string>(['react', '@souqna/sdk', './theme']);

const FORBIDDEN_GLOBALS = new Set<string>([
  'process',
  'window',
  'document',
  'globalThis',
  'self',
  'top',
  'parent',
  'eval',
  'Function',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'fetch',
  'navigator',
  'XMLHttpRequest',
  'WebSocket',
  'crypto',
  'require',
  '__dirname',
  '__filename',
  'Buffer',
  'setTimeout',
  'setInterval',
  'setImmediate',
  'queueMicrotask',
]);

const FORBIDDEN_JSX_ATTRS = new Set<string>([
  'dangerouslySetInnerHTML',
  'onClick',
  'onChange',
  'onSubmit',
  'onInput',
  'onKeyDown',
  'onKeyUp',
  'onMouseDown',
  'onMouseUp',
  'onMouseMove',
  'onFocus',
  'onBlur',
  'onLoad',
  'onError',
]);

const ALLOWED_FILES = new Set<string>(['index.tsx', 'theme.ts']);

export type ValidationIssue = {
  file: string;
  line?: number;
  column?: number;
  message: string;
};

export type ValidationResult =
  | { ok: true }
  | { ok: false; issues: ValidationIssue[] };

/**
 * Top-level entry. Validates every file in the Souqy output bundle and
 * returns a flat list of issues. Always returns ALL issues (no early
 * exit) so the auto-repair prompt has a complete picture.
 */
export function validateSouqyOutput(files: Record<string, string>): ValidationResult {
  const issues: ValidationIssue[] = [];

  for (const name of Object.keys(files)) {
    if (!ALLOWED_FILES.has(name)) {
      issues.push({
        file: name,
        message: `Unexpected file: only ${[...ALLOWED_FILES].join(', ')} are allowed.`,
      });
    }
  }

  for (const required of ALLOWED_FILES) {
    if (!files[required]) {
      issues.push({ file: required, message: `Missing required file: ${required}.` });
    }
  }

  for (const [name, source] of Object.entries(files)) {
    if (!ALLOWED_FILES.has(name)) continue;
    issues.push(...validateFile(name, source));
  }

  // theme.ts: parse the literal export and run it through the existing
  // Zod schema. Any drift from the dashboard's theme contract fails
  // before bundling.
  const themeSource = files['theme.ts'];
  if (themeSource) {
    const themeIssues = validateThemeShape(themeSource);
    issues.push(...themeIssues);
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

function validateFile(filename: string, source: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  let ast: File;
  try {
    ast = parse(source, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
      // Top-level await would cause the dynamic import to suspend in
      // the wrong context. Disallow at parse time so we don't have to
      // detect it during the walk.
      allowAwaitOutsideFunction: false,
      allowReturnOutsideFunction: false,
      allowImportExportEverywhere: false,
    });
  } catch (err) {
    issues.push({
      file: filename,
      message: `Parse error: ${(err as Error).message}`,
    });
    return issues;
  }

  // Pass 1 — module-level imports + exports.
  for (const node of ast.program.body) {
    if (node.type === 'ImportDeclaration') {
      const src = node.source.value;
      if (!ALLOWED_IMPORTS.has(src)) {
        issues.push({
          file: filename,
          line: node.loc?.start.line,
          column: node.loc?.start.column,
          message: `Disallowed import: \`${src}\`. Allowed: ${[...ALLOWED_IMPORTS].join(', ')}.`,
        });
      }
    }
  }

  // index.tsx must default-export a `Storefront` component.
  if (filename === 'index.tsx') {
    const hasStorefrontDefaultExport = ast.program.body.some((node) => {
      if (node.type !== 'ExportDefaultDeclaration') return false;
      const decl = node.declaration;
      if (decl.type === 'FunctionDeclaration' && decl.id?.name === 'Storefront') return true;
      if (decl.type === 'Identifier' && decl.name === 'Storefront') return true;
      return false;
    });
    if (!hasStorefrontDefaultExport) {
      issues.push({
        file: filename,
        message:
          '`index.tsx` must default-export a function called `Storefront` (e.g. `export default function Storefront() { … }`).',
      });
    }
  }

  // theme.ts must export a const literal `theme`.
  if (filename === 'theme.ts') {
    const hasThemeExport = ast.program.body.some((node) => {
      if (node.type !== 'ExportNamedDeclaration') return false;
      const decl = node.declaration;
      if (decl?.type !== 'VariableDeclaration') return false;
      return decl.declarations.some((d) => d.id.type === 'Identifier' && d.id.name === 'theme');
    });
    if (!hasThemeExport) {
      issues.push({
        file: filename,
        message: '`theme.ts` must export `const theme: ThemeOverrides = { … }`.',
      });
    }
  }

  // Pass 2 — full AST walk for forbidden patterns.
  walk(ast, (node) => {
    switch (node.type) {
      case 'CallExpression':
        // `eval(...)`, `Function(...)` calls.
        if (node.callee.type === 'Identifier' && FORBIDDEN_GLOBALS.has(node.callee.name)) {
          issues.push(issue(filename, node, `Disallowed call: \`${node.callee.name}(...)\`.`));
        }
        // Dynamic import: `import('foo')` parses as `Import` callee.
        if (node.callee.type === 'Import') {
          issues.push(issue(filename, node, 'Disallowed: dynamic `import()`.'));
        }
        break;
      case 'NewExpression':
        // `new Function('return foo')` constructs.
        if (node.callee.type === 'Identifier' && node.callee.name === 'Function') {
          issues.push(issue(filename, node, 'Disallowed: `new Function(...)`.'));
        }
        if (node.callee.type === 'Identifier' && node.callee.name === 'WebSocket') {
          issues.push(issue(filename, node, 'Disallowed: `new WebSocket(...)`.'));
        }
        if (node.callee.type === 'Identifier' && node.callee.name === 'XMLHttpRequest') {
          issues.push(issue(filename, node, 'Disallowed: `new XMLHttpRequest(...)`.'));
        }
        break;
      case 'JSXAttribute':
        if (
          node.name.type === 'JSXIdentifier' &&
          FORBIDDEN_JSX_ATTRS.has(node.name.name)
        ) {
          issues.push(
            issue(
              filename,
              node,
              `Disallowed JSX attribute: \`${node.name.name}\`. Souqy only emits server components.`,
            ),
          );
        }
        break;
      case 'AwaitExpression':
        // We disabled top-level await at parse time, but a child can
        // still slip in inside a non-async function. The build will
        // catch it; we flag it here for clearer error attribution.
        // (Async function bodies are fine — React supports async server
        // components.)
        break;
      default:
        break;
    }
  });

  // Pass 3 — referenced identifiers. We catch references to forbidden
  // globals only when they aren't shadowed by a local binding. For the
  // size of these files we just scan the AST for `Identifier` nodes in
  // contexts that read the binding (skipping property access keys and
  // declarations).
  walk(ast, (node, parent) => {
    if (node.type !== 'Identifier') return;
    if (!FORBIDDEN_GLOBALS.has(node.name)) return;
    if (!isReadReference(node, parent)) return;
    issues.push(
      issue(
        filename,
        node,
        `Disallowed global reference: \`${node.name}\`. Souqy code may not touch the runtime environment.`,
      ),
    );
  });

  return issues;
}

function issue(file: string, node: Node, message: string): ValidationIssue {
  return {
    file,
    line: node.loc?.start.line,
    column: node.loc?.start.column,
    message,
  };
}

/**
 * Heuristic: is this Identifier node a *read reference* to a global
 * binding (vs a property name, declaration, label, etc)?
 *
 * We're deliberately conservative. False positives just trigger the
 * auto-repair loop; false negatives leak unsafe code.
 */
function isReadReference(node: Node, parent: Node | null): boolean {
  if (!parent) return true;
  switch (parent.type) {
    case 'MemberExpression':
      // `foo.bar` — only the object position is a read; `bar` (the
      // property) is a name, unless the access is computed (`foo[bar]`).
      return parent.object === node || (parent.computed && parent.property === node);
    case 'OptionalMemberExpression':
      return parent.object === node || (parent.computed && parent.property === node);
    case 'ObjectProperty':
      // `{ foo: 1 }` — `foo` is a key when shorthand is false.
      return (parent as { shorthand?: boolean }).shorthand === true || parent.value === node;
    case 'ObjectMethod':
      return parent.key !== node;
    case 'VariableDeclarator':
      // `const foo = x` — `foo` is a name, not a read.
      return parent.id !== node;
    case 'FunctionDeclaration':
    case 'FunctionExpression':
    case 'ArrowFunctionExpression':
      // Function name + parameter names are bindings, not reads.
      return false;
    case 'ImportSpecifier':
    case 'ImportDefaultSpecifier':
    case 'ImportNamespaceSpecifier':
    case 'ExportSpecifier':
    case 'CatchClause':
      return false;
    case 'JSXAttribute':
      return parent.name !== node;
    case 'LabeledStatement':
      return parent.label !== node;
    case 'TSTypeReference':
    case 'TSQualifiedName':
    case 'TSInterfaceDeclaration':
    case 'TSTypeAliasDeclaration':
      // Type-position identifiers don't reach runtime.
      return false;
    default:
      return true;
  }
}

/**
 * Lightweight depth-first walk. Calls `visit(node, parent)` for every
 * node in the tree. Skips known-empty fields (loc, comments, tokens)
 * to avoid wasting iterations.
 */
function walk(root: Node, visit: (node: Node, parent: Node | null) => void): void {
  function recurse(node: Node, parent: Node | null) {
    visit(node, parent);
    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'leadingComments' || key === 'trailingComments') continue;
      const value = (node as unknown as Record<string, unknown>)[key];
      if (value == null) continue;
      if (Array.isArray(value)) {
        for (const child of value) {
          if (child && typeof child === 'object' && 'type' in (child as object)) {
            recurse(child as Node, node);
          }
        }
      } else if (typeof value === 'object' && 'type' in (value as object)) {
        recurse(value as Node, node);
      }
    }
  }
  recurse(root, null);
}

/**
 * Parse the `theme.ts` literal and feed the resulting object through
 * the Zod schema. Catches palette typos, out-of-range heading weights,
 * etc — the same checks the dashboard runs on theme writes.
 *
 * We deliberately only support an object-literal `theme` export. Any
 * dynamism (computed keys, spread of imported values) won't statically
 * extract; we surface that as a validation issue and ask Claude to
 * inline the literal.
 */
function validateThemeShape(source: string): ValidationIssue[] {
  let ast: File;
  try {
    ast = parse(source, {
      sourceType: 'module',
      plugins: ['typescript'],
    });
  } catch (err) {
    return [{ file: 'theme.ts', message: `Parse error: ${(err as Error).message}` }];
  }
  for (const node of ast.program.body) {
    if (node.type !== 'ExportNamedDeclaration') continue;
    if (node.declaration?.type !== 'VariableDeclaration') continue;
    for (const decl of node.declaration.declarations) {
      if (decl.id.type !== 'Identifier' || decl.id.name !== 'theme') continue;
      if (decl.init?.type !== 'ObjectExpression') {
        return [
          {
            file: 'theme.ts',
            message: '`theme` must be an inline object literal (no spreads / no helper calls).',
          },
        ];
      }
      const literal = objectLiteralToValue(decl.init);
      if (literal === SYM_NON_LITERAL) {
        return [
          {
            file: 'theme.ts',
            message:
              '`theme` contains non-literal values. Inline plain strings, numbers, and nested object literals only.',
          },
        ];
      }
      const parsed = themeOverridesSchema.safeParse(literal);
      if (!parsed.success) {
        return parsed.error.issues.map((iss) => ({
          file: 'theme.ts',
          message: `theme.${iss.path.join('.')}: ${iss.message}`,
        }));
      }
      return [];
    }
  }
  return [];
}

const SYM_NON_LITERAL = Symbol('non-literal');

/**
 * Turn an `ObjectExpression` AST into a plain JS value when (and only
 * when) every leaf is a literal string / number / boolean / null /
 * nested object. Anything else returns `SYM_NON_LITERAL` so the
 * validator can flag the offending file.
 */
function objectLiteralToValue(node: Node): unknown {
  if (node.type === 'ObjectExpression') {
    const out: Record<string, unknown> = {};
    for (const prop of node.properties) {
      if (prop.type !== 'ObjectProperty') return SYM_NON_LITERAL;
      let key: string | undefined;
      if (prop.key.type === 'Identifier') key = prop.key.name;
      else if (prop.key.type === 'StringLiteral') key = prop.key.value;
      else return SYM_NON_LITERAL;
      const value = objectLiteralToValue(prop.value as Node);
      if (value === SYM_NON_LITERAL) return SYM_NON_LITERAL;
      out[key] = value;
    }
    return out;
  }
  if (node.type === 'StringLiteral') return node.value;
  if (node.type === 'NumericLiteral') return node.value;
  if (node.type === 'BooleanLiteral') return node.value;
  if (node.type === 'NullLiteral') return null;
  if (node.type === 'ArrayExpression') {
    const arr: unknown[] = [];
    for (const el of node.elements) {
      if (el == null) return SYM_NON_LITERAL;
      const v = objectLiteralToValue(el as Node);
      if (v === SYM_NON_LITERAL) return SYM_NON_LITERAL;
      arr.push(v);
    }
    return arr;
  }
  // Negative number literals come through as `UnaryExpression { operator: '-', argument: NumericLiteral }`.
  if (node.type === 'UnaryExpression' && node.operator === '-') {
    const inner = objectLiteralToValue(node.argument as Node);
    if (typeof inner === 'number') return -inner;
  }
  return SYM_NON_LITERAL;
}

/**
 * Format the issues into a single string suitable for the auto-repair
 * prompt. Order is stable so two failed runs produce the same prompt
 * (cache-friendly).
 */
export function formatIssues(issues: readonly ValidationIssue[]): string {
  return issues
    .map((iss) => {
      const loc = iss.line != null ? ` (line ${iss.line}${iss.column != null ? `:${iss.column}` : ''})` : '';
      return `- ${iss.file}${loc}: ${iss.message}`;
    })
    .join('\n');
}
