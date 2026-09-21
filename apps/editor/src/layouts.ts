export interface Cap {
  key: string;
  width?: number;
}
const row = (s: string): Cap[] =>
  s.split(" ").map((token) => {
    const [key, width] = token.split(":");
    return { key, width: width ? Number(width) : 1 };
  });
const typing = [
  row(
    "grave_accent_and_tilde 1 2 3 4 5 6 7 8 9 0 hyphen equal_sign delete_or_backspace:1.7",
  ),
  row("tab:1.5 q w e r t y u i o p open_bracket close_bracket backslash:1.2"),
  row("caps_lock:1.8 a s d f g h j k l semicolon quote return_or_enter:1.9"),
  row("left_shift:2.3 z x c v b n m comma period slash right_shift:2.4"),
  row(
    "fn left_control left_option left_command:1.3 spacebar:5 right_command:1.3 right_option left_arrow up_arrow down_arrow right_arrow",
  ),
];
export function layoutRows(layout: string): Cap[][] {
  const functionRow = row(
    "escape:1.3 f1 f2 f3 f4 f5 f6 f7 f8 f9 f10 f11 f12:1.4",
  );
  if (layout === "sixty")
    return [
      ...typing
        .slice(0, 4)
        .map((r, i) => (i === 0 ? [{ key: "escape" }, ...r.slice(1)] : [...r])),
      row(
        "left_control:1.25 left_command:1.25 left_option:1.25 spacebar:6.25 right_option:1.25 right_command:1.25 application:1.25 right_control:1.25",
      ),
    ];
  const rows = [functionRow, ...typing.map((r) => [...r])];
  if (layout === "tkl" || layout === "ansi") {
    const extra = [
      row("print_screen scroll_lock pause"),
      row("insert home page_up"),
      row("delete_forward end page_down"),
      [],
      row("up_arrow"),
      row("left_arrow down_arrow right_arrow"),
    ];
    rows.forEach((r, i) => r.push(...extra[i]));
    rows[5] = row(
      "left_control:1.4 left_command:1.3 left_option:1.3 spacebar:6.7 right_option:1.3 right_command:1.3 right_control:1.4 left_arrow down_arrow right_arrow",
    );
  }
  if (layout === "ansi") {
    const num = [
      [],
      row("keypad_num_lock keypad_slash keypad_asterisk keypad_hyphen"),
      row("keypad_7 keypad_8 keypad_9 keypad_plus"),
      row("keypad_4 keypad_5 keypad_6"),
      row("keypad_1 keypad_2 keypad_3 keypad_enter"),
      row("keypad_0:2 keypad_period"),
    ];
    rows.forEach((r, i) => r.push(...num[i]));
  }
  return rows;
}
