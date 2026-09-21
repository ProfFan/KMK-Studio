/** Small expression evaluator for the emitted ExprTk subset; never executes JavaScript. */
export function evaluate(
  source: string,
  variables: Record<string, number>,
): number {
  const tokens =
    source.match(/\d+(?:\.\d+)?|[A-Za-z_][\w.]*|==|!=|<=|>=|[()+?:<>*/-]/g) ??
    [];
  if (tokens.join("").replaceAll(" ", "") !== source.replace(/\s/g, ""))
    throw new Error("Unsupported expression syntax.");
  let pos = 0;
  const peek = () => tokens[pos];
  const take = () => tokens[pos++];
  const expected = (v: string) => {
    if (take() !== v) throw new Error(`Expected ${v} in expression`);
  };
  const primary = (): number => {
    const t = take();
    if (t === "(") {
      const n = conditional();
      expected(")");
      return n;
    }
    if (t === "-") return -primary();
    if (t === undefined) throw new Error("Incomplete expression.");
    if (/^\d/.test(t)) return Number(t);
    return variables[t] ?? 0;
  };
  const binary =
    (
      next: () => number,
      ops: string[],
      calc: (a: number, op: string, b: number) => number,
    ) =>
    () => {
      let a = next();
      while (ops.includes(peek())) {
        const op = take();
        a = calc(a, op, next());
      }
      return a;
    };
  const product = binary(primary, ["*", "/"], (a, o, b) =>
    o === "*" ? a * b : a / b,
  );
  const sum = binary(product, ["+", "-"], (a, o, b) =>
    o === "+" ? a + b : a - b,
  );
  const compare = binary(sum, ["==", "!=", "<", ">", "<=", ">="], (a, o, b) =>
    Number(
      o === "=="
        ? a === b
        : o === "!="
          ? a !== b
          : o === "<"
            ? a < b
            : o === ">"
              ? a > b
              : o === "<="
                ? a <= b
                : a >= b,
    ),
  );
  const and = binary(compare, ["and"], (a, _o, b) => Number(!!a && !!b));
  const or = binary(and, ["or"], (a, _o, b) => Number(!!a || !!b));
  const conditional = (): number => {
    const c = or();
    if (peek() !== "?") return c;
    take();
    const a = conditional();
    expected(":");
    const b = conditional();
    return c ? a : b;
  };
  const result = conditional();
  if (pos !== tokens.length) throw new Error("Unexpected expression token.");
  return result;
}
