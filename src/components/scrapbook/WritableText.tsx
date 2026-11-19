import { useEffect, useRef, type ComponentRef } from 'react';
import { Text, TextInput, type StyleProp, type TextStyle } from 'react-native';
import { useTheme } from '../../theme';

/** What a scrapbook object needs to be written on directly (the writing page). */
export interface NoteEditor {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  onFocus?: () => void;
  accessibilityLabel: string;
}

interface Props {
  text: string;
  style: StyleProp<TextStyle>;
  numberOfLines?: number;
  /** When given, the words are a text box in exactly the same style: you write on the paper itself. */
  editor?: NoteEditor;
  /** Focus as soon as it appears (the polaroid's back, when the words move there mid-sentence). */
  focusOnMount?: boolean;
}

/** Words on a scrapbook object: plain text, or the same words as a text box while writing. */
export function WritableText({ text, style, numberOfLines, editor, focusOnMount = false }: Props) {
  const { colors } = useTheme();
  const input = useRef<ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    if (!editor || !focusOnMount) return;
    // After the flip has started, so the keyboard moves straight to this side.
    const t = setTimeout(() => input.current?.focus(), 60);
    return () => clearTimeout(t);
    // Only when this side appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!editor) {
    return (
      <Text style={style} numberOfLines={numberOfLines}>
        {text}
      </Text>
    );
  }
  return (
    <TextInput
      ref={input}
      value={editor.value}
      onChangeText={editor.onChangeText}
      placeholder={editor.placeholder}
      placeholderTextColor={colors.inkMuted}
      autoFocus={editor.autoFocus}
      onFocus={editor.onFocus}
      multiline
      scrollEnabled={false}
      textAlignVertical="top"
      accessibilityLabel={editor.accessibilityLabel}
      // No box of its own: the paper underneath is the field. Android pads text boxes and adds font padding; take both away so it lines up with the saved text.
      style={[style, { padding: 0, margin: 0, includeFontPadding: false, minHeight: 0 }]}
    />
  );
}
