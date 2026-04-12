import { useEffect } from "react";
import { isKeyboardShortcutTextInputTarget } from "../lib/keyboardShortcuts";

interface ShortcutHandlers {
  enabled?: boolean;
  onNewIssue?: () => void;
  onToggleSidebar?: () => void;
  onTogglePanel?: () => void;
  onShowShortcuts?: () => void;
}

export function useKeyboardShortcuts({
  enabled = true,
  onNewIssue,
  onToggleSidebar,
  onTogglePanel,
  onShowShortcuts,
}: ShortcutHandlers) {
  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented) {
        return;
      }

      // 在输入框中输入时不触发快捷键
      if (isKeyboardShortcutTextInputTarget(e.target)) {
        return;
      }

      // ? → 显示键盘快捷键速查表
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        onShowShortcuts?.();
        return;
      }

      // C → 新建工单
      if (e.key === "c" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        onNewIssue?.();
      }

      // [ → 切换侧边栏
      if (e.key === "[" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onToggleSidebar?.();
      }

      // ] → 切换面板
      if (e.key === "]" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onTogglePanel?.();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enabled, onNewIssue, onToggleSidebar, onTogglePanel, onShowShortcuts]);
}
