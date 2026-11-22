import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useTheme } from '../../theme';
import { Texture } from './Texture';

/** Fine horizontal tool marks. One static drawing, with no noise or work on each frame. */
export const BrassGrain = memo(function BrassGrain() {
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 160 32" preserveAspectRatio="none">
      {Array.from({ length: 28 }, (_, i) => {
        const start = (i * 37) % 61;
        return <Path key={i} d={`M${start} ${i + 2} h${55 + (i * 19) % 100}`} stroke={i % 3 === 0 ? '#FFF2C9' : '#51300D'} strokeWidth={i % 4 === 0 ? 0.3 : 0.15} opacity={i % 3 === 0 ? 0.24 : 0.17} />;
      })}
    </Svg>
  );
});

/** A freestanding enamel nameplate on a walnut plinth, rather than a raised switch. */
export function DeskNameplate({ label }: { label: string }) {
  const { typography, dark } = useTheme();
  return (
    <View style={{ width: 124, height: 36 }}>
      <Svg pointerEvents="none" width={124} height={36} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="nameplateFace" x1="0" y1="0" x2="0.2" y2="1"><Stop offset="0" stopColor={dark ? '#D8CBAE' : '#F8EFD8'} /><Stop offset="0.55" stopColor={dark ? '#BDAE8F' : '#EDE0C1'} /><Stop offset="1" stopColor={dark ? '#A19171' : '#D1BC91'} /></LinearGradient>
          <LinearGradient id="nameplateEdge" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#E3C487" /><Stop offset="0.5" stopColor="#A47D40" /><Stop offset="1" stopColor="#65421F" /></LinearGradient>
        </Defs>
        <Path d="M12 3 H111 L122 30 L114 34 H7 L1 30 Z" fill="rgba(17,8,2,0.35)" transform="translate(0 1)" />
        <Path d="M13 1 H110 L120 29 H3 Z" fill="url(#nameplateEdge)" />
        <Path d="M15 3 H108 L116 27 H7 Z" fill="url(#nameplateFace)" stroke="#8B6D3D" strokeWidth={0.6} />
        <Path d="M14 2 H109" stroke="#FFF1CE" strokeWidth={0.8} />
        <Path d="M3 29 H120 L115 33 H7 Z" fill="#49301B" />
        <Path d="M7 30 H116" stroke="#A17A49" strokeWidth={0.7} />
      </Svg>
      <View pointerEvents="none" style={{ position: 'absolute', left: 15, right: 15, top: 4, height: 22 }}><Texture kind="paper" opacity={0.16} /></View>
      <Text numberOfLines={1} style={[typography.printItalic, { position: 'absolute', left: 14, right: 14, top: 3, fontSize: 14, lineHeight: 17, color: '#392D1E', paddingRight: 0, textAlign: 'center', textShadowColor: 'rgba(255,248,223,0.8)', textShadowOffset: { width: 0, height: 0.5 }, textShadowRadius: 0 }]}>{label}</Text>
      <Text style={[typography.stamp, { position: 'absolute', left: 15, right: 15, top: 20, fontSize: 5.5, lineHeight: 7, letterSpacing: 1.6, color: '#746044', textAlign: 'center', paddingRight: 0 }]}>YOUR JOURNAL</Text>
    </View>
  );
}
